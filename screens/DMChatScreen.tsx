// screens/DMChatScreen.tsx

import React, {
  useEffect,
  useReducer,
  useCallback,
  useMemo,
  useLayoutEffect,
} from 'react';
import { View, StyleSheet, Alert, Text } from 'react-native';
import {
  GiftedChat,
  IMessage,
  Bubble,
  Send,
  SendProps,
} from 'react-native-gifted-chat';
import { useUser } from '../context/UserContext';
import { useDirectMessages } from '../context/DirectMessagesContext';
import { useCrews } from '../context/CrewsContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavParamList } from '../navigation/AppNavigator';
import LoadingOverlay from '../components/LoadingOverlay';
import { generateDMConversationId } from '../helpers/chatUtils';
import {
  collection,
  doc,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import debounce from 'lodash/debounce';
import { MaterialIcons } from '@expo/vector-icons';

// Define Props
type DMChatScreenProps = NativeStackScreenProps<NavParamList, 'DMChat'>;

type RouteParams = {
  otherUserId: string;
};

// Define State Interface
interface IState {
  messages: IMessage[];
  isTyping: boolean; // Current user typing status
  otherUserIsTyping: boolean; // Other user typing status
}

// Define Action Types
enum ActionKind {
  SEND_MESSAGE = 'SEND_MESSAGE',
  SET_MESSAGES = 'SET_MESSAGES',
  SET_IS_TYPING = 'SET_IS_TYPING',
  SET_OTHER_USER_IS_TYPING = 'SET_OTHER_USER_IS_TYPING',
}

// Define Action Interface
interface StateAction {
  type: ActionKind;
  payload?: any;
}

// Reducer Function
function reducer(state: IState, action: StateAction): IState {
  switch (action.type) {
    case ActionKind.SEND_MESSAGE:
      return {
        ...state,
        messages: GiftedChat.append(state.messages, action.payload),
      };
    case ActionKind.SET_MESSAGES:
      return {
        ...state,
        messages: action.payload,
      };
    case ActionKind.SET_IS_TYPING:
      return {
        ...state,
        isTyping: action.payload,
      };
    case ActionKind.SET_OTHER_USER_IS_TYPING:
      return {
        ...state,
        otherUserIsTyping: action.payload,
      };
    default:
      return state;
  }
}
// screens/DMChatScreen.tsx

const TYPING_TIMEOUT = 3000;

const DMChatScreen: React.FC<DMChatScreenProps> = ({ route, navigation }) => {
  const { otherUserId } = route.params as RouteParams;
  const { sendMessage } = useDirectMessages();
  const { crews, usersCache } = useCrews();
  const { user } = useUser(); // Current authenticated user

  // Initialize Reducer
  const [state, dispatch] = useReducer(reducer, {
    messages: [],
    isTyping: false,
    otherUserIsTyping: false,
  });

  // Generate conversationId using both user IDs
  const conversationId = useMemo(() => {
    if (!user?.uid || !otherUserId) return '';
    console.log('user.uid:', user.uid, 'otherUserId:', otherUserId);
    const generatedId = generateDMConversationId(user.uid, otherUserId);
    console.log('Generated conversationId:', generatedId);
    return generatedId;
    //return generateDMConversationId(user.uid, otherUserId);
  }, [user?.uid, otherUserId]);

  // Get Other User Details
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

  // Typing Timeout Handler
  let typingTimeout: NodeJS.Timeout;

  // Debounced function to update typing status in Firestore
  const updateTypingStatus = useMemo(
    () =>
      debounce(async (isTyping: boolean) => {
        if (!conversationId || !user?.uid) return;
        const convoRef = doc(db, 'direct_messages', conversationId);
        try {
          await updateDoc(convoRef, {
            [`typingStatus.${user.uid}`]: isTyping,
            [`typingStatus.${user.uid}LastUpdate`]: serverTimestamp(),
          });
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
      dispatch({ type: ActionKind.SET_IS_TYPING, payload: isTyping });
      updateTypingStatus(isTyping);

      if (isTyping) {
        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
          dispatch({ type: ActionKind.SET_IS_TYPING, payload: false });
          updateTypingStatus(false);
        }, TYPING_TIMEOUT);
      } else {
        if (typingTimeout) clearTimeout(typingTimeout);
      }
    },
    [updateTypingStatus],
  );

  // Set up Firestore listener for messages and typing status
  useEffect(() => {
    if (!conversationId) return;

    const convoRef = doc(db, 'direct_messages', conversationId);
    const messagesRef = collection(convoRef, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    // Listen to messages
    const unsubscribeMessages = onSnapshot(
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
        dispatch({ type: ActionKind.SET_MESSAGES, payload: msgs });
      },
      (error) => {
        console.error('Error listening to messages:', error);
        Alert.alert('Error', 'Could not load messages.');
      },
    );

    // Listen to typingStatus field
    const unsubscribeTyping = onSnapshot(
      convoRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          if (data.typingStatus) {
            const otherUserTypingStatus = data.typingStatus[otherUserId];
            const lastUpdate = data.typingStatus[`${otherUserId}LastUpdate`];

            if (otherUserTypingStatus && lastUpdate) {
              const now = Date.now();
              const lastUpdateMillis = (lastUpdate as Timestamp).toMillis();
              if (now - lastUpdateMillis < TYPING_TIMEOUT) {
                dispatch({
                  type: ActionKind.SET_OTHER_USER_IS_TYPING,
                  payload: true,
                });
                return;
              }
            }
            dispatch({
              type: ActionKind.SET_OTHER_USER_IS_TYPING,
              payload: false,
            });
          }
        }
      },
      (error) => {
        console.error('Error listening to typing status:', error);
      },
    );

    // Cleanup listeners on unmount or when conversationId changes
    return () => {
      unsubscribeMessages();
      unsubscribeTyping();
      updateTypingStatus.cancel(); // Cancel any pending debounced calls
      if (typingTimeout) clearTimeout(typingTimeout);
      // Reset typing status when unmounting
      dispatch({ type: ActionKind.SET_IS_TYPING, payload: false });
      updateTypingStatus(false);
    };
  }, [
    conversationId,
    otherUserId,
    user?.uid,
    user?.displayName,
    user?.photoURL,
    otherUser.displayName,
    otherUser.photoURL,
    updateTypingStatus,
  ]);

  // Handle sending messages
  const onSend = useCallback(
    async (messages: IMessage[] = []) => {
      const text = messages[0].text;
      if (text && text.trim() !== '') {
        await sendMessage(conversationId, text.trim());

        // Reset typing status after sending
        dispatch({ type: ActionKind.SET_IS_TYPING, payload: false });
        updateTypingStatus(false);
      }
    },
    [conversationId, sendMessage, updateTypingStatus],
  );

  if (!conversationId) {
    return <LoadingOverlay />;
  }

  // Determine if the other user is typing
  const isOtherUserTyping =
    state.otherUserIsTyping && otherUserId !== user?.uid;

  return (
    <View style={styles.container}>
      <GiftedChat
        messages={state.messages}
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
        isTyping={state.isTyping} // Using isTyping prop
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
            <MaterialIcons size={30} color={'tomato'} name={'send'} />
          </Send>
        )}
        renderFooter={() =>
          isOtherUserTyping ? (
            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>
                {otherUser.displayName} is typing...
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
