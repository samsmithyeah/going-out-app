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
import { useUser, User } from '../context/UserContext';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import SkeletonUserItem from '../components/SkeletonUserItem';
import MemberList from '../components/MemberList'; // Import the new MemberList component

type CrewScreenRouteProp = RouteProp<RootStackParamList, 'Crew'>;

export interface Crew {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  iconUrl?: string;
}

interface Status {
  upForGoingOutTonight: boolean;
  timestamp: any;
}

const CrewScreen: React.FC = () => {
  const { user } = useUser();
  const route = useRoute<CrewScreenRouteProp>();
  const { crewId } = route.params;
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [crew, setCrew] = useState<Crew | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [statuses, setStatuses] = useState<{ [userId: string]: boolean }>({});
  const [loading, setLoading] = useState(true);

  // Fetch crew data and statuses in real-time
  useEffect(() => {
    if (!crewId) {
      Alert.alert('Error', 'Crew ID is missing');
      setLoading(false);
      return;
    }

    const crewRef = doc(db, 'crews', crewId);
    const statusesRef = collection(crewRef, 'statuses');

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

    const unsubscribeStatuses = onSnapshot(
      statusesRef,
      (snapshot) => {
        if (!user) return;

        const newStatuses: { [userId: string]: boolean } = {};
        snapshot.docs.forEach((doc) => {
          const data = doc.data() as Status;
          newStatuses[doc.id] = data.upForGoingOutTonight || false;
        });
        setStatuses(newStatuses);
      },
      (error) => {
        if (user) {
          console.error('Error fetching statuses:', error);
          Alert.alert('Error', 'Could not fetch statuses');
        }
      },
    );

    return () => {
      unsubscribeCrew();
      unsubscribeStatuses();
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

  // Function to toggle user's status
  const toggleStatus = async () => {
    if (!user?.uid || !crew) {
      Alert.alert('Error', 'User or Crew data is missing');
      return;
    }

    try {
      const crewRef = doc(db, 'crews', crewId);
      const statusesRef = collection(crewRef, 'statuses');
      const userStatusRef = doc(statusesRef, user.uid);

      const userStatusSnap = await getDoc(userStatusRef);
      if (userStatusSnap.exists()) {
        const currentStatus =
          userStatusSnap.data().upForGoingOutTonight || false;
        await updateDoc(userStatusRef, {
          upForGoingOutTonight: !currentStatus,
          timestamp: new Date(),
        });
      } else {
        // If no status exists, set it to true
        await setDoc(userStatusRef, {
          upForGoingOutTonight: true,
          timestamp: new Date(),
        });
      }

      // The onSnapshot listener will update the local state
    } catch (error) {
      console.error('Error toggling status:', error);
      Alert.alert('Error', 'Could not update your status');
    }
  };

  // Derive current user's status directly from statuses object
  const currentUserStatus = user?.uid ? statuses[user.uid] || false : false;

  // Get list of members who are up for going out tonight
  const membersUpForGoingOut = members.filter((member) => statuses[member.uid]);

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
      {/* Members Up for Going Out Tonight */}
      {currentUserStatus ? (
        <MemberList
          members={membersUpForGoingOut}
          currentUserId={user?.uid || null}
          listTitle="Up for going out tonight:"
          emptyMessage="No members are up for going out tonight."
        />
      ) : (
        <View style={styles.skeletonContainer}>
          {/* Render Skeleton User Items */}
          {[...Array(5)].map((_, index) => (
            <SkeletonUserItem key={index} />
          ))}

          {/* Overlayed Message */}
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
            ? "I'm not up for going out tonight"
            : "I'm up for going out tonight"}
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
  },
  statusButton: {
    padding: 15,
    borderRadius: 10,
    marginVertical: 20,
    alignItems: 'center',
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
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: '#f0f0f0', // Light gray background for skeleton list
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
});
