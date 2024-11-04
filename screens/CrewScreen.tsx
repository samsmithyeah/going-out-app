// screens/CrewScreen.tsx

import React, { useEffect, useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import {
  useRoute,
  RouteProp,
  useNavigation,
  NavigationProp,
} from '@react-navigation/native';
import {
  doc,
  getDoc,
  collection,
  onSnapshot,
  updateDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from '../context/UserContext';
import { User } from '../types/User';
import { MaterialIcons } from '@expo/vector-icons';
import { NavParamList } from '../navigation/AppNavigator';
import SkeletonUserItem from '../components/SkeletonUserItem';
import ProfilePicturePicker from '../components/ProfilePicturePicker';
import MemberList from '../components/MemberList'; // Import the new MemberList component
import { Timestamp } from 'firebase/firestore'; // Import Timestamp correctly

type CrewScreenRouteProp = RouteProp<NavParamList, 'Crew'>;

export interface Crew {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  iconUrl?: string;
}

interface Status {
  date: string; // Format: 'YYYY-MM-DD'
  upForGoingOutTonight: boolean;
  timestamp: Timestamp;
}

const CrewScreen: React.FC = () => {
  const { user } = useUser();
  const route = useRoute<CrewScreenRouteProp>();
  const { crewId } = route.params;
  const navigation = useNavigation<NavigationProp<NavParamList>>();
  const [crew, setCrew] = useState<Crew | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [statuses, setStatuses] = useState<{ [userId: string]: boolean }>({});
  const [loading, setLoading] = useState(true);

  // Utility function to get today's date in 'YYYY-MM-DD' format
  const getTodayDateString = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Fetch crew data
  useEffect(() => {
    if (!crewId) {
      Alert.alert('Error', 'Crew ID is missing');
      setLoading(false);
      return;
    }

    const crewRef = doc(db, 'crews', crewId);

    // Listener for the crew document
    const unsubscribeCrew = onSnapshot(
      crewRef,
      (docSnap) => {
        if (!user) return;

        if (docSnap.exists()) {
          const crewData: Crew = {
            id: docSnap.id,
            ...(docSnap.data() as Omit<Crew, 'id'>),
          };
          setCrew(crewData);
          navigation.setOptions({ title: crewData.name });
          console.log('Crew Data:', crewData);
        } else {
          console.warn('Crew not found');
        }
        setLoading(false);
      },
      (error) => {
        if (user) {
          console.error('Error fetching crew:', error);
          Alert.alert('Error', 'Could not fetch crew data');
        }
        setLoading(false);
      },
    );

    return () => {
      unsubscribeCrew();
    };
  }, [crewId, user, navigation]);

  // Fetch member profiles
  useEffect(() => {
    const fetchMembers = async () => {
      if (crew && crew.memberIds.length > 0) {
        try {
          const memberDocsPromises = crew.memberIds.map((memberId) =>
            getDoc(doc(db, 'users', memberId)),
          );
          const memberDocs = await Promise.all(memberDocsPromises);

          const membersList: User[] = memberDocs
            .filter((docSnap) => docSnap.exists())
            .map((docSnap) => ({
              uid: docSnap.id,
              ...(docSnap.data() as Omit<User, 'uid'>),
            }));

          console.log('Fetched Members:', membersList);
          setMembers(membersList);
        } catch (error) {
          console.error('Error fetching members:', error);
          Alert.alert('Error', 'Could not fetch member profiles');
        }
      } else {
        setMembers([]);
      }
    };

    fetchMembers();
  }, [crew]);

  // Listener for the userStatuses subcollection
  useEffect(() => {
    if (!crewId || !user) return;

    const todayDate = getTodayDateString();
    const userStatusesRef = collection(
      db,
      'crews',
      crewId,
      'statuses',
      todayDate,
      'userStatuses',
    );

    const unsubscribeUserStatuses = onSnapshot(
      userStatusesRef,
      (snapshot) => {
        const newStatuses: { [userId: string]: boolean } = {};
        snapshot.forEach((docSnap) => {
          const statusData = docSnap.data() as Status;
          const userId = docSnap.id; // Derive userId from document ID
          newStatuses[userId] = statusData.upForGoingOutTonight || false;
          console.log(`User ID: ${userId}, Status: ${newStatuses[userId]}`);
        });
        console.log('All Statuses:', newStatuses);
        setStatuses(newStatuses);
      },
      (error) => {
        if (user) {
          console.error('Error fetching userStatuses:', error);
          Alert.alert('Error', 'Could not fetch user statuses');
        }
      },
    );

    return () => {
      unsubscribeUserStatuses();
    };
  }, [crewId, user]);

  // Function to toggle user's status for today
  const toggleStatus = async () => {
    if (!user?.uid || !crew) {
      Alert.alert('Error', 'User or Crew data is missing');
      return;
    }

    const todayDate = getTodayDateString();
    const userStatusRef = doc(
      db,
      'crews',
      crewId,
      'statuses',
      todayDate,
      'userStatuses',
      user.uid,
    );

    try {
      const statusSnap = await getDoc(userStatusRef);
      if (statusSnap.exists()) {
        const currentStatus = statusSnap.data().upForGoingOutTonight || false;
        await updateDoc(userStatusRef, {
          upForGoingOutTonight: !currentStatus,
          timestamp: Timestamp.fromDate(new Date()),
        });
        console.log(`Updated Status for User ${user.uid}: ${!currentStatus}`);
      } else {
        // If no status exists for today, create it with true
        await setDoc(userStatusRef, {
          date: todayDate,
          upForGoingOutTonight: true,
          timestamp: Timestamp.fromDate(new Date()),
        });
        console.log(`Created Status for User ${user.uid}: true`);
      }

      // The onSnapshot listener will automatically update the local state
    } catch (error) {
      console.error('Error toggling status:', error);
      Alert.alert('Error', 'Could not update your status');
    }
  };

  // Derive current user's status directly from statuses object
  const currentUserStatus = user?.uid ? statuses[user.uid] || false : false;

  // Get list of members who are up for going out tonight
  const membersUpForGoingOut = members.filter((member) => statuses[member.uid]);

  // Debugging: Log the current status and members up for going out
  useEffect(() => {
    console.log('Current User Status:', currentUserStatus);
    console.log('Members Up For Going Out:', membersUpForGoingOut);
  }, [membersUpForGoingOut, currentUserStatus]);

  // Add a cog icon in the header to navigate to CrewSettingsScreen
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={{ marginRight: 16 }}
          onPress={() => navigation.navigate('CrewSettings', { crewId })}
        >
          <MaterialIcons name="settings" size={24} color="black" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, crewId]);

  if (loading || !crew) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Crew Header */}
      <View style={styles.header}>
        <ProfilePicturePicker
          imageUrl={crew.iconUrl || null}
          onImageUpdate={() => {}}
          editable={false}
          storagePath={`crews/${crewId}/icon.jpg`}
          size={80}
        />
        <View style={styles.headerTextContainer}>
          <Text style={styles.crewName}>{crew.name}</Text>
          <Text style={styles.crewMemberCount}>
            {crew.memberIds.length}{' '}
            {crew.memberIds.length === 1 ? 'Member' : 'Members'}
          </Text>
        </View>
      </View>
      {/* Members Up for Going Out Tonight */}
      <Text style={styles.listTitle}>Up for going out tonight:</Text>
      {currentUserStatus ? (
        <MemberList
          members={membersUpForGoingOut}
          currentUserId={user?.uid || null}
          emptyMessage="No members are up for going out tonight."
        />
      ) : (
        <View style={styles.skeletonContainer}>
          {/* Render Skeleton User Items */}
          {[...Array(4)].map((_, index) => (
            <SkeletonUserItem key={index} />
          ))}

          {/* Overlaid Message */}
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>
              Crew members who are up for going out tonight are only visible if
              you're up for it too!
            </Text>
          </View>
        </View>
      )}

      {/* Toggle Status Button */}
      <TouchableOpacity
        style={[
          styles.statusButton,
          currentUserStatus
            ? styles.statusButtonActive
            : styles.statusButtonInactive,
        ]}
        onPress={toggleStatus}
      >
        <Text style={styles.statusButtonText}>
          {currentUserStatus
            ? "👎 I'm not up for going out tonight"
            : "👍 I'm up for going out tonight"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default CrewScreen;

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
    position: 'relative', // Ensure absolute positioning is relative to this container
  },
  statusButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    marginHorizontal: 40, // Adjust to control button width and centering
  },
  statusButtonActive: {
    backgroundColor: '#ff6347', // Tomato color when active
  },
  statusButtonInactive: {
    backgroundColor: '#32cd32', // LimeGreen color when inactive
  },
  statusButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonContainer: {
    position: 'relative',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width - 32, // Adjusting for padding
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0)', // Fully transparent background
  },
  overlayText: {
    color: '#333',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  headerTextContainer: {
    marginLeft: 16,
  },
  crewName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  crewMemberCount: {
    fontSize: 14,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#fff', // White background for header
    padding: 16,
    borderRadius: 10,
    shadowColor: '#000', // Subtle shadow for depth
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2, // For Android shadow
  },
  listTitle: {
    fontSize: 20,
    marginBottom: 10,
    fontWeight: 'bold',
  },
});
