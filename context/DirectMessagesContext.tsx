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
  getDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from './UserContext';
import { User } from '../types/User';

// Extend the DMChat interface to include participant details
interface DMChat {
  id: string; // e.g., 'userA_userB'
  participants: User[];
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

  // Helper function to fetch user details by UID
  const fetchUserDetails = async (uid: string): Promise<User> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          uid: userDoc.id,
          displayName: userData.displayName || 'Unnamed User',
          email: userData.email || 'no-email@example.com',
          photoURL: userData.photoURL,
        };
      } else {
        return {
          uid,
          displayName: 'Unknown User',
          email: 'unknown@example.com',
        };
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
      return {
        uid,
        displayName: 'Error Fetching User',
        email: 'error@example.com',
      };
    }
  };

  // Fetch direct message conversations with participant details
  const fetchDMs = async () => {
    if (!user?.uid) return;

    try {
      const dmQuery = query(
        collection(db, 'direct_messages'),
        where('participants', 'array-contains', user.uid),
      );
      const querySnapshot = await getDocs(dmQuery);

      const fetchedDMs: DMChat[] = await Promise.all(
        querySnapshot.docs.map(async (docSnap) => {
          const dmData = docSnap.data();
          const participantIds: string[] = dmData.participants;

          // Exclude the current user's UID to get other participants
          const otherParticipantIds = participantIds.filter(
            (id) => id !== user.uid,
          );

          // Fetch details for other participants
          const participants: User[] = await Promise.all(
            otherParticipantIds.map((uid) => fetchUserDetails(uid)),
          );

          return {
            id: docSnap.id,
            participants,
          };
        }),
      );

      setDms(fetchedDMs);
    } catch (error) {
      console.error('Error fetching direct messages:', error);
      Alert.alert('Error', 'Could not fetch direct messages.');
    }
  };

  // Listen to real-time updates in direct messages with participant details
  useEffect(() => {
    if (!user?.uid) return;

    const dmQuery = query(
      collection(db, 'direct_messages'),
      where('participants', 'array-contains', user.uid),
    );

    const unsubscribe = onSnapshot(
      dmQuery,
      async (querySnapshot) => {
        try {
          const fetchedDMs: DMChat[] = await Promise.all(
            querySnapshot.docs.map(async (docSnap) => {
              const dmData = docSnap.data();
              const participantIds: string[] = dmData.participants;

              // Exclude the current user's UID to get other participants
              const otherParticipantIds = participantIds.filter(
                (id) => id !== user.uid,
              );

              // Fetch details for other participants
              const participants: User[] = await Promise.all(
                otherParticipantIds.map((uid) => fetchUserDetails(uid)),
              );

              return {
                id: docSnap.id,
                participants,
              };
            }),
          );

          setDms(fetchedDMs);
        } catch (error) {
          console.error('Error processing direct messages snapshot:', error);
          Alert.alert('Error', 'Could not process direct messages updates.');
        }
      },
      (error) => {
        console.error('Error listening to direct messages:', error);
        Alert.alert('Error', 'Could not listen to direct messages.');
      },
    );

    // Fetch initial DMs with participant details
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
