// context/CrewDateChatContext.tsx

import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useCallback,
} from 'react';
import { Alert } from 'react-native';
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
  Unsubscribe,
  orderBy,
  DocumentData,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  setDoc, // Imported arrayUnion and arrayRemove
} from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from './UserContext';
import { User } from '../types/User';
import { useCrews } from './CrewsContext';

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
  members: User[];
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
  addMemberToChat: (chatId: string, uid: string) => Promise<void>; // Added function
  removeMemberFromChat: (chatId: string, uid: string) => Promise<void>; // Added function
}

// Create the context
const CrewDateChatContext = createContext<CrewDateChatContextProps | undefined>(
  undefined,
);

// Provider component
export const CrewDateChatProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useUser();
  const [chats, setChats] = useState<CrewDateChat[]>([]);
  const [messages, setMessages] = useState<{ [chatId: string]: Message[] }>({});
  const { crews } = useCrews();

  // Cache for user details to minimize Firestore reads
  const [usersCache, setUsersCache] = useState<{ [key: string]: User }>({});

  // Helper function to fetch user details by UID with caching
  const fetchUserDetails = async (uid: string): Promise<User> => {
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
  };

  // Helper function to chunk array into smaller arrays of specified size
  const chunkArray = (array: string[], size: number): string[][] => {
    const result: string[][] = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  };

  // Helper function to fetch chats for a single crewId
  const fetchChatsForCrew = async (crewId: string): Promise<DocumentData[]> => {
    const startId = `${crewId}_`;
    const endId = `${crewId}_\uf8ff`; // Unicode character to ensure the range includes all possible suffixes

    const chatQuery = query(
      collection(db, 'crew_date_chats'),
      where('__name__', '>=', startId),
      where('__name__', '<=', endId),
    );

    const querySnapshot = await getDocs(chatQuery);
    const chats: DocumentData[] = [];

    querySnapshot.forEach((doc) => {
      chats.push({ id: doc.id, ...doc.data() });
    });

    return chats;
  };

  // Fetch crew date chats where the user is a member and has at least one message
  const fetchChats = async () => {
    if (!user?.uid) return;

    try {
      const chatQuery = query(
        collection(db, 'crew_date_chats'),
        where('memberIds', 'array-contains', user.uid),
        // where('hasMessages', '==', true), // Added condition
      );

      const querySnapshot = await getDocs(chatQuery);
      const fetchedChats: CrewDateChat[] = [];

      for (const docSnap of querySnapshot.docs) {
        const chatData = docSnap.data();

        const memberIds: string[] = chatData.memberIds || [];

        // Exclude the current user's UID to get other members
        const otherMemberIds = memberIds.filter((id) => id !== user.uid);

        // Fetch details for other members
        const members: User[] = await Promise.all(
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

        fetchedChats.push({
          id: docSnap.id,
          crewId: crewId,
          members,
          crewName,
          avatarUrl: crew?.iconUrl,
          lastRead,
        } as CrewDateChat);
      }

      console.log(`Fetched ${fetchedChats.length} crew date chats`);
      console.log('Fetched crew date chats:', fetchedChats);

      setChats(fetchedChats);
    } catch (error) {
      console.error('Error fetching crew date chats:', error);
      Alert.alert('Error', 'Could not fetch crew date chats.');
    }
  };

  // Listen to real-time updates in crew date chats where the user is a member and has at least one message
  const listenToChats = () => {
    if (!user?.uid) return () => {};

    const chatQuery = query(
      collection(db, 'crew_date_chats'),
      where('memberIds', 'array-contains', user.uid),
      //where('hasMessages', '==', true), // Added condition
    );

    const unsubscribe = onSnapshot(
      chatQuery,
      async (querySnapshot) => {
        const fetchedChats: CrewDateChat[] = [];

        for (const docSnap of querySnapshot.docs) {
          const chatData = docSnap.data();

          const memberIds: string[] = chatData.memberIds || [];

          // Exclude the current user's UID to get other members
          const otherMemberIds = memberIds.filter((id) => id !== user.uid);

          // Fetch details for other members
          const members: User[] = await Promise.all(
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

          fetchedChats.push({
            id: docSnap.id,
            crewId: crewId,
            members,
            crewName,
            avatarUrl: crew?.iconUrl,
            lastRead,
          } as CrewDateChat);
        }

        setChats(fetchedChats);
      },
      (error) => {
        console.error('Error listening to chats:', error);
        Alert.alert('Error', 'Could not listen to chats.');
      },
    );

    // Cleanup function to unsubscribe listener
    return () => {
      unsubscribe();
      console.log('Unsubscribed from crew date chat listener.');
    };
  };

  // Send a message in a crew date chat
  const sendMessage = async (chatId: string, text: string) => {
    if (!user?.uid) return;

    try {
      const messagesRef = collection(db, 'crew_date_chats', chatId, 'messages');
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
      Alert.alert('Error', 'Could not send message.');
    }
  };

  // Update lastRead timestamp for a specific chat
  const updateLastRead = useCallback(
    async (chatId: string) => {
      if (!user?.uid) return;

      try {
        const chatRef = doc(db, 'crew_date_chats', chatId);
        await updateDoc(chatRef, {
          [`lastRead.${user.uid}`]: serverTimestamp(),
        });
        console.log(`Updated lastRead for chat ${chatId}`);
      } catch (error) {
        console.error(`Error updating lastRead for chat ${chatId}:`, error);
        Alert.alert('Error', 'Could not update last read status.');
      }
    },
    [user?.uid],
  );

  // Add a member to the chat's memberIds array
  const addMemberToChat = async (
    chatId: string,
    uid: string,
  ): Promise<void> => {
    try {
      const chatRef = doc(db, 'crew_date_chats', chatId);
      setDoc(chatRef, {
        memberIds: arrayUnion(uid),
      });
      console.log(`Added member ${uid} to chat ${chatId}`);
    } catch (error) {
      console.error(`Error adding member ${uid} to chat ${chatId}:`, error);
      Alert.alert('Error', 'Could not add member to chat.');
    }
  };

  // Remove a member from the chat's memberIds array
  const removeMemberFromChat = async (
    chatId: string,
    uid: string,
  ): Promise<void> => {
    try {
      const chatRef = doc(db, 'crew_date_chats', chatId);
      await updateDoc(chatRef, {
        memberIds: arrayRemove(uid),
      });
      console.log(`Removed member ${uid} from chat ${chatId}`);
    } catch (error) {
      console.error(`Error removing member ${uid} from chat ${chatId}:`, error);
      Alert.alert('Error', 'Could not remove member from chat.');
    }
  };

  // Listen to real-time updates in messages of a crew date chat with sender names
  const listenToMessages = (chatId: string) => {
    const messagesRef = collection(db, 'crew_date_chats', chatId, 'messages');
    const msgQuery = query(messagesRef, orderBy('createdAt', 'asc'));

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
          Alert.alert('Error', 'Could not process messages updates.');
        }
      },
      (error) => {
        console.error('Error listening to messages:', error);
        Alert.alert('Error', 'Could not listen to messages.');
      },
    );

    return unsubscribe;
  };

  // Fetch chats and set up real-time listener on mount
  useEffect(() => {
    fetchChats();

    const unsubscribe = listenToChats();

    return () => {
      if (unsubscribe) unsubscribe();
      console.log('CrewDateChatContext unmounted.');
    };
  }, [user?.uid, crews]); // Added `crews` as a dependency to handle dynamic crew membership changes

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
