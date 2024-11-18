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
  onSnapshot,
  getDoc,
  doc,
  Unsubscribe,
  orderBy,
  DocumentData,
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

// Extend the CrewDateChat interface to include member details and crewName
interface CrewDateChat {
  id: string; // e.g., 'crew123_2024-04-27'
  crewId: string; // Extracted crewId
  members: User[];
  crewName: string; // Fetched from crews collection
  avatarUrl?: string; // Optional: Include avatar URL
}

// Define the context properties
interface CrewDateChatContextProps {
  chats: CrewDateChat[];
  messages: { [chatId: string]: Message[] };
  fetchChats: () => Promise<void>;
  sendMessage: (chatId: string, text: string) => Promise<void>;
  listenToChats: () => () => void;
  listenToMessages: (chatId: string) => () => void;
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
        const user: User = {
          uid: userDoc.id,
          displayName: userData.displayName || 'Unnamed User',
          email: userData.email || '',
          photoURL: userData.photoURL,
        };
        setUsersCache((prev) => ({ ...prev, [uid]: user }));
        return user;
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

  // Fetch crew date chats with member details and crewName
  const fetchChats = async () => {
    if (!user?.uid) return;

    try {
      // Debugging: Log all crews
      console.log('All Crews:', crews);

      // Filter crews where the user is a member
      const userCrews = crews.filter(
        (crew) => crew.memberIds.includes(user.uid), // Correct field name
      );
      console.log('User Crews:', userCrews);

      const crewIds = userCrews.map((crew) => crew.id);
      console.log('Crew IDs:', crewIds);

      if (crewIds.length === 0) {
        setChats([]);
        console.log('No crews found for the user.');
        return;
      }

      // Firestore 'in' queries can handle a maximum of 10 elements
      const CHUNK_SIZE = 10;
      const crewIdChunks = chunkArray(crewIds, CHUNK_SIZE);
      console.log('Crew ID Chunks:', crewIdChunks);

      const fetchedChats: CrewDateChat[] = [];

      for (const chunk of crewIdChunks) {
        // Fetch chats for each crewId in the chunk
        const chatsPromises = chunk.map((crewId) => fetchChatsForCrew(crewId));

        const chatsArrays = await Promise.all(chatsPromises);

        // Flatten the array of arrays and map to CrewDateChat
        for (const chats of chatsArrays) {
          for (const chatData of chats) {
            const memberIds: string[] = chatData.members;

            // Exclude the current user's UID to get other members
            const otherMemberIds = memberIds.filter((id) => id !== user.uid);

            // Fetch details for other members
            const members: User[] = await Promise.all(
              otherMemberIds.map((uid) => fetchUserDetails(uid)),
            );

            // Extract crewId from chatId (document ID)
            const [crewId] = chatData.id.split('_');

            // Fetch crewName from crews collection
            const crew = crews.find((c) => c.id === crewId);
            const crewName = crew ? crew.name : 'Unknown Crew';

            fetchedChats.push({
              id: chatData.id,
              crewId: crewId,
              members,
              crewName,
              avatarUrl: crew?.iconUrl, // Ensure 'iconUrl' exists in your crew documents
            } as CrewDateChat);
          }
        }
      }

      console.log('Fetched Chats:', fetchedChats);
      console.log(
        'Fetched chats crew names:',
        fetchedChats.map((c) => c.crewName),
      );
      console.log(
        'Fetched chats chat IDs:',
        fetchedChats.map((c) => c.id),
      );
      setChats(fetchedChats);
    } catch (error) {
      console.error('Error fetching crew date chats:', error);
      Alert.alert('Error', 'Could not fetch crew date chats.');
    }
  };

  // Helper function to listen to chats for a single crewId
  const listenToChatsForCrew = (
    crewId: string,
    callback: (chats: DocumentData[]) => void,
  ): Unsubscribe => {
    const startId = `${crewId}_`;
    const endId = `${crewId}_\uf8ff`;

    const chatQuery = query(
      collection(db, 'crew_date_chats'),
      where('__name__', '>=', startId),
      where('__name__', '<=', endId),
    );

    return onSnapshot(chatQuery, (querySnapshot) => {
      const chats: DocumentData[] = [];
      querySnapshot.forEach((doc) => {
        chats.push({ id: doc.id, ...doc.data() });
      });
      callback(chats);
    });
  };

  // Listen to real-time updates in crew date chats with member details and crewName
  const listenToChats = () => {
    if (!user?.uid) return () => {};

    // Filter crews where the user is a member
    const userCrews = crews.filter(
      (crew) => crew.memberIds.includes(user.uid), // Correct field name
    );
    const crewIds = userCrews.map((crew) => crew.id);

    console.log('Listening to Chats for Crew IDs:', crewIds);

    if (crewIds.length === 0) {
      setChats([]);
      console.log('No crews to listen for.');
      return () => {};
    }

    const unsubscribeFunctions: Unsubscribe[] = [];

    crewIds.forEach((crewId) => {
      const unsubscribe = listenToChatsForCrew(crewId, async (chats) => {
        const chatsBatch: CrewDateChat[] = [];

        for (const chatData of chats) {
          const memberIds: string[] = chatData.members;

          // Exclude the current user's UID to get other members
          const otherMemberIds = memberIds.filter((id) => id !== user.uid);

          // Fetch details for other members
          const members: User[] = await Promise.all(
            otherMemberIds.map((uid) => fetchUserDetails(uid)),
          );

          // Extract crewId from chatId (document ID)
          const [extractedCrewId] = chatData.id.split('_');

          // Fetch crewName from crews collection
          const crew = crews.find((c) => c.id === extractedCrewId);
          const crewName = crew ? crew.name : 'Unknown Crew';

          chatsBatch.push({
            id: chatData.id,
            crewId: extractedCrewId,
            members,
            crewName,
            avatarUrl: crew?.iconUrl, // Ensure 'iconUrl' exists in your crew documents
          } as CrewDateChat);
        }

        setChats((prevChats) => {
          // Merge existing chats with the new batch, avoiding duplicates
          const mergedChats = [...prevChats];
          chatsBatch.forEach((chat) => {
            const index = mergedChats.findIndex((c) => c.id === chat.id);
            if (index !== -1) {
              mergedChats[index] = chat;
            } else {
              mergedChats.push(chat);
            }
          });
          return mergedChats;
        });
      });

      unsubscribeFunctions.push(unsubscribe);
    });

    // Cleanup function to unsubscribe all listeners
    return () => {
      unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
      console.log('Unsubscribed from all crew date chat listeners.');
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
      console.log(`Message sent in chat ${chatId}: "${text}"`);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Could not send message.');
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
        listenToChats,
        listenToMessages,
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
