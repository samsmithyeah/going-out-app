// screens/CrewDateChatScreen.tsx

import React, {
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
  useCallback,
  useState,
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
import { useCrewDateChat } from '@/context/CrewDateChatContext';
import { useCrews } from '@/context/CrewsContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavParamList } from '@/navigation/AppNavigator';
import LoadingOverlay from '@/components/LoadingOverlay';
import { generateChatId } from '@/utils/chatHelpers';
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
import Toast from 'react-native-toast-message';
import { storage } from '@/storage'; // MMKV storage instance
import { User } from '@/types/User';

// Define Props
type CrewDateChatScreenProps = NativeStackScreenProps<
  NavParamList,
  'CrewDateChat'
>;

type RouteParams = {
  crewId: string;
  date: string; // Assuming date is a string
  id?: string; // Optional: If chat ID is provided
};

const TYPING_TIMEOUT = 3000;

const CrewDateChatScreen: React.FC<CrewDateChatScreenProps> = ({
  route,
  navigation,
}) => {
  const { crewId, date, id } = route.params as RouteParams;
  const {
    sendMessage,
    updateLastRead,
    messages,
    listenToMessages,
    getChatParticipantsCount,
  } = useCrewDateChat();
  const { crews, usersCache } = useCrews();
  const isFocused = useIsFocused();
  const tabBarHeight = useBottomTabBarHeight();
  const isFocusedRef = useRef(isFocused);
  const { user, addActiveChat, removeActiveChat } = useUser();
  const [otherMembers, setOtherMembers] = useState<User[]>([]);
  const [crew, setCrew] = useState<{
    name: string;
    iconUrl?: string;
  } | null>(null);

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  // Generate chatId using crewId and date
  const chatId = useMemo(() => {
    if (id) {
      return id;
    } else if (crewId && date) {
      return generateChatId(crewId, date);
    } else {
      return null;
    }
  }, [crewId, date, id]);

  // Fetch crew details
  useEffect(() => {
    if (!crewId) {
      setCrew({ name: 'Unknown Crew', iconUrl: undefined });
      return;
    }

    const fetchCrew = async () => {
      const crewData = crews.find((c) => c.id === crewId);
      if (crewData) {
        setCrew({ name: crewData.name, iconUrl: crewData.iconUrl });
      } else {
        // Optionally fetch from Firestore if not found in cache
        try {
          const crewDoc = await getDoc(doc(db, 'crews', crewId));
          if (crewDoc.exists()) {
            const data = crewDoc.data();
            setCrew({
              name: data.name || 'Unknown Crew',
              iconUrl: data.iconUrl,
            });
          } else {
            setCrew({ name: 'Unknown Crew', iconUrl: undefined });
          }
        } catch (error) {
          console.error('Error fetching crew details:', error);
          setCrew({ name: 'Unknown Crew', iconUrl: undefined });
        }
      }
    };

    fetchCrew();
  }, [crewId, crews]);

  // Fetch other members' details
  useEffect(() => {
    if (!chatId) return;

    const fetchMembers = async () => {
      try {
        const chatRef = doc(db, 'crew_date_chats', chatId);
        const chatSnap = await getDoc(chatRef);
        if (chatSnap.exists()) {
          const chatData = chatSnap.data();
          const memberIds: string[] = chatData.memberIds || [];
          const otherMemberIds = memberIds.filter((id) => id !== user?.uid);

          const fetchedMembers: User[] = await Promise.all(
            otherMemberIds.map((uid) => fetchUserDetails(uid)),
          );

          setOtherMembers(fetchedMembers);
        } else {
          setOtherMembers([]);
        }
      } catch (error) {
        console.error('Error fetching chat members:', error);
        setOtherMembers([]);
      }
    };

    fetchMembers();
  }, [chatId, user?.uid, fetchUserDetails]);

  // Set navigation title using useLayoutEffect after crew is fetched
  useLayoutEffect(() => {
    if (crew) {
      navigation.setOptions({
        headerTitle: crew.name,
      });
    }
  }, [navigation, crew]);

  async function fetchUserDetails(uid: string): Promise<User> {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return userDoc.data() as User;
      } else {
        console.warn(`User with uid ${uid} does not exist.`);
        return {
          uid,
          displayName: 'Unknown',
          email: '',
          photoURL: undefined,
        };
      }
    } catch (error) {
      console.error(`Error fetching user details for uid ${uid}:`, error);
      return {
        uid,
        displayName: 'Unknown',
        email: '',
        photoURL: undefined,
      };
    }
  }
  // Typing Timeout Handler
  let typingTimeout: NodeJS.Timeout;

  // Debounced function to update typing status in Firestore
  const updateTypingStatus = useMemo(
    () =>
      debounce(async (isTyping: boolean) => {
        if (!chatId || !user?.uid) return;
        const userUid = user.uid;
        const chatRef = doc(db, 'crew_date_chats', chatId);
        try {
          const chatSnap = await getDoc(chatRef);
          if (!chatSnap.exists()) {
            // Create the document with necessary fields
            await setDoc(
              chatRef,
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
            await updateDoc(chatRef, {
              [`typingStatus.${userUid}`]: isTyping,
              [`typingStatus.${userUid}LastUpdate`]: serverTimestamp(),
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

  // Fetch messages for this chat from context
  const conversationMessages = messages[chatId || ''] || [];

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
              : otherMembers.find((member) => member.uid === message.senderId)
                  ?.displayName || 'Unknown',
          avatar:
            message.senderId === user?.uid
              ? user?.photoURL
              : otherMembers.find((member) => member.uid === message.senderId)
                  ?.photoURL,
        },
      }))
      .reverse(); // GiftedChat expects newest first
  }, [
    conversationMessages,
    user?.uid,
    user?.displayName,
    user?.photoURL,
    otherMembers,
  ]);

  // Set up listener for messages via context
  useEffect(() => {
    if (!chatId) return;

    const unsubscribeMessages = listenToMessages(chatId);

    return () => {
      unsubscribeMessages();
    };
  }, [chatId, listenToMessages]);

  // Handle sending messages
  const onSend = useCallback(
    async (messages: IMessage[] = []) => {
      const text = messages[0].text;
      if (text && text.trim() !== '') {
        await sendMessage(chatId!, text.trim());

        // Reset typing status after sending
        updateTypingStatus(false);

        // Update lastRead since the user has viewed the latest message
        await updateLastRead(chatId!);
      }
    },
    [chatId, sendMessage, updateTypingStatus, updateLastRead],
  );

  // Update lastRead and manage active chats when screen focus changes
  useEffect(() => {
    if (isFocused && chatId) {
      updateLastRead(chatId);
      addActiveChat(chatId);
    } else if (!isFocused && chatId) {
      removeActiveChat(chatId);
    }
  }, [isFocused, chatId, updateLastRead, addActiveChat, removeActiveChat]);

  // AppState Listener to handle app backgrounding and foregrounding
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/active/) &&
        nextAppState.match(/inactive|background/)
      ) {
        // App has moved to the background or is inactive
        if (chatId) {
          removeActiveChat(chatId);
        }
      } else if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground
        if (isFocusedRef.current && chatId) {
          addActiveChat(chatId);
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
  }, [chatId, addActiveChat, removeActiveChat]);

  // Determine if other users are typing
  const isOtherUsersTyping = useMemo(() => {
    // Check if any message from other members includes 'typing...'
    return conversationMessages.some(
      (msg) =>
        otherMembers.some((member) => member.uid === msg.senderId) &&
        msg.text.toLowerCase().includes('typing...'),
    );
  }, [conversationMessages, otherMembers]);

  // Conditional return must be after all hooks
  if (!chatId) {
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
          isOtherUsersTyping ? (
            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>
                {otherMembers
                  .filter((member) =>
                    conversationMessages.some(
                      (msg) =>
                        msg.senderId === member.uid &&
                        msg.text.toLowerCase().includes('typing...'),
                    ),
                  )
                  .map((member) => member.displayName)
                  .join(', ')}{' '}
                {otherMembers.filter((member) =>
                  conversationMessages.some(
                    (msg) =>
                      msg.senderId === member.uid &&
                      msg.text.toLowerCase().includes('typing...'),
                  ),
                ).length === 1
                  ? 'is'
                  : 'are'}{' '}
                typing...
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
