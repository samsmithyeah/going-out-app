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
  Image,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  orderBy,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from '../context/UserContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavParamList } from '../navigation/AppNavigator';
import { Crew } from './CrewScreen';
import { User } from '../types/User'; // Import User interface

type CrewsListScreenProps = NativeStackScreenProps<NavParamList, 'CrewsList'>;

const CrewsListScreen: React.FC<CrewsListScreenProps> = ({ navigation }) => {
  const { user } = useUser();
  const [crews, setCrews] = useState<Crew[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newCrewName, setNewCrewName] = useState('');
  const [loading, setLoading] = useState(true);

  // User cache: { [uid: string]: User }
  const [usersCache, setUsersCache] = useState<{ [key: string]: User }>({});

  // Track loading state for user data
  const [usersLoading, setUsersLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    // Reference to the crews collection
    const crewsRef = collection(db, 'crews');

    // Query to get crews where the user is a member, ordered by name ascending
    const q = query(
      crewsRef,
      where('memberIds', 'array-contains', user.uid),
      orderBy('name', 'asc'),
    );

    // Real-time listener
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const crewsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Crew, 'id'>),
        }));
        setCrews(crewsList);
        setLoading(false);

        // Collect all unique memberIds from the crews
        const allMemberIds = crewsList.reduce<string[]>(
          (acc, crew) => acc.concat(crew.memberIds),
          [],
        );
        const uniqueMemberIds = Array.from(new Set(allMemberIds));

        // Determine which memberIds are not in the cache
        const memberIdsToFetch = uniqueMemberIds.filter(
          (uid) => !usersCache[uid],
        );

        if (memberIdsToFetch.length > 0) {
          setUsersLoading(true);
          try {
            // Fetch user data for memberIdsToFetch
            const userPromises = memberIdsToFetch.map((uid) =>
              getDoc(doc(db, 'users', uid)).then((userDoc) => {
                if (userDoc.exists()) {
                  return { ...userDoc.data(), uid: userDoc.id } as User;
                } else {
                  // Handle case where user document doesn't exist
                  return {
                    uid,
                    displayName: 'Unknown User',
                    email: '',
                  } as User;
                }
              }),
            );

            const usersData = await Promise.all(userPromises);

            // Update the users cache
            setUsersCache((prevCache) => {
              const newCache = { ...prevCache };
              usersData.forEach((userData) => {
                newCache[userData.uid] = userData;
              });
              return newCache;
            });
          } catch (error) {
            console.error('Error fetching user data:', error);
            Alert.alert('Error', 'Could not fetch crew members data');
          } finally {
            setUsersLoading(false);
          }
        }
      },
      (error) => {
        console.error('Error fetching crews:', error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.uid, usersCache]);

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
        // Optionally, initialize iconUrl if you have a default image
        // iconUrl: 'https://example.com/default-icon.png',
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

  if (loading || usersLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#1e90ff" />
        {usersLoading && <Text>Loading crew members...</Text>}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={crews}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const memberNames = item.memberIds
            .map(
              (uid) =>
                usersCache[uid]?.firstName || usersCache[uid]?.displayName,
            )
            .reduce((acc, name, index, array) => {
              if (index === 0) {
                return name;
              } else if (index === array.length - 1) {
                return `${acc} and ${name}`;
              } else {
                return `${acc}, ${name}`;
              }
            }, '');

          return (
            <TouchableOpacity
              style={styles.crewItem}
              onPress={() => navigation.navigate('Crew', { crewId: item.id })}
            >
              {/* Crew Image */}
              {item.iconUrl ? (
                <Image
                  source={{ uri: item.iconUrl }}
                  style={styles.crewImage}
                />
              ) : (
                <View style={styles.placeholderImage}>
                  <Ionicons name="people-outline" size={24} color="#888" />
                </View>
              )}
              {/* Crew Details */}
              <View style={styles.crewDetails}>
                {/* Crew Name */}
                <Text style={styles.crewText}>{item.name}</Text>
                {/* Member Names */}
                <Text style={styles.memberText}>{memberNames}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No crews found</Text>
        }
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
    flexDirection: 'row', // Arrange image and text horizontally
    alignItems: 'center', // Vertically center items
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  crewImage: {
    width: 50, // Adjust size as needed
    height: 50,
    borderRadius: 25,
    marginRight: 16, // Space between image and text
  },
  placeholderImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  crewDetails: {
    flex: 1, // Take up remaining space
  },
  crewText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  memberText: {
    fontSize: 14,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#888',
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
    elevation: 5, // Add shadow for Android
    shadowColor: '#000', // Add shadow for iOS
    shadowOffset: { width: 0, height: 2 }, // iOS shadow
    shadowOpacity: 0.3, // iOS shadow
    shadowRadius: 3, // iOS shadow
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
    textAlign: 'center',
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
