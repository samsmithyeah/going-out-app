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
  orderBy,
  onSnapshot,
  Unsubscribe,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from './UserContext';

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: Timestamp;
}

interface Conversation {
  id: string;
  participants: string[]; // Array of user UIDs
  latestMessage?: Message;
}

interface DirectMessagesContextProps {
  conversations: Conversation[];
  messages: { [conversationId: string]: Message[] };
  fetchConversations: () => Promise<void>;
  sendMessage: (conversationId: string, text: string) => Promise<void>;
  listenToConversations: () => Unsubscribe | null;
  listenToMessages: (conversationId: string) => Unsubscribe;
}

const DirectMessagesContext = createContext<
  DirectMessagesContextProps | undefined
>(undefined);

export const DirectMessagesProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useUser();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<{
    [conversationId: string]: Message[];
  }>({});

  // Fetch conversations where user is a participant
  const fetchConversations = async () => {
    if (!user?.uid) return;

    try {
      const q = query(
        collection(db, 'direct_messages'),
        where('participants', 'array-contains', user.uid),
        orderBy('latestMessage.createdAt', 'desc'),
      );
      const querySnapshot = await getDocs(q);
      const convs: Conversation[] = querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        participants: docSnap.data().participants,
        latestMessage: docSnap.data().latestMessage,
      }));
      setConversations(convs);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      Alert.alert('Error', 'Could not fetch conversations.');
    }
  };

  // Listen to real-time updates in conversations
  const listenToConversations = () => {
    if (!user?.uid) return null;

    const q = query(
      collection(db, 'direct_messages'),
      where('participants', 'array-contains', user.uid),
      orderBy('latestMessage.createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const convs: Conversation[] = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          participants: docSnap.data().participants,
          latestMessage: docSnap.data().latestMessage,
        }));
        setConversations(convs);
      },
      (error) => {
        console.error('Error listening to conversations:', error);
      },
    );

    return unsubscribe;
  };

  // Send a message in a conversation
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

      // Update latestMessage in conversation
      const conversationRef = doc(db, 'direct_messages', conversationId);
      await updateDoc(conversationRef, {
        latestMessage: newMessage,
      });
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Could not send message.');
    }
  };

  // Listen to real-time updates in messages of a conversation
  const listenToMessages = (conversationId: string) => {
    const messagesRef = collection(
      db,
      'direct_messages',
      conversationId,
      'messages',
    );
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
          [conversationId]: msgs,
        }));
      },
      (error) => {
        console.error('Error listening to messages:', error);
      },
    );

    return unsubscribe;
  };

  useEffect(() => {
    fetchConversations();

    const unsubscribe = listenToConversations();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid]);

  return (
    <DirectMessagesContext.Provider
      value={{
        conversations,
        messages,
        fetchConversations,
        sendMessage,
        listenToConversations,
        listenToMessages,
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
