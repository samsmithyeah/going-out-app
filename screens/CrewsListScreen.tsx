// screens/CrewsListScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from '../context/UserContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavParamList } from '../navigation/AppNavigator';
import ScreenTitle from '../components/ScreenTitle';
import CrewList from '../components/CrewList';
import CreateCrewModal from '../components/CreateCrewModal';
import { Crew } from '../types/Crew'; // Ensure correct import path
import { User } from '../types/User'; // Ensure correct import path

type CrewsListScreenProps = NativeStackScreenProps<NavParamList, 'CrewsList'>;

const CrewsListScreen: React.FC<CrewsListScreenProps> = ({ navigation }) => {
  const { user } = useUser();
  const [crews, setCrews] = useState<Crew[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>(''); // New state for search
  const [filteredCrews, setFilteredCrews] = useState<Crew[]>([]); // New state for filtered crews

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

        // Filter crews based on search query
        if (searchQuery.trim() !== '') {
          const filtered = crewsList.filter((crew) =>
            crew.name.toLowerCase().includes(searchQuery.toLowerCase()),
          );
          setFilteredCrews(filtered);
        } else {
          setFilteredCrews(crewsList);
        }

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
                    firstName: 'Unknown', // Assuming these fields
                    lastName: '',
                    photoURL: '',
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
  }, [user?.uid]);

  // Effect to handle search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCrews(crews);
    } else {
      const filtered = crews.filter((crew) =>
        crew.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      setFilteredCrews(filtered);
    }
  }, [searchQuery, crews]);

  const handleCrewCreated = (crewId: string) => {
    console.log('Crew created:', crewId);
    setIsModalVisible(false);
    navigation.navigate('Crew', { crewId });
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
      {/* Title */}
      <ScreenTitle title="Crews" />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color="#888"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Crew List */}
      <CrewList
        crews={filteredCrews}
        usersCache={usersCache}
        navigation={navigation}
      />

      {/* Add Crew Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setIsModalVisible(true)}
        accessibilityLabel="Add Crew Button"
        accessibilityHint="Press to create a new crew"
      >
        <MaterialIcons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* Create Crew Modal */}
      <CreateCrewModal
        isVisible={isModalVisible}
        onClose={() => {
          console.log('Setting isModalVisible to false');
          setIsModalVisible(false);
        }}
        onCrewCreated={handleCrewCreated}
      />
    </View>
  );
};

export default CrewsListScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f9f9f9', // Light background color
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6e6e6',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginBottom: 15,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
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
});
