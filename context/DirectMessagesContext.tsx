// context/DirectMessagesContext.tsx

import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
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
} from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from './UserContext';

interface DMChat {
  id: string; // e.g., 'userA_userB'
}

interface DirectMessagesContextProps {
  dms: DMChat[];
  sendMessage: (conversationId: string, text: string) => Promise<void>;
}

const DirectMessagesContext = createContext<
  DirectMessagesContextProps | undefined
>(undefined);

export const DirectMessagesProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useUser();
  const [dms, setDms] = useState<DMChat[]>([]);

  // Fetch direct message conversations where the user is a participant
  const fetchDMs = async () => {
    if (!user?.uid) return;

    try {
      const q = query(
        collection(db, 'direct_messages'),
        where('participants', 'array-contains', user.uid),
      );
      const querySnapshot = await getDocs(q);
      const fetchedDMs: DMChat[] = querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
      }));
      setDms(fetchedDMs);
    } catch (error) {
      console.error('Error fetching direct messages:', error);
      Alert.alert('Error', 'Could not fetch direct messages.');
    }
  };

  // Listen to real-time updates in direct messages
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'direct_messages'),
      where('participants', 'array-contains', user.uid),
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const fetchedDMs: DMChat[] = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
        }));
        setDms(fetchedDMs);
      },
      (error) => {
        console.error('Error listening to direct messages:', error);
        Alert.alert('Error', 'Could not listen to direct messages.');
      },
    );

    // Fetch initial DMs
    fetchDMs();

    return () => {
      unsubscribe();
    };
  }, [user?.uid]);

  // Send a message in a direct conversation
  const sendMessage = async (conversationId: string, text: string) => {
    if (!user?.uid) return;

    try {
      const messagesRef = collection(
        db,
        'direct_messages',
        conversationId,
        'messages',
      );
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
  };

  return (
    <DirectMessagesContext.Provider
      value={{
        dms,
        sendMessage,
      }}
    >
      {children}
    </DirectMessagesContext.Provider>
  );
};

export const useDirectMessages = () => {
  const context = useContext(DirectMessagesContext);
  if (!context) {
    throw new Error(
      'useDirectMessages must be used within a DirectMessagesProvider',
    );
  }
  return context;
};
