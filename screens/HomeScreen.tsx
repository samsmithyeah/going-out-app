// screens/HomeScreen.tsx

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase'; // Ensure Firebase is initialized in this file
import { useUser } from '../context/UserContext'; // Custom hook to access user context
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment';

const generateWeekDates = (): string[] => {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    dates.push(moment().add(i, 'days').format('YYYY-MM-DD'));
  }
  return dates;
};

const getDotColor = (count: number, total: number): string => {
  if (count === total && total > 0) return '#32CD32'; // Green
  if (count > 0 && count < total) return '#FFA500'; // Orange
  return '#D3D3D3'; // Grey
};

// Maximum number of operations per batch to comply with Firestore limits
const MAX_BATCH_SIZE = 10;

const HomeScreen: React.FC = () => {
  const { user } = useUser(); // Access the authenticated user
  const [loading, setLoading] = useState<boolean>(true); // Loading state
  const [weekDates, setWeekDates] = useState<string[]>([]); // Array of next 7 dates
  const [dateCounts, setDateCounts] = useState<{ [key: string]: number }>({}); // Count of "up" statuses per date
  const [crewIds, setCrewIds] = useState<string[]>([]); // Crews the user is member of

  // Define the week date range (today + next 6 days)
  useEffect(() => {
    setWeekDates(generateWeekDates());
  }, []);

  // Fetch crews where the user is a member
  const fetchUserCrews = async (): Promise<string[]> => {
    if (!user?.uid) return [];

    const crewsRef = collection(db, 'crews');
    const userCrewsQuery = query(
      crewsRef,
      where('memberIds', 'array-contains', user.uid),
    );
    const crewsSnapshot = await getDocs(userCrewsQuery);
    return crewsSnapshot.docs.map(doc => doc.id);
  };

  // Fetch the user's up statuses across all crews within the week
  const fetchUpStatuses = async (crewIds: string[], weekDates: string[]) => {
    const counts: { [key: string]: number } = {};

    // Initialize counts for each date
    weekDates.forEach((date) => {
      counts[date] = 0;
    });

    // Prepare all status document references
    const statusDocRefs = crewIds.flatMap((crewId) =>
      weekDates.map((date) =>
        doc(
          db,
          'crews',
          crewId,
          'statuses',
          date,
          'userStatuses',
          user?.uid || '',
        ),
      ),
    );

    try {
      // Fetch all status documents concurrently
      const statusSnapshots = await Promise.all(
        statusDocRefs.map((ref) => getDoc(ref)),
      );

      // Aggregate counts
      statusSnapshots.forEach((statusSnap) => {
        if (statusSnap.exists()) {
          const statusData = statusSnap.data();
          if (
            typeof statusData.upForGoingOutTonight === 'boolean' &&
            statusData.upForGoingOutTonight
          ) {
            const date = statusSnap.ref.parent.parent?.id;
            if (date && counts[date] !== undefined) {
              counts[date] += 1;
            }
          }
        }
      });

      setDateCounts(counts);
    } catch (error: any) {
      console.error('Error fetching up statuses:', error);
      if (error.code === 'permission-denied') {
        Alert.alert(
          'Permission Denied',
          'You do not have permission to perform this action. Please contact support if the issue persists.',
        );
      } else {
        Alert.alert('Error', 'There was an issue fetching your up statuses.');
      }
    }
  };

  // Fetch crews and statuses when the screen is focused
  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        setLoading(true);
        try {
          const fetchedCrewIds = await fetchUserCrews();
          setCrewIds(fetchedCrewIds);

          if (fetchedCrewIds.length > 0 && weekDates.length > 0) {
            await fetchUpStatuses(fetchedCrewIds, weekDates);
          } else {
            setDateCounts({});
          }
        } catch (error: any) {
          console.error('Error during data fetch:', error);
          Alert.alert('Error', 'There was an issue fetching your data.');
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }, [user?.uid, weekDates]),
  );

  // Function to toggle user's status for a specific date across all crews
  const toggleStatusForDate = async (date: string, toggleTo: boolean) => {
    if (!user?.uid) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    Alert.alert(
      'Confirm status change',
      `Are you sure you want to ${toggleTo ? 'mark yourself as up for seeing any of your crews on this day' : 'mark yourself as not up for seeing any of your crews on this day'}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm',
          onPress: async () => {
            setLoading(true);
            try {
              if (crewIds.length === 0) {
                Alert.alert('Info', 'You are not part of any crews.');
                setLoading(false);
                return;
              }

              const selectedDateStr = date;
              const newStatus = toggleTo;

              // Split crewIds into batches of MAX_BATCH_SIZE
              const batches: string[][] = [];
              for (let i = 0; i < crewIds.length; i += MAX_BATCH_SIZE) {
                batches.push(crewIds.slice(i, i + MAX_BATCH_SIZE));
              }

              // Perform each batch sequentially
              for (const batchCrewIds of batches) {
                const batch = writeBatch(db);

                batchCrewIds.forEach((crewId) => {
                  const userStatusRef = doc(
                    db,
                    'crews',
                    crewId,
                    'statuses',
                    selectedDateStr,
                    'userStatuses',
                    user.uid,
                  );

                  batch.set(
                    userStatusRef,
                    {
                      upForGoingOutTonight: newStatus,
                      timestamp: Timestamp.fromDate(new Date()),
                    },
                    { merge: true },
                  );
                });

                await batch.commit();
              }

              Alert.alert(
                'Success',
                `You have been marked as ${newStatus ? 'up' : 'not up'} for it on ${moment(
                  selectedDateStr,
                ).format('MMMM Do, YYYY')}.`,
              );

              // Update the cached dateCounts accurately
              setDateCounts((prevCounts) => ({
                ...prevCounts,
                [selectedDateStr]: newStatus ? crewIds.length : 0,
              }));
            } catch (error: any) {
              console.error('Error toggling status:', error);
              if (error.code === 'permission-denied') {
                Alert.alert(
                  'Permission Denied',
                  'You do not have permission to perform this action. Please contact support if the issue persists.',
                );
              } else {
                Alert.alert('Error', 'There was an issue updating your status.');
              }
            } finally {
              setLoading(false);
            }
          },
          style: 'destructive',
        },
      ],
      { cancelable: true },
    );
  };

  // Render a single day item
  const renderDayItem = ({ item }: { item: string }) => {
    const count = dateCounts[item] || 0;
    const total = crewIds.length;
    const isDisabled = moment(item).isBefore(moment(), 'day');
    const statusColor = getDotColor(count, total);
    const statusText = `Up for seeing ${count} of ${total} crew${total !== 1 ? 's' : ''}`;
    const isFullyUp = count === total;
    const isNotUp = count === 0;

    return (
      <View
        style={[
          styles.dayContainer,
          isDisabled && styles.disabledDayContainer,
        ]}
      >
        <View style={styles.dayHeader}>
          <Text style={[styles.dayText, isDisabled && styles.disabledDayText]}>
            {moment(item).format('dddd, MMMM Do')}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <View style={styles.statusInfo}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: statusColor },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                isDisabled && styles.disabledDayText,
              ]}
            >
              {statusText}
            </Text>
          </View>
          {!isDisabled && (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                onPress={() => toggleStatusForDate(item, true)}
                disabled={isFullyUp}
                style={[
                  styles.iconButton,
                  isFullyUp && styles.disabledButton,
                ]}
                accessibilityLabel={`Mark as up for ${moment(item).format('dddd, MMMM Do')}`}
                accessibilityHint={
                  isFullyUp
                    ? `You are already marked as up for all crews on ${moment(item).format('MMMM Do, YYYY')}.`
                    : `Tap to mark yourself as up for all crews on ${moment(item).format('MMMM Do, YYYY')}.`
                }
              >
                <Icon
                  name="check-circle"
                  size={24}
                  color={isFullyUp ? '#A9A9A9' : '#32CD32'} // Grey if disabled, Green otherwise
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => toggleStatusForDate(item, false)}
                disabled={isNotUp}
                style={[
                  styles.iconButton,
                  isNotUp && styles.disabledButton,
                ]}
                accessibilityLabel={`Mark as not up for ${moment(item).format('dddd, MMMM Do')}`}
                accessibilityHint={
                  isNotUp
                    ? `You are already marked as not up for any crews on ${moment(item).format('MMMM Do, YYYY')}.`
                    : `Tap to mark yourself as not up for any crews on ${moment(item).format('MMMM Do, YYYY')}.`
                }
              >
                <Icon
                  name="cancel"
                  size={24}
                  color={isNotUp ? '#A9A9A9' : '#FF6347'} // Grey if disabled, Tomato otherwise
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  // Render loading indicator while fetching data
  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#1E90FF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Profile Section */}
      <View style={styles.profileContainer}>
        <Text style={styles.greeting}>Hi {user?.displayName}! 👋</Text>
      </View>

      {/* Weekly Status List */}
      <FlatList
        data={weekDates}
        renderItem={renderDayItem}
        keyExtractor={(item) => item}
        horizontal={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.weekListContainer}
      />
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F5F5F5', // Solid light background
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  profileContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 20, // Reduced font size
    color: '#333333', // Dark text for readability
    fontWeight: '700',
  },
  weekListContainer: {
    alignItems: 'center',
  },
  dayContainer: {
    width: width * 0.90, // Slightly wider for better readability
    backgroundColor: '#FFFFFF',
    paddingVertical: 12, // Reduced vertical padding
    paddingHorizontal: 16,
    borderRadius: 10, // Slightly smaller border radius
    marginBottom: 12, // Reduced margin between cards
    borderWidth: 1,
    borderColor: '#E0E0E0',

  },
  disabledDayContainer: {
    backgroundColor: '#E0E0E0',
  },
  dayHeader: {
    marginBottom: 6, // Reduced margin
  },
  dayText: {
    fontSize: 16, // Reduced font size
    color: '#333333',
    fontWeight: '600',
  },
  disabledDayText: {
    color: '#A9A9A9',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10, // Smaller dot
    height: 10,
    borderRadius: 5,
    marginRight: 6, // Reduced margin
  },
  statusText: {
    fontSize: 14, // Reduced font size
    color: '#333333',
  },
  buttonRow: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;
