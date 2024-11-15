// context/CrewDateChatContext.tsx

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
  orderBy,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from './UserContext';
import { Crew } from '../types/Crew';

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: Timestamp;
}

interface CrewDateChat {
  id: string; // e.g., 'crew123_2024-04-27'
}

interface CrewDateChatContextProps {
  chats: CrewDateChat[];
  messages: { [chatId: string]: Message[] };
  fetchChats: () => Promise<void>;
  sendMessage: (chatId: string, text: string) => Promise<void>;
  listenToChats: () => Unsubscribe | null;
  listenToMessages: (chatId: string) => Unsubscribe;
}

const CrewDateChatContext = createContext<CrewDateChatContextProps | undefined>(
  undefined,
);

export const CrewDateChatProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useUser();
  const [chats, setChats] = useState<CrewDateChat[]>([]);
  const [messages, setMessages] = useState<{ [chatId: string]: Message[] }>({});

  // Fetch crew date chats where user is a member and up for that date
  const fetchChats = async () => {
    if (!user?.uid) return;

    try {
      const q = query(
        collection(db, 'crew_date_chats'),
        where('members', 'array-contains', user.uid),
      );
      const querySnapshot = await getDocs(q);
      const fetchedChats: CrewDateChat[] = querySnapshot.docs.map(
        (docSnap) => ({
          id: docSnap.id,
        }),
      );
      setChats(fetchedChats);
    } catch (error) {
      console.error('Error fetching crew date chats:', error);
      Alert.alert('Error', 'Could not fetch crew date chats.');
    }
  };

  // Listen to real-time updates in crew date chats
  const listenToChats = () => {
    if (!user?.uid) return null;

    const q = query(
      collection(db, 'crew_date_chats'),
      where('members', 'array-contains', user.uid),
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const fetchedChats: CrewDateChat[] = querySnapshot.docs.map(
          (docSnap) => ({
            id: docSnap.id,
          }),
        );
        setChats(fetchedChats);
      },
      (error) => {
        console.error('Error listening to crew date chats:', error);
      },
    );

    return unsubscribe;
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
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Could not send message.');
    }
  };

  // Listen to real-time updates in messages of a crew date chat
  const listenToMessages = (chatId: string) => {
    const messagesRef = collection(db, 'crew_date_chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const msgs: Message[] = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          senderId: docSnap.data().senderId,
          text: docSnap.data().text,
          createdAt: docSnap.data().createdAt,
        }));
        setMessages((prev) => ({
          ...prev,
          [chatId]: msgs,
        }));
      },
      (error) => {
        console.error('Error listening to messages:', error);
      },
    );

    return unsubscribe;
  };

  useEffect(() => {
    fetchChats();

    const unsubscribe = listenToChats();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid]);

  return (
    <CrewDateChatContext.Provider
      value={{
        chats,
        messages,
        fetchChats,
        sendMessage,
        listenToChats,
        listenToMessages,
      }}
    >
      {children}
    </CrewDateChatContext.Provider>
  );
};

export const useCrewDateChat = () => {
  const context = useContext(CrewDateChatContext);
  if (!context) {
    throw new Error(
      'useCrewDateChat must be used within a CrewDateChatProvider',
    );
  }
  return context;
};
