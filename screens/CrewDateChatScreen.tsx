// screens/CrewDateChatScreen.tsx

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useLayoutEffect,
} from 'react';
import { View, StyleSheet } from 'react-native';
import { useCrewDateChat } from '../context/CrewDateChatContext';
import { useCrews } from '../context/CrewsContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavParamList } from '../navigation/AppNavigator';
import LoadingOverlay from '../components/LoadingOverlay';
import { GiftedChat, IMessage, Bubble } from 'react-native-gifted-chat';
import { useUser } from '../context/UserContext';
import moment from 'moment';

type CrewDateChatScreenProps = NativeStackScreenProps<
  NavParamList,
  'CrewDateChat'
>;

const CrewDateChatScreen: React.FC<CrewDateChatScreenProps> = ({
  route,
  navigation,
}) => {
  const { crewId, date } = route.params;
  const { messages, sendMessage, listenToMessages } = useCrewDateChat();
  const { crews, usersCache } = useCrews();
  const { user } = useUser(); // Current authenticated user
  const [chatMessages, setChatMessages] = useState<IMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Derive chatId from crewId and date
  const chatId = useMemo(() => generateChatId(crewId, date), [crewId, date]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: `${crewName} - ${formattedDate}`,
    });
  });

  useEffect(() => {
    const unsubscribe = listenToMessages(chatId);
    setLoading(false);
    return () => {
      unsubscribe();
    };
  }, [chatId]);

  useEffect(() => {
    const convoMessages = messages[chatId] || [];
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
  }, [messages, chatId, usersCache]);

  const onSend = useCallback(
    async (newMessages: IMessage[] = []) => {
      const text = newMessages[0].text;
      if (text && text.trim() !== '') {
        await sendMessage(chatId, text.trim());
      }
    },
    [chatId, sendMessage],
  );

  if (loading) {
    return <LoadingOverlay />;
  }

  // Get crew details
  const crew = crews.find((c) => c.id === crewId);
  const crewName = crew ? crew.name : 'Unknown Crew';
  const formattedDate = moment(date).format('MMMM Do, YYYY');

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

export default CrewDateChatScreen;

// Utility function to generate chatId
const generateChatId = (crewId: string, date: string): string => {
  return `${crewId}_${date}`; // e.g., 'crew123_2024-04-27'
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
