// screens/DMConversationsScreen.tsx

import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useDirectMessages } from '../context/DirectMessagesContext';
import { useCrews } from '../context/CrewsContext'; // Assuming you have a UsersContext for fetching user data
import { useUser } from '../context/UserContext'; // Assuming you have a UserContext for fetching user data
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavParamList } from '../navigation/AppNavigator';
import ScreenTitle from '../components/ScreenTitle';
import LoadingOverlay from '../components/LoadingOverlay';

type DMConversationsScreenProps = NativeStackScreenProps<
  NavParamList,
  'DMConversations'
>;

const DMConversationsScreen: React.FC<DMConversationsScreenProps> = ({
  navigation,
}) => {
  const { conversations, listenToConversations } = useDirectMessages();
  const { usersCache } = useCrews(); // Assuming UsersContext provides usersCache
  const { user } = useUser(); // Assuming UserContext provides user
  const [loading, setLoading] = React.useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = listenToConversations();
    setLoading(false);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const renderItem = ({ item }: { item: any }) => {
    const otherParticipantId = item.participants.find(
      (uid: string) => uid !== user?.uid,
    );
    const otherUser = usersCache[otherParticipantId];
    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() =>
          navigation.navigate('DMChat', {
            conversationId: item.id,
            otherUserId: otherParticipantId,
          })
        }
      >
        <Text style={styles.userName}>
          {otherUser?.displayName || 'Unknown User'}
        </Text>
        {item.latestMessage && (
          <Text style={styles.latestMessage}>{item.latestMessage.text}</Text>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <View style={styles.container}>
      <ScreenTitle title="Direct Messages" />
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text>No conversations yet.</Text>}
      />
      <TouchableOpacity
        style={styles.newMessageButton}
        onPress={() => navigation.navigate('NewDM')}
      >
        <Text style={styles.newMessageText}>New Message</Text>
      </TouchableOpacity>
    </View>
  );
};

export default DMConversationsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  conversationItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  latestMessage: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  newMessageButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#1e90ff',
    padding: 15,
    borderRadius: 30,
  },
  newMessageText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
