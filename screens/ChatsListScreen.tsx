// screens/ChatsListScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useDirectMessages } from '../context/DirectMessagesContext';
import { useCrewDateChat } from '../context/CrewDateChatContext';
import { useCrews } from '../context/CrewsContext'; // Assumed to exist
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { NavParamList } from '../navigation/AppNavigator'; // Adjust according to your navigation setup
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import moment from 'moment';
import { useUser } from '../context/UserContext';

// Define CombinedChat interface
interface CombinedChat {
  id: string;
  type: 'direct' | 'group';
  title: string;
  iconUrl?: string;
  lastMessage?: string;
  lastMessageTime?: Date;
}

// Define Props (if using TypeScript)
const ChatsListScreen: React.FC = () => {
  const { dms } = useDirectMessages();
  const { chats: groupChats } = useCrewDateChat();
  const { crews } = useCrews(); // Assumed to provide an array of crew objects
  const { user } = useUser();
  const navigation = useNavigation<NavigationProp<NavParamList>>();

  const [combinedChats, setCombinedChats] = useState<CombinedChat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    console.log('Direct Messages:', dms);
    console.log('Group Chats:', groupChats);
  }, [dms, groupChats]);

  // Helper function to fetch the last message of a chat
  const fetchLastMessage = async (
    chatId: string,
    chatType: 'direct' | 'group',
  ): Promise<{ text: string; createdAt: Date } | null> => {
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
        return {
          text: msgData.text,
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
    const formattedDate = moment(date).format('MMMM Do, YYYY');
    return formattedDate;
  };

  const getIconUrlForCrew = (chatId: string): string | undefined => {
    const crewId = chatId.split('_')[0];
    const crew = crews.find((c) => c.id === crewId);
    return crew?.iconUrl;
  };

  // Combine and sort chats
  const combineChats = async () => {
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

        combined.push({
          id: dm.id,
          type: 'direct',
          title,
          iconUrl,
          lastMessage: lastMsg?.text,
          lastMessageTime: lastMsg?.createdAt,
        });
      }

      // Process Group Chats
      for (const gc of groupChats) {
        const crewName = getCrewName(gc.id);
        const chatDate = getFormattedChatDate(gc.id);
        const title = `${crewName} - ${chatDate}`;
        const iconUrl = getIconUrlForCrew(gc.id);

        const lastMsg = await fetchLastMessage(gc.id, 'group');

        combined.push({
          id: gc.id,
          type: 'group',
          title,
          iconUrl,
          lastMessage: lastMsg?.text,
          lastMessageTime: lastMsg?.createdAt,
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
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dms, groupChats, crews]);

  // Render each chat item
  const renderItem = ({ item }: { item: CombinedChat }) => {
    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => handleNavigation(item.id, item.type)}
      >
        {/* Avatar */}
        <Image
          source={item.iconUrl ? { uri: item.iconUrl } : undefined}
          style={styles.avatar}
        />

        {/* Chat Details */}
        <View style={styles.chatDetails}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.lastMessageTime && (
              <Text style={styles.chatTimestamp}>
                {item.lastMessageTime.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            )}
          </View>
          <Text style={styles.chatLastMessage} numberOfLines={1}>
            {item.lastMessage || 'No messages yet.'}
          </Text>
        </View>
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
    <View style={styles.container}>
      <FlatList
        data={combinedChats}
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
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  chatItem: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
  },
  avatar: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: '#ddd',
    marginRight: 15,
  },
  chatDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '600',
    maxWidth: '80%',
  },
  chatTimestamp: {
    fontSize: 12,
    color: '#999',
  },
  chatLastMessage: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
  },
  separator: {
    height: 1,
    backgroundColor: '#eee',
    marginLeft: 85, // Align with text
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
});

export default ChatsListScreen;
