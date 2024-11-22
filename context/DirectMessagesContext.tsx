// context/DirectMessagesContext.tsx

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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { useUser } from '@/context/UserContext';
import { User } from '@/types/User';
import Toast from 'react-native-toast-message';

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
  lastRead: Timestamp | null; // Last read timestamp for the current user
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
  totalUnread: number; // Added totalUnread
}

// Create the context
const DirectMessagesContext = createContext<
  DirectMessagesContextProps | undefined
>(undefined);

// Provider component
export const DirectMessagesProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user, activeChats } = useUser(); // Access activeChats from UserContext
  const [dms, setDms] = useState<DirectMessage[]>([]);
  const [messages, setMessages] = useState<{ [dmId: string]: Message[] }>({});
  const [totalUnread, setTotalUnread] = useState<number>(0); // New state

  // Fetch unread count for a specific DM
  const fetchUnreadCount = useCallback(
    async (dmId: string): Promise<number> => {
      if (!user?.uid) return 0;

      try {
        const dmDoc = await getDoc(doc(db, 'direct_messages', dmId));
        if (!dmDoc.exists()) return 0;

        const dmData = dmDoc.data();
        if (!dmData) return 0;

        const lastRead = dmData.lastRead ? dmData.lastRead[user.uid] : null;
        if (!lastRead) {
          // If lastRead is null, all messages are unread
          const messagesRef = collection(
            db,
            'direct_messages',
            dmId,
            'messages',
          );
          const msgQuery = query(messagesRef);
          const querySnapshot = await getDocs(msgQuery);
          return querySnapshot.size;
        }

        const messagesRef = collection(db, 'direct_messages', dmId, 'messages');
        const msgQuery = query(messagesRef, where('createdAt', '>', lastRead));
        const querySnapshot = await getDocs(msgQuery);

        return querySnapshot.size;
      } catch (error) {
        console.error('Error fetching unread count:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Could not fetch unread count.',
        });
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
      // Optionally handle the error, e.g., show a notification
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
        const messagesRef = collection(db, 'direct_messages', dmId, 'messages');
        const newMessage = {
          senderId: user.uid,
          text,
          createdAt: Timestamp.fromDate(new Date()),
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

  // Update lastRead timestamp for a specific direct message
  const updateLastRead = useCallback(
    async (dmId: string) => {
      if (!user?.uid) return;

      try {
        const dmRef = doc(db, 'direct_messages', dmId);
        await updateDoc(dmRef, {
          [`lastRead.${user.uid}`]: serverTimestamp(),
        });
        console.log(`Updated lastRead for DM ${dmId}`);
        // Do not call computeTotalUnread here to avoid circular dependency
      } catch (error) {
        console.error(`Error updating lastRead for DM ${dmId}:`, error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Could not update last read status.',
        });
      }
    },
    [user?.uid],
  );

  // Listen to real-time updates in messages of a direct message conversation
  const listenToDMMessages = useCallback((dmId: string) => {
    const messagesRef = collection(db, 'direct_messages', dmId, 'messages');
    const msgQuery = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      msgQuery,
      async (querySnapshot) => {
        try {
          console.log(
            `Real-time update: Fetched ${querySnapshot.size} messages for DM ${dmId}`,
          );

          const fetchedMessages: Message[] = await Promise.all(
            querySnapshot.docs.map(async (docSnap) => {
              const msgData = docSnap.data();
              const senderId: string = msgData.senderId;
              const senderDoc = await getDoc(doc(db, 'users', senderId));
              let senderName = 'Unknown';
              if (senderDoc.exists()) {
                senderName = senderDoc.data().displayName || 'Unknown';
              }

              return {
                id: docSnap.id,
                senderId,
                text: msgData.text,
                createdAt: msgData.createdAt,
                senderName, // Include sender's name
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

    return unsubscribe;
  }, []);

  // Fetch direct messages involving the current user
  const fetchDirectMessages = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const dmQuery = query(
        collection(db, 'direct_messages'),
        where('participants', 'array-contains', user.uid),
      );
      const querySnapshot = await getDocs(dmQuery);

      const fetchedDMs: DirectMessage[] = [];

      for (const docSnap of querySnapshot.docs) {
        const dmData = docSnap.data();
        const participantIds: string[] = dmData.participants;

        // Exclude the current user's UID to get the other participant
        const otherParticipantId = participantIds.find((id) => id !== user.uid);
        if (!otherParticipantId) continue; // Skip if no other participant

        // Fetch other user's details
        const otherUserDoc = await getDoc(doc(db, 'users', otherParticipantId));
        let otherUser: User;
        if (otherUserDoc.exists()) {
          const userData = otherUserDoc.data();
          otherUser = {
            uid: otherUserDoc.id,
            displayName: userData.displayName || 'Unnamed User',
            email: userData.email || '',
            photoURL: userData.photoURL,
          };
        } else {
          otherUser = {
            uid: otherParticipantId,
            displayName: 'Unknown User',
            email: 'unknown@example.com',
          };
        }

        // Get lastRead timestamp for current user
        const lastRead: Timestamp | null = dmData.lastRead
          ? dmData.lastRead[user.uid] || null
          : null;

        fetchedDMs.push({
          id: docSnap.id,
          participants: [otherUser],
          lastRead,
        });
      }

      setDms(fetchedDMs);
      // Removed computeTotalUnread call to prevent circular dependency
    } catch (error) {
      console.error('Error fetching direct messages:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not fetch direct messages.',
      });
    }
  }, [user?.uid]);

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
          const fetchedDMs: DirectMessage[] = [];

          for (const docSnap of querySnapshot.docs) {
            const dmData = docSnap.data();
            const participantIds: string[] = dmData.participants;

            // Exclude the current user's UID to get the other participant
            const otherParticipantId = participantIds.find(
              (id) => id !== user.uid,
            );
            if (!otherParticipantId) continue; // Skip if no other participant

            // Fetch other user's details
            const otherUserDoc = await getDoc(
              doc(db, 'users', otherParticipantId),
            );
            let otherUser: User;
            if (otherUserDoc.exists()) {
              const userData = otherUserDoc.data();
              otherUser = {
                uid: otherUserDoc.id,
                displayName: userData.displayName || 'Unnamed User',
                email: userData.email || '',
                photoURL: userData.photoURL,
              };
            } else {
              otherUser = {
                uid: otherParticipantId,
                displayName: 'Unknown User',
                email: 'unknown@example.com',
              };
            }

            // Get lastRead timestamp for current user
            const lastRead: Timestamp | null = dmData.lastRead
              ? dmData.lastRead[user.uid] || null
              : null;

            fetchedDMs.push({
              id: docSnap.id,
              participants: [otherUser],
              lastRead,
            });
          }

          setDms(fetchedDMs);
          // Removed computeTotalUnread call to prevent circular dependency
        } catch (error) {
          console.error('Error processing direct messages snapshot:', error);
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Could not process direct messages updates.',
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
  }, [user?.uid]);

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
        totalUnread, // Provide the totalUnread value
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
