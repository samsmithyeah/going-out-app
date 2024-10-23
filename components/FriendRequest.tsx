// components/FriendRequest.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import { firestore, collection, addDoc } from '../firebase';

const FriendRequest: React.FC = () => {
  const [friendEmail, setFriendEmail] = useState<string>('');

  const sendFriendRequest = async () => {
    try {
      const friendsCollection = collection(firestore, 'friendRequests');
      await addDoc(friendsCollection, { email: friendEmail, status: 'pending' });
      Alert.alert('Friend request sent!');
    } catch (error) {
      Alert.alert('Error sending request', (error as Error).message);
    }
  };

  return (
    <View>
      <TextInput
        placeholder="Friend's Email"
        onChangeText={(text) => setFriendEmail(text)}
        value={friendEmail}
      />
      <Button title="Send Friend Request" onPress={sendFriendRequest} />
    </View>
  );
};

export default FriendRequest;
