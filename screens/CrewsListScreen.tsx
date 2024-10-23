// screens/CrewsListScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from '../context/UserContext'; 
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator'; // Adjust the import path as needed

type CrewsListScreenProps = NativeStackScreenProps<RootStackParamList, 'CrewsList'>;

interface Crew {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
}

const CrewsListScreen: React.FC<CrewsListScreenProps> = ({ navigation }) => {
  const { user } = useUser();
  const [crews, setCrews] = useState<Crew[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newCrewName, setNewCrewName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    // Reference to the crews collection
    const crewsRef = collection(db, 'crews');

    // Query to get crews where the user is a member
    const q = query(crewsRef, where('memberIds', 'array-contains', user.uid));

    // Real-time listener
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const crewsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Crew, 'id'>),
        }));
        setCrews(crewsList);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching crews:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const createCrew = async () => {
    if (!newCrewName.trim()) {
      Alert.alert('Error', 'Crew name is required');
      return;
    }

    try {
      if (!user?.uid) {
        Alert.alert('Error', 'User is not authenticated');
        return;
      }

      // Create a new crew
      const crewRef = await addDoc(collection(db, 'crews'), {
        name: newCrewName.trim(),
        ownerId: user.uid,
        memberIds: [user.uid],
      });

      // Close modal and clear input
      setIsModalVisible(false);
      setNewCrewName('');

      // Navigate to CrewScreen within CrewsStackNavigator
      navigation.navigate('Crew', { crewId: crewRef.id });
    } catch (error) {
      console.error('Error creating crew:', error);
      Alert.alert('Error', 'Could not create crew');
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
        data={crews}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.crewItem}
            onPress={() => navigation.navigate('Crew', { crewId: item.id })}
          >
            <Text style={styles.crewText}>{item.name}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text>No crews found</Text>}
      />

      {/* Add Crew Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setIsModalVisible(true)}
      >
        <MaterialIcons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* Modal for Creating New Crew */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create a New Crew</Text>
            <TextInput
              style={styles.input}
              placeholder="Crew Name"
              value={newCrewName}
              onChangeText={setNewCrewName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={createCrew}>
                <Text style={styles.modalButtonText}>Create Crew</Text>
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

export default CrewsListScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  crewItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  crewText: {
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
    marginTop: 22,
    backgroundColor: 'rgba(0,0,0,0.5)', // Semi-transparent background
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 35,
    alignItems: 'center',
    width: '80%',
    shadowColor: '#000',
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    marginBottom: 15,
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