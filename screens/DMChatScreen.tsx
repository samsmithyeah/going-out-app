// screens/DMChatScreen.tsx

import React, {
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { View, StyleSheet, Text, AppState, AppStateStatus } from 'react-native';
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
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/firebase';
import debounce from 'lodash/debounce';
import { MaterialIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

// Define Props
type DMChatScreenProps = NativeStackScreenProps<NavParamList, 'DMChat'>;

type RouteParams = {
  otherUserId: string;
};

const TYPING_TIMEOUT = 3000;

const DMChatScreen: React.FC<DMChatScreenProps> = ({ route, navigation }) => {
  const { otherUserId } = route.params as RouteParams;
  const { sendMessage, updateLastRead, messages, listenToDMMessages } =
    useDirectMessages();
  const { crews, usersCache } = useCrews();
  const isFocused = useIsFocused();
  const tabBarHeight = useBottomTabBarHeight();
  const isFocusedRef = useRef(isFocused);
  const { user, addActiveChat, removeActiveChat } = useUser();
  const [otherUser, setOtherUser] = useState<{
    displayName: string;
    photoURL?: string;
  } | null>(null);

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  // Generate conversationId using both user IDs
  const conversationId = useMemo(() => {
    if (!user?.uid || !otherUserId) return '';
    console.log('user.uid:', user.uid, 'otherUserId:', otherUserId);
    const generatedId = generateDMConversationId(user.uid, otherUserId);
    console.log('Generated conversationId:', generatedId);
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

  // Typing Timeout Handler
  let typingTimeout: NodeJS.Timeout;

  // Debounced function to update typing status in Firestore
  const updateTypingStatus = useMemo(
    () =>
      debounce(async (isTyping: boolean) => {
        if (!conversationId || !user?.uid) return;
        const userUid = user.uid;
        const convoRef = doc(db, 'direct_messages', conversationId);
        try {
          const chatSnap = await getDoc(convoRef);
          if (!chatSnap.exists()) {
            // Create the document with necessary fields
            await setDoc(
              convoRef,
              {
                typingStatus: {
                  [userUid]: isTyping,
                  [`${userUid}LastUpdate`]: serverTimestamp(),
                },
              },
              { merge: true },
            );
          } else {
            // Update existing document
            await updateDoc(convoRef, {
              typingStatus: {
                [userUid]: isTyping,
                [`${userUid}LastUpdate`]: serverTimestamp(),
              },
            });
          }
        } catch (error) {
          console.error('Error updating typing status:', error);
        }
      }, 500),
    [conversationId, user?.uid],
  );

  // Handle input text changes
  const handleInputTextChanged = useCallback(
    (text: string) => {
      const isTyping = text.length > 0;
      updateTypingStatus(isTyping);

      if (isTyping) {
        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
          updateTypingStatus(false);
        }, TYPING_TIMEOUT);
      } else {
        if (typingTimeout) clearTimeout(typingTimeout);
      }
    },
    [updateTypingStatus],
  );

  // Fetch messages for this conversation from context
  const conversationMessages = messages[conversationId] || [];

  // Log messages to debug
  useEffect(() => {
    console.log('Conversation Messages:', conversationMessages);
  }, [conversationMessages]);

  const giftedChatMessages: IMessage[] = useMemo(() => {
    return conversationMessages
      .map((message) => ({
        _id: message.id,
        text: message.text,
        createdAt:
          message.createdAt instanceof Date
            ? message.createdAt
            : new Date(message.createdAt), // Convert string to Date if necessary
        user: {
          _id: message.senderId,
          name:
            message.senderId === user?.uid
              ? user?.displayName || 'You'
              : otherUser?.displayName || 'Unknown',
          avatar:
            message.senderId === user?.uid
              ? user?.photoURL
              : otherUser?.photoURL,
        },
      }))
      .reverse(); // GiftedChat expects newest first
  }, [
    conversationMessages,
    user?.uid,
    user?.displayName,
    user?.photoURL,
    otherUser,
  ]);

  // Set up listener for messages via context
  useEffect(() => {
    if (!conversationId) return;

    const unsubscribeMessages = listenToDMMessages(conversationId);

    return () => {
      unsubscribeMessages();
    };
  }, [conversationId, listenToDMMessages]);

  // Handle sending messages
  const onSend = useCallback(
    async (messages: IMessage[] = []) => {
      const text = messages[0].text;
      if (text && text.trim() !== '') {
        await sendMessage(conversationId, text.trim());

        // Reset typing status after sending
        updateTypingStatus(false);

        // Update lastRead since the user has viewed the latest message
        await updateLastRead(conversationId);
      }
    },
    [conversationId, sendMessage, updateTypingStatus, updateLastRead],
  );

  // Update lastRead and manage active chats when screen focus changes
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

  // Determine if the other user is typing
  // Adjust this logic based on how typing status is managed in your context
  const isOtherUserTyping =
    messages[conversationId]?.some(
      (msg) =>
        msg.senderId === otherUserId &&
        msg.text.toLowerCase().includes('typing...'),
    ) || false;

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
        isTyping={false} // Control isTyping via custom logic
        onInputTextChanged={handleInputTextChanged} // Manage typing state
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
        renderFooter={() =>
          isOtherUserTyping ? (
            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>
                {otherUser?.displayName} is typing...
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
};

export default DMChatScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  footerContainer: {
    marginTop: 5,
    marginLeft: 10,
    marginBottom: 10,
  },
  footerText: {
    fontSize: 14,
    color: '#aaa',
  },
});
