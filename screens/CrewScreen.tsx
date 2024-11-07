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
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from '../context/UserContext';
import { User } from '../types/User';
import { MaterialIcons, Ionicons } from '@expo/vector-icons'; // Ensure Ionicons is imported
import { NavParamList } from '../navigation/AppNavigator';
import SkeletonUserItem from '../components/SkeletonUserItem';
import MemberList from '../components/MemberList'; // Import the new MemberList component
import DateTimePickerModal from 'react-native-modal-datetime-picker'; // Import date picker
import moment from 'moment'; // For date formatting
import { Crew } from '../types/Crew';
import CustomButton from '../components/CustomButton'; // Import CustomButton
import CrewHeader from '../components/CrewHeader'; // Import the new CrewHeader component

type CrewScreenRouteProp = RouteProp<NavParamList, 'Crew'>;

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
  const [statusesForSelectedDate, setStatusesForSelectedDate] = useState<{
    [userId: string]: boolean;
  }>({});
  const [loading, setLoading] = useState(true);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [selectedDate, setSelectedDate] =
    useState<string>(getTodayDateString());

  // Utility function to get today's date in 'YYYY-MM-DD' format
  function getTodayDateString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

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

  // Listener for the userStatuses subcollection based on selectedDate
  useEffect(() => {
    if (!crewId || !user) return;

    const userStatusesRef = collection(
      db,
      'crews',
      crewId,
      'statuses',
      selectedDate,
      'userStatuses',
    );

    const unsubscribeUserStatuses = onSnapshot(
      userStatusesRef,
      (snapshot) => {
        const newStatuses: { [userId: string]: boolean } = {};
        snapshot.forEach((docSnap) => {
          const statusData = docSnap.data() as Status;
          const userId = docSnap.id;
          newStatuses[userId] = statusData.upForGoingOutTonight || false;
          console.log(`User ID: ${userId}, Status: ${newStatuses[userId]}`);
        });
        console.log(`All Statuses for ${selectedDate}:`, newStatuses);
        setStatusesForSelectedDate(newStatuses);
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
  }, [crewId, user, selectedDate]);

  // Function to toggle user's status for the selected date
  const toggleStatus = async () => {
    if (!user?.uid || !crew) {
      Alert.alert('Error', 'User or Crew data is missing');
      return;
    }

    const userStatusRef = doc(
      db,
      'crews',
      crewId,
      'statuses',
      selectedDate,
      'userStatuses',
      user.uid,
    );

    const confirmToggle = async () => {
      try {
        const statusSnap = await getDoc(userStatusRef);
        if (statusSnap.exists()) {
          const currentStatus = statusSnap.data().upForGoingOutTonight || false;
          await updateDoc(userStatusRef, {
            upForGoingOutTonight: !currentStatus,
            timestamp: Timestamp.fromDate(new Date()),
          });
          console.log(
            `Updated Status for User ${user.uid} on ${selectedDate}: ${!currentStatus}`,
          );
        } else {
          // If no status exists for the selected date, create it with true
          await setDoc(userStatusRef, {
            date: selectedDate,
            upForGoingOutTonight: true,
            timestamp: Timestamp.fromDate(new Date()),
          });
          console.log(
            `Created Status for User ${user.uid} on ${selectedDate}: true`,
          );
        }

        // The onSnapshot listener will automatically update the local state
      } catch (error) {
        console.error('Error toggling status:', error);
        Alert.alert('Error', 'Could not update your status');
      }
    };

    Alert.alert(
      'Confirm status change',
      currentUserStatus
        ? `Are you sure you want to mark yourself as not up for ${getCrewActivity()}?`
        : `Are you sure you want to mark yourself as up for ${getCrewActivity()}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm',
          onPress: confirmToggle,
        },
      ],
    );
  };

  // Derive current user's status for the selected date
  const currentUserStatus = user?.uid
    ? statusesForSelectedDate[user.uid] || false
    : false;

  // Get list of members who are up for it on the selected date
  const membersUpForGoingOut = members.filter(
    (member) => statusesForSelectedDate[member.uid],
  );

  const getCrewActivity = () => {
    if (crew?.activity) {
      return crew.activity.toLowerCase();
    }
    return 'meeting up';
  };

  // Debugging: Log the current status and members up for it
  useEffect(() => {
    console.log('Selected Date:', selectedDate);
    console.log('Current User Status:', currentUserStatus);
    console.log('Members Up For Going Out:', membersUpForGoingOut);
  }, [membersUpForGoingOut, currentUserStatus, selectedDate]);

  // Add a cog icon in the header to navigate to CrewSettingsScreen
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={{ marginRight: 16 }}
          onPress={() => navigation.navigate('CrewSettings', { crewId })}
          accessibilityLabel="Crew Settings"
          accessibilityHint="Navigate to crew settings"
        >
          <MaterialIcons name="settings" size={24} color="black" />
        </TouchableOpacity>
      ),
      // Set the custom header title once crew data is loaded
      headerTitle: crew ? () => <CrewHeader crew={crew} /> : 'Crew',
      headerTitleAlign: 'left',
    });
  }, [navigation, crew, crewId]);

  // Date Picker Handlers
  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const handleConfirmDate = (date: Date) => {
    const formattedDate = moment(date).format('YYYY-MM-DD');
    setSelectedDate(formattedDate);
    hideDatePicker();
  };

  // Function to increment the selected date by one day
  const incrementDate = () => {
    const newDate = moment(selectedDate).add(1, 'days').format('YYYY-MM-DD');
    setSelectedDate(newDate);
  };

  // Function to decrement the selected date by one day
  const decrementDate = () => {
    const today = moment().startOf('day');
    const current = moment(selectedDate, 'YYYY-MM-DD').startOf('day');

    if (current.isAfter(today)) {
      const newDate = current.subtract(1, 'days').format('YYYY-MM-DD');
      setSelectedDate(newDate);
    } else {
      Alert.alert('Invalid Date', 'You cannot select a past date.');
    }
  };

  if (loading || !crew) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Date Picker with Arrow Buttons */}
      <View style={styles.datePickerContainer}>
        {/* Left Arrow Button */}
        <TouchableOpacity
          onPress={decrementDate}
          disabled={selectedDate === getTodayDateString()}
          accessibilityLabel="Previous Date"
          accessibilityHint="Select the previous date"
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={selectedDate === getTodayDateString() ? '#ccc' : '#1e90ff'}
          />
        </TouchableOpacity>

        {/* Date Picker Button */}
        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={showDatePicker}
          accessibilityLabel="Select Date"
          accessibilityHint="Open date picker to select a date"
        >
          <Ionicons name="calendar-outline" size={20} color="#1e90ff" />
          <Text style={styles.datePickerText}>
            {selectedDate === getTodayDateString()
              ? 'Today'
              : moment(selectedDate).format('MMMM Do, YYYY')}
          </Text>
        </TouchableOpacity>

        {/* Right Arrow Button */}
        <TouchableOpacity
          onPress={incrementDate}
          accessibilityLabel="Next Date"
          accessibilityHint="Select the next date"
        >
          <Ionicons name="arrow-forward" size={24} color="#1e90ff" />
        </TouchableOpacity>
      </View>

      {/* Date Picker Modal */}
      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirmDate}
        onCancel={hideDatePicker}
        minimumDate={new Date()}
        date={new Date(selectedDate)}
      />

      {/* Members up for it on selected date */}
      <Text style={styles.listTitle}>{`Up for ${getCrewActivity()}:`}</Text>
      {currentUserStatus ? (
        <MemberList
          members={membersUpForGoingOut}
          currentUserId={user?.uid || null}
          emptyMessage={"No one's up for it on this date"}
        />
      ) : (
        <View style={styles.skeletonContainer}>
          {/* Render Skeleton User Items */}
            <MemberList
              members={[]}
              currentUserId={null}
              isLoading={true}
            />

          {/* Overlaid Message */}
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>
              You can only see who's up for {getCrewActivity()} on this date if
              you're up for it too!
            </Text>
          </View>
        </View>
      )}

      {/* Toggle Status Button */}
      <View style={styles.statusButton}>
        <CustomButton
          title={currentUserStatus ? "I'm no longer up for it" : 'Count me in'}
          onPress={toggleStatus}
          loading={false} // Set to true if there's a loading state during toggle
          variant={currentUserStatus ? 'danger' : 'primary'} // Red for active, Green for inactive
          icon={{
            name: currentUserStatus ? 'remove-circle-outline' : 'star-outline',
            size: 24,
            library: 'Ionicons',
          }}
          accessibilityLabel="Toggle Status"
          accessibilityHint={
            currentUserStatus
              ? `Mark yourself as not up for ${getCrewActivity()} on ${selectedDate}`
              : `Mark yourself as up for ${getCrewActivity()} on ${selectedDate}`
          }
        />
      </View>
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
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
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
    textAlign: 'center',
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
  listTitle: {
    fontSize: 20,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  datePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 25,
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
  },
  datePickerText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
});
