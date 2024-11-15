// screens/DMChatScreen.tsx

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useDirectMessages } from '../context/DirectMessagesContext';
import { useCrews } from '../context/CrewsContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavParamList } from '../navigation/AppNavigator';
import ScreenTitle from '../components/ScreenTitle';
import LoadingOverlay from '../components/LoadingOverlay';
import {
  GiftedChat,
  IMessage,
  User as GiftedUser,
} from 'react-native-gifted-chat';
import { useUser } from '../context/UserContext'; // Assuming you have UserContext

type DMChatScreenProps = NativeStackScreenProps<NavParamList, 'DMChat'>;

type RouteParams = {
  conversationId: string;
  otherUserId: string;
};

const DMChatScreen: React.FC<
  NativeStackScreenProps<NavParamList, 'DMChat'>
> = ({ route, navigation }) => {
  const { conversationId, otherUserId } = route.params as RouteParams;
  const { messages, sendMessage, listenToMessages } = useDirectMessages();
  const { usersCache } = useCrews();
  const { user } = useUser(); // Current authenticated user
  const [chatMessages, setChatMessages] = useState<IMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = listenToMessages(conversationId);
    setLoading(false);
    return () => {
      unsubscribe();
    };
  }, [conversationId]);

  useEffect(() => {
    const convoMessages = messages[conversationId] || [];
    const formattedMessages: IMessage[] = convoMessages
      .map((msg) => ({
        _id: msg.id,
        text: msg.text,
        createdAt: msg.createdAt.toDate(),
        user: {
          _id: msg.senderId,
          name: usersCache[msg.senderId]?.displayName || 'Unknown',
          avatar: usersCache[msg.senderId]?.photoURL || undefined,
        },
      }))
      .reverse(); // GiftedChat expects newest first
    setChatMessages(formattedMessages);
  }, [messages, conversationId, usersCache]);

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
      <ScreenTitle title={usersCache[otherUserId]?.displayName || 'Chat'} />
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
        alwaysShowSend
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
