// screens/ChatsListScreen.tsx

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useDirectMessages } from '@/context/DirectMessagesContext';
import { useCrewDateChat } from '@/context/CrewDateChatContext';
import { useCrews } from '@/context/CrewsContext';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { NavParamList } from '@/navigation/AppNavigator';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  getDoc,
  doc,
} from 'firebase/firestore';
import { db } from '@/firebase';
import moment from 'moment';
import { useUser } from '@/context/UserContext';
import ScreenTitle from '@/components/ScreenTitle';
import CustomSearchInput from '@/components/CustomSearchInput';
import globalStyles from '@/styles/globalStyles';

import ProfilePicturePicker from '@/components/ProfilePicturePicker';

interface CombinedChat {
  id: string;
  type: 'direct' | 'group';
  title: string;
  iconUrl?: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  lastMessageSenderId?: string;
  lastMessageSenderName?: string; // New field for sender's displayName
  unreadCount: number;
}

const ChatsListScreen: React.FC = () => {
  const { dms, fetchUnreadCount: fetchDMUnreadCount } = useDirectMessages();
  const { chats: groupChats, fetchUnreadCount: fetchGroupUnreadCount } =
    useCrewDateChat();
  const { crews } = useCrews();
  const { user } = useUser();
  const navigation = useNavigation<NavigationProp<NavParamList>>();

  const [combinedChats, setCombinedChats] = useState<CombinedChat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>(''); // State for search query
  const [filteredChats, setFilteredChats] = useState<CombinedChat[]>([]); // State for filtered chats

  // Cache to store senderId and displayName
  const senderNameCache = useRef<{ [senderId: string]: string }>({});

  // Function to fetch sender's displayName with caching
  const getSenderName = useCallback(
    async (senderId: string): Promise<string> => {
      if (senderNameCache.current[senderId]) {
        return senderNameCache.current[senderId];
      }
      try {
        const senderDoc = await getDoc(doc(db, 'users', senderId));
        if (senderDoc.exists()) {
          const senderData = senderDoc.data();
          const senderName = senderData.displayName || 'Unknown';
          senderNameCache.current[senderId] = senderName;
          return senderName;
        } else {
          return 'Unknown';
        }
      } catch (error) {
        console.error(`Error fetching sender name for ${senderId}:`, error);
        return 'Unknown';
      }
    },
    [],
  );

  // Helper function to fetch the last message along with sender's displayName
  const fetchLastMessage = async (
    chatId: string,
    chatType: 'direct' | 'group',
  ): Promise<{
    text: string;
    senderId: string;
    senderName: string;
    createdAt: Date;
  } | null> => {
    try {
      const messagesRef =
        chatType === 'direct'
          ? collection(db, 'direct_messages', chatId, 'messages')
          : collection(db, 'crew_date_chats', chatId, 'messages');
      const messagesQuery = query(
        messagesRef,
        orderBy('createdAt', 'desc'),
        limit(1),
      );
      const querySnapshot = await getDocs(messagesQuery);

      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        const msgData = docSnap.data();
        const senderId: string = msgData.senderId;
        const senderName = await getSenderName(senderId);

        return {
          text: msgData.text,
          senderId,
          senderName,
          createdAt: msgData.createdAt.toDate(),
        };
      } else {
        return null;
      }
    } catch (error) {
      console.error(`Error fetching last message for chat ${chatId}:`, error);
      return null;
    }
  };

  // Helper function to get crew name from crewId
  const getCrewName = (chatId: string): string => {
    const crewId = chatId.split('_')[0];
    const crew = crews.find((c) => c.id === crewId);
    return crew ? crew.name : 'Unknown Crew';
  };

  const getFormattedChatDate = (chatId: string): string => {
    const date = chatId.split('_')[1];
    const formattedDate = moment(date).format('MMM Do');
    return formattedDate;
  };

  const getIconUrlForCrew = (chatId: string): string | undefined => {
    const crewId = chatId.split('_')[0];
    const crew = crews.find((c) => c.id === crewId);
    return crew?.iconUrl;
  };

  // Combine and sort chats with unread counts
  const combineChats = useCallback(async () => {
    try {
      const combined: CombinedChat[] = [];

      // Process Direct Messages
      for (const dm of dms) {
        const otherParticipants = dm.participants;
        const title = otherParticipants
          .map((user) => user.displayName)
          .join(', ');
        const iconUrl = otherParticipants[0]?.photoURL;

        const lastMsg = await fetchLastMessage(dm.id, 'direct');

        const unreadCount = await fetchDMUnreadCount(dm.id);

        combined.push({
          id: dm.id,
          type: 'direct',
          title,
          iconUrl,
          lastMessage: lastMsg?.text,
          lastMessageTime: lastMsg?.createdAt,
          lastMessageSenderId: lastMsg?.senderId,
          lastMessageSenderName: lastMsg?.senderName,
          unreadCount,
        });
      }

      // Process Group Chats
      for (const gc of groupChats) {
        const crewName = getCrewName(gc.id);
        const chatDate = getFormattedChatDate(gc.id);
        const title = `${crewName} (${chatDate})`;
        const iconUrl = getIconUrlForCrew(gc.id);

        const lastMsg = await fetchLastMessage(gc.id, 'group');

        const unreadCount = await fetchGroupUnreadCount(gc.id);

        combined.push({
          id: gc.id,
          type: 'group',
          title,
          iconUrl,
          lastMessage: lastMsg?.text,
          lastMessageTime: lastMsg?.createdAt,
          lastMessageSenderId: lastMsg?.senderId,
          lastMessageSenderName: lastMsg?.senderName,
          unreadCount,
        });
      }

      // Sort combined chats by lastMessageTime descending
      combined.sort((a, b) => {
        if (a.lastMessageTime && b.lastMessageTime) {
          return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
        } else if (a.lastMessageTime) {
          return -1;
        } else if (b.lastMessageTime) {
          return 1;
        } else {
          return 0;
        }
      });

      setCombinedChats(combined);
    } catch (error) {
      console.error('Error combining chats:', error);
      // Optionally, display an alert or notification
    } finally {
      setLoading(false);
    }
  }, [
    dms,
    groupChats,
    crews,
    fetchDMUnreadCount,
    fetchGroupUnreadCount,
    getSenderName,
  ]);

  // Filter chats based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredChats(combinedChats);
    } else {
      const filtered = combinedChats.filter((chat) =>
        chat.title.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      setFilteredChats(filtered);
    }
  }, [searchQuery, combinedChats]);

  const handleNavigation = (chatId: string, chatType: 'direct' | 'group') => {
    console.log('Navigating to chat:', chatId, chatType);
    if (chatType === 'direct') {
      const otherUserId = chatId.split('_').find((uid) => uid !== user?.uid);
      if (otherUserId) {
        navigation.navigate('DMChat', { otherUserId });
      } else {
        console.error('Error: otherUserId is undefined');
      }
    } else {
      const crewId = chatId.split('_')[0];
      const date = chatId.split('_')[1];
      navigation.navigate('CrewDateChat', { crewId, date, id: chatId });
    }
  };

  useEffect(() => {
    combineChats();
  }, [dms, groupChats, crews, combineChats]);

  // Render each chat item with unread count and sender's name
  const renderItem = ({ item }: { item: CombinedChat }) => {
    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => handleNavigation(item.id, item.type)}
      >
        {/* Avatar */}
        <View style={styles.avatar}>
          <ProfilePicturePicker
            size={55}
            imageUrl={item.iconUrl ?? null}
            iconName="people-outline"
            editable={false}
            onImageUpdate={() => {}}
          />
        </View>

        {/* Chat Details */}
        <View style={styles.chatDetails}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.lastMessageTime && (
              <Text style={styles.chatTimestamp}>
                {moment(item.lastMessageTime).fromNow()}
              </Text>
            )}
          </View>
          <Text style={styles.chatLastMessage} numberOfLines={1}>
            {item.lastMessage ? (
              item.lastMessageSenderName ? (
                <>
                  <Text style={styles.senderName}>
                    {item.lastMessageSenderName}:{' '}
                  </Text>
                  {item.lastMessage}
                </>
              ) : (
                item.lastMessage
              )
            ) : (
              'No messages yet.'
            )}
          </Text>
        </View>

        {/* Unread Count Badge */}
        {item.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>
              {item.unreadCount > 99 ? '99+' : item.unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#0a84ff" />
      </View>
    );
  }

  return (
    <View style={globalStyles.container}>
      <ScreenTitle title="Chats" />

      {/* Search Bar */}
      <CustomSearchInput
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
      />

      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No chats available.</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  chatItem: {
    flexDirection: 'row',
    paddingVertical: 15,
    alignItems: 'center',
    position: 'relative',
  },
  avatar: {
    marginRight: 15,
  },
  chatDetails: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
    paddingRight: 20,
  },
  chatTimestamp: {
    fontSize: 12,
    color: '#999',
    position: 'absolute',
    right: 0,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '600',
    maxWidth: '80%',
  },
  chatLastMessage: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
    flexDirection: 'row',
  },
  senderName: {
    color: '#555',
  },
  separator: {
    height: 1,
    backgroundColor: '#eee',
    marginLeft: 85,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#999',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    right: 0,
    top: 48,
    backgroundColor: '#0a84ff',
    borderRadius: 12,
    minWidth: 24,
    paddingHorizontal: 6,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ChatsListScreen;
