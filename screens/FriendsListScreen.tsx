import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { collection, addDoc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from '../context/UserContext'; 

interface Friend {
  id: string;
  email: string;
}

const FriendsListScreen: React.FC = () => {
  const { user } = useUser(); // Access the authenticated user
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newFriendEmail, setNewFriendEmail] = useState('');
  const [loading, setLoading] = useState(true); // State to show loading indicator

  useEffect(() => {
    // Ensure user is authenticated before accessing Firestore
    if (!user?.uid) {
      setLoading(false); // Stop loading if user is not available
      return;
    }

    console.log('Fetching friends for user:', user.uid);

    // Firestore reference to the user's friends collection
    const friendsCollectionRef = collection(db, 'users', user.uid, 'friends');

    // Real-time listener for friends collection
    const unsubscribe = onSnapshot(friendsCollectionRef, (snapshot) => {
      const friendsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        email: doc.data().email as string,
      }));
      setFriends(friendsList);
      setLoading(false); // Stop loading once data is fetched
    });

    return () => unsubscribe(); // Unsubscribe on component unmount
  }, [user?.uid]);

  const addFriend = async () => {
  if (!newFriendEmail.trim()) {
    Alert.alert('Error', 'Email address is required');
    return;
  }

  try {
    if (!user?.uid) {
      Alert.alert('Error', 'User is not authenticated');
      return;
    }

    // Check if the user with the provided email exists
    const usersCollectionRef = collection(db, 'users');
    const q = query(usersCollectionRef, where('email', '==', newFriendEmail.trim()));

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // No user found with the provided email
      Alert.alert('Error', 'No user found with the provided email');
      return;
    }

    // User exists, proceed to add as friend
    const friendDoc = querySnapshot.docs[0];
    const friendData = friendDoc.data();

    // Optional: You can store the friend's UID instead of email
    const friendUid = friendData.uid;

    // Check if the friend is already in the friend list
    const friendsCollectionRef = collection(db, 'users', user.uid, 'friends');
    const friendQuery = query(friendsCollectionRef, where('email', '==', newFriendEmail.trim()));
    const friendSnapshot = await getDocs(friendQuery);

    if (!friendSnapshot.empty) {
      Alert.alert('Error', 'This user is already your friend');
      return;
    }

    // Add the friend to the user's friends collection
    await addDoc(friendsCollectionRef, {
      email: newFriendEmail.trim(),
      uid: friendUid, // Store the friend's UID
    });

    // Close modal and clear input
    setIsModalVisible(false);
    setNewFriendEmail('');
  } catch (error) {
    console.error('Error adding friend: ', error);
    Alert.alert('Error', 'Could not add friend');
  }
};

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={friends}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.friendItem}>
            <Text style={styles.friendText}>{item.email}</Text>
          </View>
        )}
        ListEmptyComponent={<Text>No friends found</Text>}
      />

      {/* Add Friend Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setIsModalVisible(true)}
      >
        <MaterialIcons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* Modal for Adding New Friend */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add a Friend by Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Friend's Email"
              value={newFriendEmail}
              onChangeText={setNewFriendEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={addFriend}>
                <Text style={styles.modalButtonText}>Add Friend</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default FriendsListScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  friendItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  friendText: {
    fontSize: 18,
  },
  addButton: {
    backgroundColor: '#1e90ff',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    marginBottom: 20,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    backgroundColor: '#1e90ff',
    padding: 10,
    borderRadius: 5,
    width: '48%',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
