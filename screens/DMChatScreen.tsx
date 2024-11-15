// screens/DMChatScreen.tsx

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useLayoutEffect,
} from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useDirectMessages } from '../context/DirectMessagesContext';
import { useCrews } from '../context/CrewsContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavParamList } from '../navigation/AppNavigator';
import LoadingOverlay from '../components/LoadingOverlay';
import { GiftedChat, IMessage, Bubble } from 'react-native-gifted-chat';
import { useUser } from '../context/UserContext';
import moment from 'moment';
import { generateDMConversationId } from '../helpers/chatUtils';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';

type DMChatScreenProps = NativeStackScreenProps<NavParamList, 'DMChat'>;

type RouteParams = {
  otherUserId: string;
};

const DMChatScreen: React.FC<DMChatScreenProps> = ({ route, navigation }) => {
  const { otherUserId } = route.params as RouteParams;
  const { sendMessage } = useDirectMessages();
  const { crews, usersCache } = useCrews(); // Assuming crews might be used for avatars or other info
  const { user } = useUser(); // Current authenticated user
  const [chatMessages, setChatMessages] = useState<IMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Generate conversationId using both user IDs
  const conversationId = useMemo(() => {
    if (!user?.uid || !otherUserId) return '';
    return generateDMConversationId(user.uid, otherUserId);
  }, [user?.uid, otherUserId]);

  const otherUser = useMemo(() => {
    if (!otherUserId) return { displayName: 'Unknown', photoURL: undefined };
    const otherUserFromCrews = usersCache[otherUserId];
    return (
      otherUserFromCrews || { displayName: 'Unknown', photoURL: undefined }
    );
  }, [crews, otherUserId]);

  // Set navigation title
  useLayoutEffect(() => {
    navigation.setOptions({
      title: otherUser.displayName,
    });
  }, [navigation, otherUser.displayName]);

  // Set up Firestore listener for messages in this conversation
  useEffect(() => {
    if (!conversationId) return;

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
        const msgs: IMessage[] = querySnapshot.docs
          .map((docSnap) => ({
            _id: docSnap.id,
            text: docSnap.data().text,
            createdAt: docSnap.data().createdAt.toDate(),
            user: {
              _id: docSnap.data().senderId,
              name:
                docSnap.data().senderId === user?.uid
                  ? user?.displayName || 'You'
                  : otherUser.displayName || 'Unknown',
              avatar:
                docSnap.data().senderId === user?.uid
                  ? user?.photoURL
                  : otherUser.photoURL,
            },
          }))
          .reverse(); // GiftedChat expects newest first
        setChatMessages(msgs);
      },
      (error) => {
        console.error('Error listening to messages:', error);
        Alert.alert('Error', 'Could not load messages.');
      },
    );

    setLoading(false);

    // Cleanup listener on unmount or when conversationId changes
    return () => {
      unsubscribe();
    };
  }, [
    conversationId,
    user?.uid,
    user?.displayName,
    user?.photoURL,
    otherUser.displayName,
    otherUser.photoURL,
  ]);

  const onSend = useCallback(
    async (newMessages: IMessage[] = []) => {
      const text = newMessages[0].text;
      if (text && text.trim() !== '') {
        await sendMessage(conversationId, text.trim());
      }
    },
    [conversationId, sendMessage],
  );

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <View style={styles.container}>
      <GiftedChat
        messages={chatMessages}
        onSend={(messages) => onSend(messages)}
        user={{
          _id: user?.uid || '',
          name: user?.displayName || 'You',
          avatar: user?.photoURL || undefined,
        }}
        placeholder="Type your message..."
        showUserAvatar
        bottomOffset={80}
        renderUsernameOnMessage
        renderBubble={(props) => {
          return (
            <Bubble
              {...props}
              wrapperStyle={{
                left: {
                  backgroundColor: '#BFF4BE',
                },
              }}
            />
          );
        }}
      />
    </View>
  );
};

export default DMChatScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
