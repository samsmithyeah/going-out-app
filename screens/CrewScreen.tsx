// screens/CrewScreen.tsx

import React, { useEffect, useState, useLayoutEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
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
  Timestamp,
} from 'firebase/firestore';
import { db, pokeCrew } from '@/firebase';
import { useUser } from '@/context/UserContext';
import { User } from '@/types/User';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { NavParamList } from '@/navigation/AppNavigator';
import MemberList from '@/components/MemberList';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import moment from 'moment';
import { Crew } from '@/types/Crew';
import CustomButton from '@/components/CustomButton';
import CrewHeader from '@/components/CrewHeader';
import { useCrews } from '@/context/CrewsContext';
import LoadingOverlay from '@/components/LoadingOverlay';
import Toast from 'react-native-toast-message';
import { useCrewDateChat } from '@/context/CrewDateChatContext';
import globalStyles from '@/styles/globalStyles';

type CrewScreenRouteProp = RouteProp<NavParamList, 'Crew'>;

interface Status {
  date: string; // Format: 'YYYY-MM-DD'
  upForGoingOutTonight: boolean;
  timestamp: Timestamp;
}

const CrewScreen: React.FC = () => {
  const { user } = useUser();
  const { toggleStatusForCrew } = useCrews();
  const route = useRoute<CrewScreenRouteProp>();
  const { crewId, date } = route.params;
  const navigation = useNavigation<NavigationProp<NavParamList>>();
  const [crew, setCrew] = useState<Crew | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [statusesForSelectedDate, setStatusesForSelectedDate] = useState<{
    [userId: string]: boolean;
  }>({});
  const [loading, setLoading] = useState(true);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(
    date || getTodayDateString(),
  );
  const { addMemberToChat, removeMemberFromChat } = useCrewDateChat();

  useEffect(() => {
    if (date) {
      console.log('Updating selectedDate to:', date);
      setSelectedDate(date);
    }
  }, [date]);

  // Utility function to get today's date in 'YYYY-MM-DD' format
  function getTodayDateString(): string {
    return moment().format('YYYY-MM-DD');
  }

  // Fetch crew data
  useEffect(() => {
    if (!crewId) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Crew ID not found',
      });
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
          navigation.navigate('CrewsList');
        }
        setLoading(false);
      },
      (error) => {
        if (user) {
          console.error('Error fetching crew:', error);
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Could not fetch crew data',
          });
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
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Could not fetch members',
          });
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
        for (const docSnap of snapshot.docs) {
          const statusData = docSnap.data() as Status;
          const userId = docSnap.id;
          newStatuses[userId] = statusData.upForGoingOutTonight || false;
          console.log(`User ID: ${userId}, Status: ${newStatuses[userId]}`);
        }
        console.log(`All Statuses for ${selectedDate}:`, newStatuses);
        setStatusesForSelectedDate(newStatuses);
      },
      (error) => {
        if (user) {
          console.error('Error fetching userStatuses:', error);
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Could not fetch user statuses',
          });
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
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'User or crew data not found',
      });
      return;
    }

    const confirmToggle = async () => {
      const newStatus = !currentUserStatus;
      toggleStatusForCrew(crewId, selectedDate, newStatus);
      const chatId = `${crewId}_${selectedDate}`;
      if (newStatus) {
        await addMemberToChat(chatId, user.uid);
      } else {
        await removeMemberFromChat(chatId, user.uid);
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

  const membersUpForGoingOut = useMemo(
    () => members.filter((member) => statusesForSelectedDate[member.uid]),
    [members, statusesForSelectedDate],
  );

  const getCrewActivity = () => {
    if (crew?.activity) {
      return crew.activity.toLowerCase();
    }
    return 'meeting up';
  };

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
      headerTitle: crew
        ? () => (
            <CrewHeader
              crew={crew}
              onPress={() => navigation.navigate('CrewSettings', { crewId })}
            />
          )
        : 'Crew',
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
      Toast.show({
        type: 'info',
        text1: 'Info',
        text2: 'Cannot select a past date',
      });
    }
  };

  // Function to navigate to OtherUserProfileScreen
  const navigateToUserProfile = (selectedUser: User) => {
    if (selectedUser.uid === user?.uid) {
      navigation.navigate('UserProfileStack', {
        screen: 'UserProfile',
        params: { userId: user.uid },
        initial: false,
      });
      return;
    }
    navigation.navigate('OtherUserProfile', { userId: selectedUser.uid });
  };

  const handlePokeCrew = async () => {
    if (!crewId || !selectedDate || !user?.uid) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Missing required information to poke the crew.',
      });
      return;
    }

    try {
      // Confirm the poke action with the user
      Alert.alert(
        'Poke the others?',
        'This will send a notification to members who are not marked as up for it on this date.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Poke',
            onPress: async () => {
              try {
                const poke = await pokeCrew(crewId, selectedDate, user.uid);
                Toast.show({
                  type: 'success',
                  text1: 'Poke Sent',
                  text2: (poke.data as { message: string }).message,
                });
              } catch (error) {
                console.error('Error sending poke:', error);
                Toast.show({
                  type: 'error',
                  text1: 'Error',
                  text2: 'Failed to send poke.',
                });
              }
            },
          },
        ],
        { cancelable: true },
      );
    } catch (error) {
      console.error('Error poking crew:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to poke the crew.',
      });
    }
  };

  return (
    <>
      {(loading || !crew) && <LoadingOverlay />}
      <View style={globalStyles.container}>
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
            onMemberPress={navigateToUserProfile}
          />
        ) : (
          <View style={styles.skeletonContainer}>
            {/* Render Skeleton User Items */}
            <MemberList members={[]} currentUserId={null} isLoading={true} />

            {/* Overlaid Message */}
            <View style={styles.overlay}>
              <Text style={styles.overlayText}>
                You can only see who's up for {getCrewActivity()} on this date
                if you're up for it too!
              </Text>
            </View>
          </View>
        )}

        {/* Button to navigate to crew date chat */}
        {currentUserStatus && (
          <View>
            <View style={styles.chatButton}>
              <CustomButton
                title="Message the up-for-it crew"
                variant="primary"
                onPress={() =>
                  navigation.navigate('CrewDateChat', {
                    crewId,
                    date: selectedDate,
                  })
                }
                icon={{
                  name: 'chatbubble-ellipses-outline',
                  size: 24,
                  library: 'Ionicons',
                }}
                accessibilityLabel="Open Chat"
                accessibilityHint="Navigate to crew date chat"
              />
            </View>
            {membersUpForGoingOut.length < members.length ? (
              <View style={styles.chatButton}>
                <CustomButton
                  title="Poke the others"
                  onPress={handlePokeCrew}
                  loading={false}
                  variant="secondary"
                  icon={{
                    name: 'beer-outline',
                    size: 24,
                    library: 'Ionicons',
                  }}
                  accessibilityLabel="Poke Crew"
                  accessibilityHint="Send a poke to crew members who are not up for it"
                />
              </View>
            ) : (
              <Text style={styles.upForItText}>
                The whole crew is up for it today! 🎉
              </Text>
            )}
          </View>
        )}

        {/* Toggle Status Button */}
        <View style={styles.statusButton}>
          <CustomButton
            title={
              currentUserStatus ? "I'm no longer up for it" : 'Count me in'
            }
            onPress={toggleStatus}
            loading={false} // Set to true if there's a loading state during toggle
            variant={currentUserStatus ? 'danger' : 'primary'} // Red for active, Green for inactive
            icon={{
              name: currentUserStatus
                ? 'remove-circle-outline'
                : 'star-outline',
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
    </>
  );
};

export default CrewScreen;

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  statusButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
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
    width: width - 32,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0)',
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
  chatButton: {
    marginBottom: 10,
  },
  upForItText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    alignSelf: 'center',
    marginTop: 10,
  },
});
