// context/CrewDateChatContext.tsx

import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useCallback,
} from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  Timestamp,
  onSnapshot,
  getDoc,
  doc,
  orderBy,
  updateDoc,
  setDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { useUser } from '@/context/UserContext';
import { User } from '@/types/User';
import { useCrews } from '@/context/CrewsContext';
import Toast from 'react-native-toast-message';

// Define the Message interface
interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: Timestamp;
  senderName?: string; // Optional: Include sender's name
}

// Extend the CrewDateChat interface to include member details, crewName, and lastRead
interface CrewDateChat {
  id: string; // e.g., 'crew123_2024-04-27'
  crewId: string; // Extracted crewId
  otherMembers: User[];
  crewName: string; // Fetched from crews collection
  avatarUrl?: string; // Optional: Include avatar URL
  lastRead: Timestamp | null; // Last read timestamp for the current user
}

// Define the context properties
interface CrewDateChatContextProps {
  chats: CrewDateChat[];
  messages: { [chatId: string]: Message[] };
  fetchChats: () => Promise<void>;
  sendMessage: (chatId: string, text: string) => Promise<void>;
  updateLastRead: (chatId: string) => Promise<void>;
  listenToChats: () => () => void;
  listenToMessages: (chatId: string) => () => void;
  addMemberToChat: (chatId: string, uid: string) => Promise<void>;
  removeMemberFromChat: (chatId: string, uid: string) => Promise<void>;
  fetchUnreadCount: (chatId: string) => Promise<number>;
  totalUnread: number;
  getChatParticipantsCount: (chatId: string) => number;
}

// Create the context
const CrewDateChatContext = createContext<CrewDateChatContextProps | undefined>(
  undefined,
);

// Provider component
export const CrewDateChatProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user, activeChats } = useUser(); // Access activeChats from UserContext
  const [chats, setChats] = useState<CrewDateChat[]>([]);
  const [messages, setMessages] = useState<{ [chatId: string]: Message[] }>({});
  const { crews, usersCache, setUsersCache } = useCrews();

  // New state for total unread messages
  const [totalUnread, setTotalUnread] = useState<number>(0);

  // Helper function to fetch user details by UID with caching
  const fetchUserDetails = useCallback(
    async (uid: string): Promise<User> => {
      if (usersCache[uid]) {
        return usersCache[uid];
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const fetchedUser: User = {
            uid: userDoc.id,
            displayName: userData.displayName || 'Unnamed User',
            email: userData.email || '',
            photoURL: userData.photoURL,
          };
          setUsersCache((prev) => ({ ...prev, [uid]: fetchedUser }));
          return fetchedUser;
        } else {
          // Handle case where user data does not exist
          return {
            uid,
            displayName: 'Unknown User',
            email: 'unknown@example.com',
          };
        }
      } catch (error) {
        console.error(`Error fetching user data for UID ${uid}:`, error);
        return {
          uid,
          displayName: 'Error Fetching User',
          email: 'error@example.com',
        };
      }
    },
    [usersCache],
  );

  // Fetch unread count for a specific chat
  const fetchUnreadCount = useCallback(
    async (chatId: string): Promise<number> => {
      if (!user?.uid) return 0;

      try {
        const chatRef = doc(db, 'crew_date_chats', chatId);
        const chatDoc = await getDoc(chatRef);

        if (!chatDoc.exists()) {
          console.error(`Chat document ${chatId} does not exist.`);
          return 0;
        }

        const chatData = chatDoc.data();
        const lastRead = chatData.lastRead ? chatData.lastRead[user.uid] : null;

        const messagesRef = collection(
          db,
          'crew_date_chats',
          chatId,
          'messages',
        );

        let msgQuery;
        if (lastRead) {
          // Fetch messages created after lastRead
          msgQuery = query(messagesRef, where('createdAt', '>', lastRead));
        } else {
          // If lastRead is null, all messages are unread
          msgQuery = query(messagesRef);
        }

        const querySnapshot = await getDocs(msgQuery);

        return querySnapshot.size;
      } catch (error) {
        console.error(`Error fetching unread count for chat ${chatId}:`, error);
        return 0;
      }
    },
    [user?.uid],
  );

  // Function to compute total unread messages
  const computeTotalUnread = useCallback(async () => {
    if (!user?.uid || chats.length === 0) {
      setTotalUnread(0);
      return;
    }

    try {
      const unreadPromises = chats
        .filter((chat) => !activeChats.has(chat.id))
        .map((chat) => fetchUnreadCount(chat.id));
      const unreadCounts = await Promise.all(unreadPromises);
      const total = unreadCounts.reduce((acc, count) => acc + count, 0);
      setTotalUnread(total);
    } catch (error) {
      console.error('Error computing total unread messages:', error);
      // Optionally handle the error, e.g., show a notification
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not compute total unread messages',
      });
    }
  }, [user?.uid, chats, fetchUnreadCount, activeChats]);

  const fetchChats = useCallback(async () => {
    if (!user?.uid) {
      console.log('User is signed out. Clearing group chats.');
      setChats([]);
      setMessages({});
      setTotalUnread(0);
      return;
    }

    try {
      const chatQuery = query(
        collection(db, 'crew_date_chats'),
        where('memberIds', 'array-contains', user.uid),
        where('hasMessages', '==', true),
      );

      const querySnapshot = await getDocs(chatQuery);

      // Map each document snapshot to a promise that resolves to a CrewDateChat object
      const chatPromises = querySnapshot.docs.map(async (docSnap) => {
        const chatData = docSnap.data();

        const memberIds: string[] = chatData.memberIds || [];

        // Exclude the current user's UID to get other members
        const otherMemberIds = memberIds.filter((id) => id !== user.uid);

        // Fetch details for other members in parallel
        const otherMembers: User[] = await Promise.all(
          otherMemberIds.map((uid) => fetchUserDetails(uid)),
        );

        // Extract crewId from chatId (document ID)
        const [crewId] = docSnap.id.split('_');

        // Fetch crewName from crews collection
        const crew = crews.find((c) => c.id === crewId);
        const crewName = crew ? crew.name : 'Unknown Crew';

        // Get lastRead timestamp for current user
        const lastRead: Timestamp | null = chatData.lastRead
          ? chatData.lastRead[user.uid] || null
          : null;

        return {
          id: docSnap.id,
          crewId: crewId,
          otherMembers,
          crewName,
          avatarUrl: crew?.iconUrl,
          lastRead,
        } as CrewDateChat;
      });

      // Wait for all chat promises to resolve in parallel
      const fetchedChats = await Promise.all(chatPromises);

      setChats(fetchedChats);
      // Removed computeTotalUnread from here
    } catch (error) {
      console.error('Error fetching crew date chats:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not fetch crew date chats',
      });
    }
  }, [user?.uid, crews, fetchUserDetails]);

  // Listen to real-time updates in crew date chats where the user is a member and has at least one message
  const listenToChats = useCallback(() => {
    if (!user?.uid) return () => {};

    const chatQuery = query(
      collection(db, 'crew_date_chats'),
      where('memberIds', 'array-contains', user.uid),
      where('hasMessages', '==', true), // Optional condition
    );

    const unsubscribe = onSnapshot(
      chatQuery,
      async (querySnapshot) => {
        try {
          // Map each document snapshot to a promise that resolves to a CrewDateChat object
          const chatPromises = querySnapshot.docs.map(async (docSnap) => {
            const chatData = docSnap.data();

            const memberIds: string[] = chatData.memberIds || [];

            // Exclude the current user's UID to get other members
            const otherMemberIds = memberIds.filter((id) => id !== user.uid);

            // Fetch details for other members in parallel
            const otherMembers: User[] = await Promise.all(
              otherMemberIds.map((uid) => fetchUserDetails(uid)),
            );

            // Extract crewId from chatId (document ID)
            const [crewId] = docSnap.id.split('_');

            // Fetch crewName from crews collection
            const crew = crews.find((c) => c.id === crewId);
            const crewName = crew ? crew.name : 'Unknown Crew';

            // Get lastRead timestamp for current user
            const lastRead: Timestamp | null = chatData.lastRead
              ? chatData.lastRead[user.uid] || null
              : null;

            return {
              id: docSnap.id,
              crewId: crewId,
              otherMembers,
              crewName,
              avatarUrl: crew?.iconUrl,
              lastRead,
            } as CrewDateChat;
          });

          // Wait for all chat promises to resolve in parallel
          const fetchedChats = await Promise.all(chatPromises);

          setChats(fetchedChats);
          // Removed computeTotalUnread from here
        } catch (error) {
          console.error('Error processing real-time chat updates:', error);
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Could not process real-time chat updates',
          });
        }
      },
      (error) => {
        console.error('Error listening to chats:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Could not listen to chats',
        });
      },
    );

    return () => {
      unsubscribe();
      console.log('Unsubscribed from crew date chat listener.');
    };
  }, [user?.uid, crews, fetchUserDetails]);

  useEffect(() => {
    computeTotalUnread();
  }, [computeTotalUnread]);

  // Send a message in a crew date chat
  const sendMessage = useCallback(
    async (chatId: string, text: string) => {
      if (!user?.uid) return;

      try {
        const messagesRef = collection(
          db,
          'crew_date_chats',
          chatId,
          'messages',
        );
        const newMessage = {
          senderId: user.uid,
          text,
          createdAt: Timestamp.fromDate(new Date()),
        };
        await addDoc(messagesRef, newMessage);

        // **Update hasMessages field if not already true**
        const chatRef = doc(db, 'crew_date_chats', chatId);
        await updateDoc(chatRef, {
          hasMessages: true,
        });
        console.log(`Message sent in chat ${chatId}: "${text}"`);
      } catch (error) {
        console.error('Error sending message:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Could not send message.',
        });
      }
    },
    [user?.uid],
  );

  // Update lastRead timestamp for a specific chat
  const updateLastRead = useCallback(
    async (chatId: string) => {
      if (!user?.uid) return;

      try {
        const chatRef = doc(db, 'crew_date_chats', chatId);
        await setDoc(
          chatRef,
          {
            lastRead: {
              [user.uid]: serverTimestamp(),
            },
          },
          { merge: true },
        );
      } catch (error) {
        console.error(`Error updating lastRead for chat ${chatId}:`, error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Could not update last read status.',
        });
      }
    },
    [user?.uid],
  );

  const addMemberToChat = useCallback(
    async (chatId: string, uid: string): Promise<void> => {
      try {
        const chatRef = doc(db, 'crew_date_chats', chatId);
        const chatSnap = await getDoc(chatRef);

        if (chatSnap.exists()) {
          // Document exists, update it
          await updateDoc(chatRef, {
            memberIds: arrayUnion(uid),
          });
          console.log(`Added member ${uid} to existing chat ${chatId}`);
        } else {
          // Document does not exist, create it
          await setDoc(chatRef, {
            memberIds: [uid], // Initialize the array
            createdAt: serverTimestamp(), // Optionally track when the chat was created
          });
          console.log(
            `Created new chat and added member ${uid} to chat ${chatId}`,
          );
        }
      } catch (error) {
        console.error(`Error adding member ${uid} to chat ${chatId}:`, error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Could not add member to chat.',
        });
      }
    },
    [],
  );

  // Remove a member from the chat's memberIds array
  const removeMemberFromChat = useCallback(
    async (chatId: string, uid: string): Promise<void> => {
      try {
        const chatRef = doc(db, 'crew_date_chats', chatId);
        await updateDoc(chatRef, {
          memberIds: arrayRemove(uid),
        });
        console.log(`Removed member ${uid} from chat ${chatId}`);
      } catch (error) {
        console.error(
          `Error removing member ${uid} from chat ${chatId}:`,
          error,
        );
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Could not remove member from chat.',
        });
      }
    },
    [],
  );

  // Listen to real-time updates in messages of a crew date chat with sender names
  const listenToMessages = useCallback(
    (chatId: string) => {
      if (!user?.uid) return () => {};
      const messagesRef = collection(db, 'crew_date_chats', chatId, 'messages');
      const msgQuery = query(messagesRef, orderBy('createdAt', 'desc')); // Optimize ordering

      const unsubscribe = onSnapshot(
        msgQuery,
        async (querySnapshot) => {
          try {
            console.log(
              `Real-time update: Fetched ${querySnapshot.size} messages for chat ${chatId}`,
            );

            const fetchedMessages: Message[] = await Promise.all(
              querySnapshot.docs.map(async (docSnap) => {
                const msgData = docSnap.data();
                const senderId: string = msgData.senderId;
                const sender = await fetchUserDetails(senderId);

                return {
                  id: docSnap.id,
                  senderId,
                  text: msgData.text,
                  createdAt: msgData.createdAt,
                  senderName: sender.displayName, // Include sender's name
                };
              }),
            );

            setMessages((prev) => ({
              ...prev,
              [chatId]: fetchedMessages,
            }));
          } catch (error) {
            console.error('Error processing messages snapshot:', error);
            Toast.show({
              type: 'error',
              text1: 'Error',
              text2: 'Could not process messages updates.',
            });
          }
        },
        (error) => {
          console.error('Error listening to messages:', error);
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Could not listen to messages.',
          });
        },
      );

      return unsubscribe;
    },
    [fetchUserDetails],
  );

  // Get count of chat participants
  const getChatParticipantsCount = (chatId: string): number => {
    const chat = chats.find((chat) => chat.id === chatId);
    return chat ? chat.otherMembers.length + 1 : 0;
  };

  // Fetch chats and set up real-time listeners on mount
  useEffect(() => {
    fetchChats();

    const unsubscribe = listenToChats();

    return () => {
      if (unsubscribe) unsubscribe();
      console.log('CrewDateChatContext unmounted.');
    };
  }, [fetchChats, listenToChats]);

  return (
    <CrewDateChatContext.Provider
      value={{
        chats,
        messages,
        fetchChats,
        sendMessage,
        updateLastRead,
        listenToChats,
        listenToMessages,
        addMemberToChat,
        removeMemberFromChat,
        fetchUnreadCount,
        totalUnread,
        getChatParticipantsCount,
      }}
    >
      {children}
    </CrewDateChatContext.Provider>
  );
};

// Custom hook to use the CrewDateChatContext
export const useCrewDateChat = () => {
  const context = useContext(CrewDateChatContext);
  if (!context) {
    throw new Error(
      'useCrewDateChat must be used within a CrewDateChatProvider',
    );
  }
  return context;
};
