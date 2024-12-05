// context/DirectMessagesContext.tsx

import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useCallback,
  useRef,
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
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { useUser } from '@/context/UserContext';
import { User } from '@/types/User';
import Toast from 'react-native-toast-message';
import { useCrews } from './CrewsContext';

// Define the Message interface
interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: Timestamp;
  senderName?: string; // Optional: Include sender's name
}

// Extend the DirectMessage interface to include lastRead
interface DirectMessage {
  id: string; // e.g., 'user1_user2'
  participants: User[]; // Array of two users
  lastRead: { [uid: string]: Timestamp | null };
}

// Define the context properties
interface DirectMessagesContextProps {
  dms: DirectMessage[];
  messages: { [dmId: string]: Message[] };
  fetchDirectMessages: () => Promise<void>;
  sendMessage: (dmId: string, text: string) => Promise<void>;
  updateLastRead: (dmId: string) => Promise<void>;
  listenToDirectMessages: () => () => void;
  listenToDMMessages: (dmId: string) => () => void;
  fetchUnreadCount: (dmId: string) => Promise<number>;
  totalUnread: number;
}

// Create the context
const DirectMessagesContext = createContext<
  DirectMessagesContextProps | undefined
>(undefined);

// Provider component
export const DirectMessagesProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user, activeChats } = useUser();
  const { usersCache } = useCrews();
  const [dms, setDms] = useState<DirectMessage[]>([]);
  const [messages, setMessages] = useState<{ [dmId: string]: Message[] }>({});
  const [totalUnread, setTotalUnread] = useState<number>(0);

  // Ref to keep track of message listeners
  const listenersRef = useRef<{ [dmId: string]: () => void }>({});

  // Fetch unread count for a specific DM
  const fetchUnreadCount = useCallback(
    async (dmId: string): Promise<number> => {
      if (!user?.uid) return 0;

      try {
        const dmRef = doc(db, 'direct_messages', dmId);
        const dmDoc = await getDoc(dmRef);

        if (!dmDoc.exists()) {
          console.warn(`DM document ${dmId} does not exist.`);
          return 0;
        }

        const dmData = dmDoc.data();
        if (!dmData) return 0;

        const lastRead = dmData.lastRead[user.uid];

        const messagesRef = collection(db, 'direct_messages', dmId, 'messages');
        let msqQuery;
        if (lastRead) {
          msqQuery = query(messagesRef, where('createdAt', '>', lastRead));
        } else {
          return 0;
        }

        const querySnapshot = await getDocs(msqQuery);
        return querySnapshot.size;
      } catch (error) {
        console.error('Error fetching unread count:', error);
        return 0;
      }
    },
    [user?.uid],
  );

  // Function to compute total unread messages
  const computeTotalUnread = useCallback(async () => {
    if (!user?.uid || dms.length === 0) {
      setTotalUnread(0);
      return;
    }

    try {
      const unreadPromises = dms
        .filter((dm) => !activeChats.has(dm.id)) // Exclude active DMs
        .map((dm) => fetchUnreadCount(dm.id));
      const unreadCounts = await Promise.all(unreadPromises);
      const total = unreadCounts.reduce((acc, count) => acc + count, 0);
      setTotalUnread(total);
    } catch (error) {
      console.error('Error computing total unread messages:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not compute total unread messages',
      });
    }
  }, [user?.uid, dms, fetchUnreadCount, activeChats]);

  // Send a message in a direct message conversation
  const sendMessage = useCallback(
    async (dmId: string, text: string) => {
      if (!user?.uid) return;

      try {
        const dmRef = doc(db, 'direct_messages', dmId);
        const dmDoc = await getDoc(dmRef);
        const otherUserUid = dmId.split('_').find((id) => id !== user.uid);

        if (!dmDoc.exists()) {
          // If DM doesn't exist, create it with participants
          await setDoc(dmRef, {
            participants: [user.uid, otherUserUid],
            lastRead: {
              [user.uid]: serverTimestamp(),
              [otherUserUid!]: Timestamp.fromDate(
                new Date(Date.now() - 86400000), // Set to 1 day earlier
              ),
            },
            createdAt: serverTimestamp(),
          });
        } else {
          const dmData = dmDoc.data();
          if (!dmData.participants || !Array.isArray(dmData.participants)) {
            await setDoc(
              dmRef,
              {
                participants: [user.uid, otherUserUid],
              },
              { merge: true },
            );
          }
        }
        // Now, add the message
        const messagesRef = collection(db, 'direct_messages', dmId, 'messages');
        const newMessage = {
          senderId: user.uid,
          text,
          createdAt: serverTimestamp(),
        };
        await addDoc(messagesRef, newMessage);
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

  const updateLastRead = useCallback(
    async (dmId: string) => {
      if (!user?.uid) return;

      try {
        const dmRef = doc(db, 'direct_messages', dmId);
        await setDoc(
          dmRef,
          {
            lastRead: {
              [user.uid]: serverTimestamp(),
            },
          },
          { merge: true },
        );
      } catch (error) {
        console.warn(`Error updating lastRead for DM ${dmId}:`, error);
      }
    },
    [user?.uid],
  );

  // Listen to real-time updates in messages of a direct message conversation
  const listenToDMMessages = useCallback(
    (dmId: string) => {
      if (listenersRef.current[dmId]) {
        // Listener already exists
        return listenersRef.current[dmId];
      }

      const messagesRef = collection(db, 'direct_messages', dmId, 'messages');
      const msgQuery = query(messagesRef, orderBy('createdAt', 'asc'));

      const unsubscribe = onSnapshot(
        msgQuery,
        async (querySnapshot) => {
          try {
            const fetchedMessages: Message[] = await Promise.all(
              querySnapshot.docs.map(async (docSnap) => {
                const msgData = docSnap.data();
                const senderId: string = msgData.senderId;
                let senderName = 'Unknown';

                if (senderId === user?.uid) {
                  senderName = user?.displayName || 'You';
                } else if (usersCache[senderId]) {
                  senderName = usersCache[senderId].displayName || 'Unknown';
                } else {
                  const senderDoc = await getDoc(doc(db, 'users', senderId));
                  if (senderDoc.exists()) {
                    senderName = senderDoc.data().displayName || 'Unknown';
                  }
                }

                return {
                  id: docSnap.id,
                  senderId,
                  text: msgData.text,
                  createdAt: msgData.createdAt,
                  senderName,
                };
              }),
            );

            setMessages((prev) => ({
              ...prev,
              [dmId]: fetchedMessages,
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
          console.error('Error listening to DM messages:', error);
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Could not listen to messages.',
          });
        },
      );

      // Store the unsubscribe function
      listenersRef.current[dmId] = unsubscribe;

      return () => {
        // Clean up the listener
        if (listenersRef.current[dmId]) {
          listenersRef.current[dmId]();
          delete listenersRef.current[dmId];
        }
      };
    },
    [user?.uid, user?.displayName, usersCache],
  );

  // Fetch direct messages involving the current user
  const fetchDirectMessages = useCallback(async () => {
    if (!user?.uid) {
      console.log('User is not logged in. Clearing DMs.');
      setDms([]);
      setMessages({});
      setTotalUnread(0);
      return;
    }

    try {
      const dmQuery = query(
        collection(db, 'direct_messages'),
        where('participants', 'array-contains', user.uid),
      );
      const querySnapshot = await getDocs(dmQuery);

      // Map each document snapshot to a promise that resolves to a DirectMessage object
      const dmPromises = querySnapshot.docs.map(async (docSnap) => {
        const dmData = docSnap.data();
        const participantIds: string[] = dmData.participants || [];

        // Exclude the current user's UID to get the other participant
        const otherParticipantId = participantIds.find((id) => id !== user.uid);
        if (!otherParticipantId) return null; // Skip if no other participant

        try {
          // Fetch other user's details in parallel
          let otherUser: User;
          if (usersCache[otherParticipantId]) {
            otherUser = usersCache[otherParticipantId];
          } else {
            const userData = await fetchUserDetails(otherParticipantId);
            otherUser = userData;
          }

          // Get lastRead timestamp for current user
          const lastRead = dmData.lastRead[user.uid];

          return {
            id: docSnap.id,
            participants: [otherUser],
            lastRead: { [user.uid]: lastRead },
          } as DirectMessage;
        } catch (innerError) {
          console.error(`Error processing DM ${docSnap.id}:`, innerError);
          return null; // Skip this DM if there's an error
        }
      });

      // Wait for all DM promises to resolve in parallel
      const fetchedDMs = (await Promise.all(dmPromises)).filter(
        (dm) => dm !== null,
      );

      const validDMs = fetchedDMs.filter(
        (dm): dm is DirectMessage => dm !== null,
      );
      setDms(validDMs);
    } catch (error) {
      console.error('Error fetching direct messages:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not fetch direct messages.',
      });
    }
  }, [user?.uid, usersCache]);

  // Helper function to fetch a user's details
  const fetchUserDetails = async (uid: string): Promise<User> => {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        uid: userDoc.id,
        displayName: userData.displayName || 'Unnamed User',
        email: userData.email || '',
        photoURL: userData.photoURL || '',
      };
    } else {
      return {
        uid,
        displayName: 'Unknown User',
        email: 'unknown@example.com',
        photoURL: '',
      };
    }
  };

  // Helper function to fetch multiple users' details
  const fetchUserDetailsBatch = async (userIds: string[]) => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('__name__', 'in', userIds));

    const querySnapshot = await getDocs(q);
    const users: Record<string, User> = {};

    querySnapshot.forEach((docSnap) => {
      const userData = docSnap.data();
      users[docSnap.id] = {
        uid: docSnap.id,
        displayName: userData.displayName || 'Unnamed User',
        email: userData.email || '',
        photoURL: userData.photoURL || '',
      };
    });

    return userIds.map(
      (uid) =>
        users[uid] || {
          uid,
          displayName: 'Unknown User',
          email: 'unknown@example.com',
          photoURL: '',
        },
    );
  };

  // Listen to real-time updates in direct messages
  const listenToDirectMessages = useCallback(() => {
    if (!user?.uid) return () => {};

    const dmQuery = query(
      collection(db, 'direct_messages'),
      where('participants', 'array-contains', user.uid),
    );

    const unsubscribe = onSnapshot(
      dmQuery,
      async (querySnapshot) => {
        try {
          // Extract all other participant IDs
          const otherParticipantIds = querySnapshot.docs
            .map((docSnap) => {
              const dmData = docSnap.data();
              const participantIds: string[] = dmData.participants || [];
              return participantIds.find((id) => id !== user.uid);
            })
            .filter((id) => id !== undefined) as string[];

          // Remove duplicates
          const uniqueOtherParticipantIds = [...new Set(otherParticipantIds)];

          // Check usersCache for existing users
          const cachedUsers = uniqueOtherParticipantIds
            .filter((id) => usersCache[id])
            .map((id) => usersCache[id]);

          // Identify IDs that need to be fetched from DB
          const idsToFetch = uniqueOtherParticipantIds.filter(
            (id) => !usersCache[id],
          );

          // Fetch missing users from DB
          const fetchedUsers = idsToFetch.length
            ? await fetchUserDetailsBatch(idsToFetch)
            : [];

          // Combine cached and fetched users
          const allUsers = [...cachedUsers, ...fetchedUsers];

          // Create a mapping from UID to user details
          const userMap: Record<string, User> = {};
          allUsers.forEach((user) => {
            userMap[user.uid] = user;
          });

          // Map each DM to a DirectMessage object
          const fetchedDMs = querySnapshot.docs
            .map((docSnap) => {
              const dmData = docSnap.data();
              const participantIds: string[] = dmData.participants || [];

              const otherParticipantId = participantIds.find(
                (id) => id !== user.uid,
              );
              if (!otherParticipantId) return null;

              const otherUser = userMap[otherParticipantId] || {
                uid: otherParticipantId,
                displayName: 'Unknown User',
                email: 'unknown@example.com',
                photoURL: '',
              };

              const lastRead = dmData.lastRead[user.uid];

              return {
                id: docSnap.id,
                participants: [otherUser],
                lastRead: { [user.uid]: lastRead },
              } as DirectMessage;
            })
            .filter((dm) => dm !== null);

          const validDMs = fetchedDMs.filter(
            (dm): dm is DirectMessage => dm !== null,
          );

          setDms(validDMs);
        } catch (error) {
          console.error('Error fetching direct messages:', error);
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Could not fetch direct messages.',
          });
        }
      },
      (error) => {
        console.error('Error listening to direct messages:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Could not listen to direct messages.',
        });
      },
    );

    return unsubscribe;
  }, [user?.uid, usersCache]);

  // Fetch DMs and set up real-time listeners on mount
  useEffect(() => {
    fetchDirectMessages();

    const unsubscribe = listenToDirectMessages();

    return () => {
      if (unsubscribe) unsubscribe();
      console.log('DirectMessagesContext unmounted.');
    };
  }, [fetchDirectMessages, listenToDirectMessages]);

  // Compute total unread messages whenever dms or activeChats change
  useEffect(() => {
    computeTotalUnread();
  }, [computeTotalUnread]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      // Cleanup all message listeners
      Object.values(listenersRef.current).forEach((unsubscribe) =>
        unsubscribe(),
      );
      listenersRef.current = {};
    };
  }, []);

  return (
    <DirectMessagesContext.Provider
      value={{
        dms,
        messages,
        fetchDirectMessages,
        sendMessage,
        updateLastRead,
        listenToDirectMessages,
        listenToDMMessages,
        fetchUnreadCount,
        totalUnread,
      }}
    >
      {children}
    </DirectMessagesContext.Provider>
  );
};

// Custom hook to use the DirectMessagesContext
export const useDirectMessages = () => {
  const context = useContext(DirectMessagesContext);
  if (!context) {
    throw new Error(
      'useDirectMessages must be used within a DirectMessagesProvider',
    );
  }
  return context;
};
