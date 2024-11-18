// screens/DMChatScreen.tsx

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useLayoutEffect,
} from 'react';
import { View, StyleSheet, Alert, Text } from 'react-native';
import { useDirectMessages } from '../context/DirectMessagesContext';
import { useCrews } from '../context/CrewsContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavParamList } from '../navigation/AppNavigator';
import LoadingOverlay from '../components/LoadingOverlay';
import { GiftedChat, IMessage, Bubble } from 'react-native-gifted-chat';
import { useUser } from '../context/UserContext';
import { generateDMConversationId } from '../helpers/chatUtils';
import {
  collection,
  doc,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import debounce from 'lodash/debounce';

type DMChatScreenProps = NativeStackScreenProps<NavParamList, 'DMChat'>;

type RouteParams = {
  otherUserId: string;
};

const TYPING_TIMEOUT = 5000; // 5 seconds in milliseconds

const DMChatScreen: React.FC<DMChatScreenProps> = ({ route, navigation }) => {
  const { otherUserId } = route.params as RouteParams;
  const { sendMessage } = useDirectMessages();
  const { crews, usersCache } = useCrews(); // Assuming crews might be used for avatars or other info
  const { user } = useUser(); // Current authenticated user
  const [chatMessages, setChatMessages] = useState<IMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [typingStatus, setTypingStatus] = useState<Record<string, boolean>>({});

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

  // Handle typing events
  const handleInputTextChanged = useCallback(
    (text: string) => {
      const isTyping = text.length > 0;
      setTypingStatus((prev) => ({
        ...prev,
        [user?.uid!]: isTyping,
      }));
      updateTypingStatus(isTyping);
    },
    [updateTypingStatus, user?.uid],
  );

  // Set up Firestore listener for messages and typing status in this conversation
  useEffect(() => {
    if (!conversationId) return;

    const convoRef = doc(db, 'direct_messages', conversationId);
    const messagesRef = collection(convoRef, 'messages');
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

    // Listen to typingStatus field
    const unsubscribeTyping = onSnapshot(
      convoRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          if (data.typingStatus) {
            const updatedTypingStatus: Record<string, boolean> = {};
            const now = Date.now();

            Object.keys(data.typingStatus).forEach((key) => {
              if (key.endsWith('LastUpdate')) return; // Skip timestamp fields

              const uid = key;
              const isTyping = data.typingStatus[uid];
              const lastUpdate =
                data.typingStatus[`${uid}LastUpdate`]?.toMillis() || 0;

              if (isTyping && now - lastUpdate < TYPING_TIMEOUT) {
                updatedTypingStatus[uid] = true;
              } else {
                updatedTypingStatus[uid] = false;
              }
            });

            setTypingStatus(updatedTypingStatus);
          }
        }
      },
      (error) => {
        console.error('Error listening to typing status:', error);
      },
    );

    setLoading(false);

    // Cleanup listener on unmount or when conversationId changes
    return () => {
      unsubscribe();
      unsubscribeTyping();
      updateTypingStatus.cancel(); // Cancel any pending debounced calls
      // Reset typing status when unmounting
      updateTypingStatus(false);
    };
  }, [
    conversationId,
    user?.uid,
    user?.displayName,
    user?.photoURL,
    otherUser.displayName,
    otherUser.photoURL,
    updateTypingStatus,
  ]);

  const onSend = useCallback(
    async (newMessages: IMessage[] = []) => {
      const text = newMessages[0].text;
      if (text && text.trim() !== '') {
        await sendMessage(conversationId, text.trim());
      }
      // After sending a message, ensure typing status is false
      setTypingStatus((prev) => ({
        ...prev,
        [user?.uid!]: false,
      }));
      updateTypingStatus(false);
    },
    [conversationId, sendMessage, updateTypingStatus, user?.uid],
  );

  if (loading) {
    return <LoadingOverlay />;
  }

  // Determine if the other user is typing
  const isOtherUserTyping =
    typingStatus[otherUserId] === true && otherUserId !== user?.uid; // Ensure it's not the current user

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
        onInputTextChanged={handleInputTextChanged}
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
