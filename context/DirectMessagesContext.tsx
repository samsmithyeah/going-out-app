// context/DirectMessagesContext.tsx

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
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from './UserContext';
import { User } from '../types/User';

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
  updateLastRead: (dmId: string) => Promise<void>; // Added method
  listenToDirectMessages: () => () => void;
  listenToDMMessages: (dmId: string) => () => void;
}

// Create the context
const DirectMessagesContext = createContext<
  DirectMessagesContextProps | undefined
>(undefined);

// Provider component
export const DirectMessagesProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useUser();
  const [dms, setDms] = useState<DirectMessage[]>([]);
  const [messages, setMessages] = useState<{ [dmId: string]: Message[] }>({});

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
    } catch (error) {
      console.error('Error fetching direct messages:', error);
      Alert.alert('Error', 'Could not fetch direct messages.');
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
      },
      (error) => {
        console.error('Error listening to direct messages:', error);
        Alert.alert('Error', 'Could not listen to direct messages.');
      },
    );

    return unsubscribe;
  }, [user?.uid]);

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
        Alert.alert('Error', 'Could not send message.');
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
      } catch (error) {
        console.error(`Error updating lastRead for DM ${dmId}:`, error);
        Alert.alert('Error', 'Could not update last read status.');
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
          Alert.alert('Error', 'Could not process messages updates.');
        }
      },
      (error) => {
        console.error('Error listening to DM messages:', error);
        Alert.alert('Error', 'Could not listen to messages.');
      },
    );

    return unsubscribe;
  }, []);

  // Fetch DMs and set up real-time listeners on mount
  useEffect(() => {
    fetchDirectMessages();

    const unsubscribe = listenToDirectMessages();

    return () => {
      if (unsubscribe) unsubscribe();
      console.log('DirectMessagesContext unmounted.');
    };
  }, [fetchDirectMessages, listenToDirectMessages]);

  return (
    <DirectMessagesContext.Provider
      value={{
        dms,
        messages,
        fetchDirectMessages,
        sendMessage,
        updateLastRead, // Provide the updateLastRead method
        listenToDirectMessages,
        listenToDMMessages,
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