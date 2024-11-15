// screens/NewDMScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  Button,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { useCrews } from '../context/CrewsContext'; // Assuming you have a UsersContext
import { useUser } from '../context/UserContext';
import { useDirectMessages } from '../context/DirectMessagesContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavParamList } from '../navigation/AppNavigator';
import ScreenTitle from '../components/ScreenTitle';
import { User } from '../types/User';
import { Alert } from 'react-native';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

type NewDMScreenProps = NativeStackScreenProps<NavParamList, 'NewDM'>;

const NewDMScreen: React.FC<NewDMScreenProps> = ({ navigation }) => {
  const { usersCache } = useCrews();
  const { user } = useUser();
  const { conversations } = useDirectMessages();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers([]);
    } else {
      const lowerQuery = searchQuery.toLowerCase();
      const filtered = Object.values(usersCache).filter((user) =>
        user.displayName.toLowerCase().includes(lowerQuery),
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, usersCache]);

  const handleStartConversation = async (selectedUser: User) => {
    // Check if conversation already exists
    const existingConversation = conversations.find((conv) =>
      conv.participants.includes(selectedUser.uid),
    );

    if (existingConversation) {
      navigation.navigate('DMChat', {
        conversationId: existingConversation.id,
        otherUserId: selectedUser.uid,
      });
    } else {
      // Create new conversation
      try {
        const participants = [user?.uid, selectedUser.uid].sort(); // Sort to maintain consistency
        const newConversation = {
          participants,
          latestMessage: null,
        };
        const convoRef = await addDoc(
          collection(db, 'direct_messages'),
          newConversation,
        );
        navigation.navigate('DMChat', {
          conversationId: convoRef.id,
          otherUserId: selectedUser.uid,
        });
      } catch (error) {
        console.error('Error starting conversation:', error);
        Alert.alert('Error', 'Could not start conversation.');
      }
    }
  };

  return (
    <View style={styles.container}>
      <ScreenTitle title="New Message" />
      <TextInput
        placeholder="Search users..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchInput}
      />
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.userItem}
            onPress={() => handleStartConversation(item)}
          >
            <Text style={styles.userName}>{item.displayName}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text>No users found.</Text>}
      />
    </View>
  );
};

export default NewDMScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  userItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  userName: {
    fontSize: 16,
  },
});
