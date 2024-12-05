// screens/DMChatScreen.tsx

import React, {
  useEffect,
  useMemo,
  useLayoutEffect,
  useState,
  useRef,
} from 'react';
import { View, StyleSheet, AppState, AppStateStatus } from 'react-native';
import {
  GiftedChat,
  IMessage,
  Bubble,
  Send,
  SendProps,
} from 'react-native-gifted-chat';
import { useUser } from '@/context/UserContext';
import { useDirectMessages } from '@/context/DirectMessagesContext';
import { useCrews } from '@/context/CrewsContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavParamList } from '@/navigation/AppNavigator';
import LoadingOverlay from '@/components/LoadingOverlay';
import { generateDMConversationId } from '@/utils/chatHelpers';
import { MaterialIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { db } from '@/firebase';
import { getDoc, doc } from 'firebase/firestore';

// Define Props
type DMChatScreenProps = NativeStackScreenProps<NavParamList, 'DMChat'>;

type RouteParams = {
  otherUserId: string;
};

const DMChatScreen: React.FC<DMChatScreenProps> = ({ route, navigation }) => {
  const { otherUserId } = route.params as RouteParams;
  const { sendMessage, updateLastRead, messages, listenToDMMessages } =
    useDirectMessages();
  const { crews, usersCache } = useCrews();
  const isFocused = useIsFocused();
  const tabBarHeight = useBottomTabBarHeight();
  const { user, addActiveChat, removeActiveChat } = useUser();
  const [otherUser, setOtherUser] = useState<{
    displayName: string;
    photoURL?: string;
  } | null>(null);

  const isFocusedRef = useRef(isFocused);

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  // Generate conversationId using both user IDs
  const conversationId = useMemo(() => {
    if (!user?.uid || !otherUserId) return '';
    const generatedId = generateDMConversationId(user.uid, otherUserId);
    return generatedId;
  }, [user?.uid, otherUserId]);

  useEffect(() => {
    let isMounted = true; // To prevent state updates if the component is unmounted

    const fetchOtherUser = async () => {
      if (!otherUserId) {
        console.log('No otherUserId provided');
        if (isMounted) {
          setOtherUser({ displayName: 'Unknown', photoURL: undefined });
        }
        return;
      }

      const otherUserFromCrews = usersCache[otherUserId];
      if (otherUserFromCrews) {
        if (isMounted) setOtherUser(otherUserFromCrews);
      } else {
        try {
          // Fetch user details from Firestore
          const userDoc = await getDoc(doc(db, 'users', otherUserId));
          if (isMounted) {
            setOtherUser(
              userDoc.exists()
                ? (userDoc.data() as { displayName: string; photoURL?: string })
                : { displayName: 'Unknown', photoURL: undefined },
            );
          }
        } catch (error) {
          console.error('Error fetching other user:', error);
          if (isMounted) {
            setOtherUser({ displayName: 'Unknown', photoURL: undefined });
          }
        }
      }
    };

    fetchOtherUser();

    return () => {
      isMounted = false; // Cleanup flag
    };
  }, [crews, otherUserId, usersCache]);

  // Set navigation title using useLayoutEffect after otherUser is fetched
  useLayoutEffect(() => {
    if (otherUser) {
      navigation.setOptions({
        title: otherUser.displayName,
      });
    }
  }, [navigation, otherUser]);

  // Fetch messages for this conversation from context
  const conversationMessages = messages[conversationId] || [];

  const giftedChatMessages: IMessage[] = conversationMessages
    .map((message) => ({
      _id: message.id,
      text: message.text,
      createdAt: message.createdAt ? message.createdAt.toDate() : new Date(),
      user: {
        _id: message.senderId,
        name:
          message.senderId === user?.uid
            ? user?.displayName || 'You'
            : otherUser?.displayName || 'Unknown',
        avatar:
          message.senderId === user?.uid ? user?.photoURL : otherUser?.photoURL,
      },
    }))
    .reverse(); // GiftedChat expects newest first

  // Set up listener for messages via context
  useEffect(() => {
    if (!conversationId) return;

    const unsubscribeMessages = listenToDMMessages(conversationId);

    return () => {
      unsubscribeMessages();
    };
  }, [conversationId, listenToDMMessages]);

  // Handle sending messages
  const onSend = async (messages: IMessage[] = []) => {
    const text = messages[0].text;
    if (text && text.trim() !== '') {
      await sendMessage(conversationId, text.trim());

      // Update lastRead since the user has viewed the latest message
      await updateLastRead(conversationId);
    }
  };

  // Update lastRead when the screen gains focus
  useEffect(() => {
    if (isFocused && conversationId) {
      updateLastRead(conversationId);
      addActiveChat(conversationId);
    } else if (!isFocused && conversationId) {
      removeActiveChat(conversationId);
    }
  }, [
    isFocused,
    conversationId,
    updateLastRead,
    addActiveChat,
    removeActiveChat,
  ]);

  // AppState Listener to handle app backgrounding
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/active/) &&
        nextAppState.match(/inactive|background/)
      ) {
        // App has moved to the background or is inactive
        if (conversationId) {
          removeActiveChat(conversationId);
        }
      } else if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground
        if (isFocusedRef.current && conversationId) {
          addActiveChat(conversationId);
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, [conversationId, addActiveChat, removeActiveChat]);

  if (!conversationId) {
    return <LoadingOverlay />;
  }

  return (
    <View style={styles.container}>
      <GiftedChat
        messages={giftedChatMessages}
        onSend={(messages) => onSend(messages)}
        user={{
          _id: user?.uid || '',
          name: user?.displayName || 'You',
          avatar: user?.photoURL || undefined,
        }}
        bottomOffset={tabBarHeight}
        renderBubble={(props) => (
          <Bubble
            {...props}
            wrapperStyle={{
              left: {
                backgroundColor: '#BFF4BE',
              },
            }}
          />
        )}
        renderSend={(props: SendProps<IMessage>) => (
          <Send
            {...props}
            containerStyle={{ justifyContent: 'center', paddingHorizontal: 10 }}
          >
            <MaterialIcons size={30} color={'#1E90FF'} name={'send'} />
          </Send>
        )}
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
