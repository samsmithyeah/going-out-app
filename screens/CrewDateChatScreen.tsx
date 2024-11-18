// screens/CrewDateChatScreen.tsx

import React, {
  useEffect,
  useReducer,
  useCallback,
  useMemo,
  useLayoutEffect,
  useRef,
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
import { useCrewDateChat } from '../context/CrewDateChatContext';
import { useCrews } from '../context/CrewsContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavParamList } from '../navigation/AppNavigator';
import LoadingOverlay from '../components/LoadingOverlay';
import { generateChatId } from '../helpers/chatUtils'; // Ensure this helper exists
import {
  collection,
  doc,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  setDoc,
  getDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import debounce from 'lodash/debounce';
import { MaterialIcons } from '@expo/vector-icons';
import moment from 'moment';
import { useFocusEffect } from '@react-navigation/native';

// Define Props
type CrewDateChatScreenProps = NativeStackScreenProps<
  NavParamList,
  'CrewDateChat'
>;

// Define State Interface
interface IState {
  messages: IMessage[];
  isTyping: boolean; // Current user typing status
  otherUsersTyping: { [key: string]: boolean }; // Other users typing status
}

// Define Action Types
enum ActionKind {
  SEND_MESSAGE = 'SEND_MESSAGE',
  SET_MESSAGES = 'SET_MESSAGES',
  SET_IS_TYPING = 'SET_IS_TYPING',
  SET_OTHER_USERS_TYPING = 'SET_OTHER_USERS_TYPING',
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
    case ActionKind.SET_OTHER_USERS_TYPING:
      return {
        ...state,
        otherUsersTyping: action.payload,
      };
    default:
      return state;
  }
}

const TYPING_TIMEOUT = 3000;

const CrewDateChatScreen: React.FC<CrewDateChatScreenProps> = ({
  route,
  navigation,
}) => {
  const { crewId, date, id } = route.params;
  const { sendMessage, updateLastRead } = useCrewDateChat(); // Import updateLastRead
  const { crews, usersCache } = useCrews();
  const { user } = useUser(); // Current authenticated user

  // Initialize Reducer
  const [state, dispatch] = useReducer(reducer, {
    messages: [],
    isTyping: false,
    otherUsersTyping: {},
  });

  const getChatId = () => {
    if (id) {
      return id;
    } else if (crewId && date) {
      return generateChatId(crewId, date);
    } else {
      return null;
    }
  };

  const getCrewId = () => {
    if (id) {
      return id.split('_')[0];
    } else {
      return crewId;
    }
  };

  // Derive chatId from crewId and date
  const chatId = useMemo(() => getChatId(), [crewId, date, id]);

  // Get crew details
  const crew = useMemo(
    () => crews.find((c) => c.id === getCrewId()),
    [crews, getCrewId],
  );

  const crewName = useMemo(() => (crew ? crew.name : 'Unknown Crew'), [crew]);
  const formattedDate = useMemo(
    () => moment(date).format('MMMM Do, YYYY'),
    [date],
  );

  // Typing Users - useMemo called unconditionally
  const typingUsers = useMemo(() => {
    const typingUserIds = Object.keys(state.otherUsersTyping).filter(
      (userId) => state.otherUsersTyping[userId],
    );
    return typingUserIds.map(
      (userId) => usersCache[userId]?.displayName || 'Someone',
    );
  }, [state.otherUsersTyping, usersCache]);

  // Set navigation title
  useLayoutEffect(() => {
    navigation.setOptions({
      title: `${crewName} - ${formattedDate}`,
    });
  }, [navigation, crewName, formattedDate]);

  // Ref for typing timeout
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced function to update typing status in Firestore
  const updateTypingStatus = useMemo(
    () =>
      debounce(async (isTyping: boolean) => {
        if (!chatId || !user?.uid) return;
        const chatRef = doc(db, 'crew_date_chats', chatId);
        try {
          const chatSnap = await getDoc(chatRef);
          if (!chatSnap.exists()) {
            // Create the document with necessary fields
            await setDoc(
              chatRef,
              {
                members: [user.uid], // Adjust based on your data structure
                typingStatus: {
                  [user.uid]: isTyping,
                  [`${user.uid}LastUpdate`]: serverTimestamp(),
                },
              },
              { merge: true }, // Merge to avoid overwriting existing fields
            );
          } else {
            // Update existing document
            await updateDoc(chatRef, {
              [`typingStatus.${user.uid}`]: isTyping,
              [`typingStatus.${user.uid}LastUpdate`]: serverTimestamp(),
            });
          }
        } catch (error) {
          console.error('Error updating typing status:', error);
        }
      }, 500),
    [chatId, user?.uid],
  );

  // Handle input text changes
  const handleInputTextChanged = useCallback(
    (text: string) => {
      const isTyping = text.length > 0;
      dispatch({ type: ActionKind.SET_IS_TYPING, payload: isTyping });
      updateTypingStatus(isTyping);

      if (isTyping) {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          dispatch({ type: ActionKind.SET_IS_TYPING, payload: false });
          updateTypingStatus(false);
          typingTimeoutRef.current = null;
        }, TYPING_TIMEOUT);
      } else {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
      }
    },
    [updateTypingStatus],
  );

  // Set up Firestore listener for messages and typing status
  useEffect(() => {
    if (!chatId) return;

    const chatRef = doc(db, 'crew_date_chats', chatId);
    const messagesRef = collection(chatRef, 'messages');
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
                  : usersCache[docSnap.data().senderId]?.displayName ||
                    'Unknown',
              avatar:
                docSnap.data().senderId === user?.uid
                  ? user?.photoURL
                  : usersCache[docSnap.data().senderId]?.photoURL,
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
      chatRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          if (data.typingStatus) {
            const updatedTypingStatus: { [key: string]: boolean } = {};
            Object.keys(data.typingStatus).forEach((key) => {
              if (key.endsWith('LastUpdate')) return; // Skip lastUpdate fields
              const userId = key;
              const isTyping = data.typingStatus[userId];
              const lastUpdate = data.typingStatus[`${userId}LastUpdate`];
              if (isTyping && lastUpdate) {
                const now = Date.now();
                const lastUpdateMillis = (lastUpdate as Timestamp).toMillis();
                if (now - lastUpdateMillis < TYPING_TIMEOUT) {
                  updatedTypingStatus[userId] = true;
                } else {
                  updatedTypingStatus[userId] = false;
                }
              } else {
                updatedTypingStatus[userId] = false;
              }
            });
            // Remove current user's typing status
            if (user?.uid) {
              delete updatedTypingStatus[user.uid];
            }
            dispatch({
              type: ActionKind.SET_OTHER_USERS_TYPING,
              payload: updatedTypingStatus,
            });
          }
        }
      },
      (error) => {
        console.error('Error listening to typing status:', error);
      },
    );

    // Cleanup listeners on unmount or when chatId changes
    return () => {
      unsubscribeMessages();
      unsubscribeTyping();
      updateTypingStatus.cancel(); // Cancel any pending debounced calls
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Reset typing status when unmounting
      dispatch({ type: ActionKind.SET_IS_TYPING, payload: false });
      updateTypingStatus(false);
    };
  }, [
    chatId,
    user?.uid,
    user?.displayName,
    user?.photoURL,
    usersCache,
    updateTypingStatus,
  ]);

  // Handle sending messages
  const onSend = useCallback(
    async (messages: IMessage[] = []) => {
      const text = messages[0].text;
      if (text && text.trim() !== '') {
        await sendMessage(chatId!, text.trim());
        // Reset typing status after sending
        dispatch({ type: ActionKind.SET_IS_TYPING, payload: false });
        updateTypingStatus(false);
        // Update lastRead since the user has viewed the latest message
        await updateLastRead(chatId!);
      }
    },
    [chatId, sendMessage, updateTypingStatus, updateLastRead],
  );

  // Update lastRead when the screen gains focus
  useFocusEffect(
    useCallback(() => {
      // Update lastRead when the screen is focused
      if (chatId) {
        updateLastRead(chatId);
      }

      // Optionally, handle any other focus-related logic here

      return () => {
        // Optional: Handle any cleanup when the screen loses focus
      };
    }, [chatId, updateLastRead]),
  );

  // Conditional return must be after all hooks
  if (!chatId) {
    return <LoadingOverlay />;
  }

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
        isTyping={state.isTyping} // Current user's typing status
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
          typingUsers.length > 0 ? (
            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>
                {typingUsers.join(', ')}{' '}
                {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
};

export default CrewDateChatScreen;

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
