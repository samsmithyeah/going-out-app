// screens/HomeScreen.tsx

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
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
import { db } from '../firebase';
import { useUser } from '../context/UserContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import CustomButton from '../components/CustomButton';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import moment from 'moment';

// Configure locale for react-native-calendars if needed
LocaleConfig.locales['en'] = {
  monthNames: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  monthNamesShort: [
    'Jan.',
    'Feb.',
    'Mar.',
    'Apr.',
    'May',
    'Jun.',
    'Jul.',
    'Aug.',
    'Sep.',
    'Oct.',
    'Nov.',
    'Dec.',
  ],
  dayNames: [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ],
  dayNamesShort: ['Sun.', 'Mon.', 'Tue.', 'Wed.', 'Thu.', 'Fri.', 'Sat.'],
};
LocaleConfig.defaultLocale = 'en';

// Utility function to generate an array of date strings between two dates
const generateDateRange = (startDate: Date, endDate: Date): string[] => {
  const dates = [];
  let currentDate = moment(startDate);
  const lastDate = moment(endDate);

  while (currentDate.isSameOrBefore(lastDate, 'day')) {
    dates.push(currentDate.format('YYYY-MM-DD'));
    currentDate = currentDate.add(1, 'day');
  }

  return dates;
};

const HomeScreen: React.FC = () => {
  const { user } = useUser();
  const [loading, setLoading] = useState<boolean>(true);
  const [markedDates, setMarkedDates] = useState<{ [key: string]: any }>({});
  const [selectedDate, setSelectedDate] = useState<string>(
    moment().format('YYYY-MM-DD'),
  );
  const [dateCounts, setDateCounts] = useState<{ [key: string]: number }>({});

  // Define the date range for the heatmap (e.g., past 30 days)
  const dateRange = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 29); // Past 30 days including today
    return generateDateRange(startDate, endDate);
  }, []);

  // Fetch the user's up statuses across all crews within the date range
  const fetchUpStatuses = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'User not authenticated');
      setLoading(false);
      return;
    }

    try {
      const crewsRef = collection(db, 'crews');
      const userCrewsQuery = query(
        crewsRef,
        where('memberIds', 'array-contains', user.uid),
      );
      const crewsSnapshot = await getDocs(userCrewsQuery);

      if (crewsSnapshot.empty) {
        setMarkedDates({});
        setDateCounts({});
        setLoading(false);
        return;
      }

      const counts: { [key: string]: number } = {};

      // Initialize counts for each date
      dateRange.forEach((date) => {
        counts[date] = 0;
      });

      // Prepare all status document references
      const statusDocRefs = crewsSnapshot.docs.flatMap((crewDoc) =>
        dateRange.map((date) =>
          doc(
            db,
            'crews',
            crewDoc.id,
            'statuses',
            date,
            'userStatuses',
            user.uid,
          ),
        ),
      );

      // Fetch all status documents concurrently
      const statusSnapshots = await Promise.all(
        statusDocRefs.map((ref) => getDoc(ref)),
      );

      // Aggregate counts
      statusSnapshots.forEach((statusSnap, index) => {
        if (statusSnap.exists()) {
          const statusData = statusSnap.data();
          if (typeof statusData.upForGoingOutTonight === 'boolean') {
            if (statusData.upForGoingOutTonight) {
              const date = dateRange[index % dateRange.length];
              counts[date] += 1;
            }
          }
        }
      });

      setDateCounts(counts);

      // Map counts to markedDates with appropriate colors and disable past dates
      const newMarkedDates: { [key: string]: any } = {};

      Object.keys(counts).forEach((date) => {
        const count = counts[date];
        const isPastDate = moment(date).isBefore(moment(), 'day'); // Check if date is before today

        newMarkedDates[date] = {
          ...(count > 0 && {
            dots: [
              {
                key: 'up',
                color: getHeatmapColor(count),
              },
            ],
          }),
          ...(isPastDate && {
            disabled: true, // Disable past dates
            disableTouchEvent: true, // Optional: further disable touch events
          }),
        };
      });

      // Highlight the selected date
      newMarkedDates[selectedDate] = {
        ...(newMarkedDates[selectedDate] || {}),
        selected: true,
        selectedColor: '#1E90FF',
      };

      setMarkedDates(newMarkedDates);
    } catch (error) {
      console.error('Error fetching up statuses:', error);
      Alert.alert('Error', 'There was an issue fetching your up statuses.');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to determine color based on count
  const getHeatmapColor = (count: number): string => {
    if (count >= 5) return '#FF0000'; // Red for high count
    if (count >= 3) return '#FFA500'; // Orange for medium count
    return '#32CD32'; // Green for low count
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchUpStatuses();
    }, [user?.uid, dateRange]), // Removed 'selectedDate' from dependencies
  );

  // Update markedDates whenever data or selectedDate changes
  useEffect(() => {
    if (dateCounts && Object.keys(dateCounts).length > 0) {
      const newMarkedDates: { [key: string]: any } = {};

      Object.keys(dateCounts).forEach((date) => {
        const count = dateCounts[date];
        const isPastDate = moment(date).isBefore(moment(), 'day');

        newMarkedDates[date] = {
          ...(count > 0 && {
            dots: [
              {
                key: 'up',
                color: getHeatmapColor(count),
              },
            ],
          }),
          ...(isPastDate && {
            disabled: true,
            disableTouchEvent: true, // Ensures disabled dates are not touchable
          }),
        };
      });

      // Highlight the selected date
      newMarkedDates[selectedDate] = {
        ...(newMarkedDates[selectedDate] || {}),
        selected: true,
        selectedColor: '#1E90FF',
      };

      setMarkedDates(newMarkedDates);
    }
  }, [dateCounts, selectedDate]);

  // Handle date selection to show more details if needed
  const onDayPress = (day: any) => {
    setSelectedDate(day.dateString);

    // Update the markedDates for the newly selected date
    const updatedMarkedDates = { ...markedDates };

    // Remove 'selected' from the previous date
    Object.keys(updatedMarkedDates).forEach((date) => {
      if (updatedMarkedDates[date].selected) {
        updatedMarkedDates[date].selected = false;
        updatedMarkedDates[date].selectedColor = undefined;
      }
    });

    // Highlight the new selected date
    updatedMarkedDates[day.dateString] = {
      ...(updatedMarkedDates[day.dateString] || {}),
      selected: true,
      selectedColor: '#1E90FF',
    };

    setMarkedDates(updatedMarkedDates);
  };

  // Function to toggle user's status for the selected date across all crews
  const toggleStatusForSelectedDate = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setLoading(true);

    try {
      const crewsRef = collection(db, 'crews');
      const userCrewsQuery = query(
        crewsRef,
        where('memberIds', 'array-contains', user.uid),
      );
      const crewsSnapshot = await getDocs(userCrewsQuery);

      if (crewsSnapshot.empty) {
        Alert.alert('Info', 'You are not part of any crews.');
        setLoading(false);
        return;
      }

      const batch = writeBatch(db);
      const selectedDateStr = selectedDate; // e.g., '2023-09-15'

      // Determine the new status based on current status
      let currentStatus = false;
      if (dateCounts[selectedDateStr] > 0) {
        currentStatus = true;
      }

      const newStatus = !currentStatus;

      crewsSnapshot.forEach((crewDoc) => {
        const crewId = crewDoc.id;
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

      Alert.alert(
        'Success',
        `You have been marked as ${newStatus ? 'up' : 'not up'} for it on ${moment(
          selectedDateStr,
        ).format('MMMM Do, YYYY')}.`,
      );

      // Update the cached dateCounts
      setDateCounts((prevCounts) => ({
        ...prevCounts,
        [selectedDateStr]: newStatus
          ? prevCounts[selectedDateStr] + 1
          : Math.max(prevCounts[selectedDateStr] - 1, 0),
      }));

      // Update the markedDates for the selected date
      const updatedMarkedDates = { ...markedDates };
      if (newStatus) {
        if (updatedMarkedDates[selectedDateStr]) {
          updatedMarkedDates[selectedDateStr].dots[0].color = getHeatmapColor(
            dateCounts[selectedDateStr] + 1,
          );
        } else {
          updatedMarkedDates[selectedDateStr] = {
            dots: [
              {
                key: 'up',
                color: getHeatmapColor(1),
              },
            ],
          };
        }
      } else {
        if (dateCounts[selectedDateStr] - 1 > 0) {
          updatedMarkedDates[selectedDateStr].dots[0].color = getHeatmapColor(
            dateCounts[selectedDateStr] - 1,
          );
        } else {
          delete updatedMarkedDates[selectedDateStr];
        }
      }

      // Ensure the selected date remains highlighted
      updatedMarkedDates[selectedDateStr] = {
        ...(updatedMarkedDates[selectedDateStr] || {}),
        selected: true,
        selectedColor: '#1E90FF',
      };

      setMarkedDates(updatedMarkedDates);
    } catch (error) {
      console.error('Error toggling status:', error);
      Alert.alert('Error', 'There was an issue updating your status.');
    } finally {
      setLoading(false);
    }
  };

  // Function to handle confirmation before toggling status
  const handleToggleStatus = () => {
    const action =
      dateCounts[selectedDate] > 0
        ? 'mark yourself as not up for it in all your crews on this day'
        : 'mark yourself as up for it in all your crews on this day';
    Alert.alert(
      'Confirm Status Change',
      `Are you sure you want to ${action}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm',
          onPress: toggleStatusForSelectedDate,
          style: 'destructive',
        },
      ],
      { cancelable: true },
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
        <Text style={styles.greeting}>Hi {user?.displayName}!</Text>
      </View>

      {/* Calendar Heatmap */}
      <View style={styles.calendarContainer}>
        <Calendar
          current={selectedDate}
          onDayPress={onDayPress}
          markingType={'multi-dot'}
          markedDates={markedDates}
          disableAllTouchEventsForDisabledDays={true} // Prevent interaction with disabled dates
          theme={{
            selectedDayBackgroundColor: '#1E90FF',
            todayTextColor: '#1E90FF',
            arrowColor: '#1E90FF',
            dotColor: '#1E90FF',
            selectedDotColor: '#ffffff',
            disabledArrowColor: '#d9e1e8', // Optional: change arrow color when disabled
            disabledDayTextColor: '#d9e1e8', // Optional: change text color for disabled dates
          }}
        />
      </View>

      {/* Status Summary */}
      <View style={styles.statusSummaryCard}>
        <Icon
          name={dateCounts[selectedDate] > 0 ? 'check-circle' : 'highlight-off'}
          size={30}
          color={
            dateCounts[selectedDate] > 0
              ? '#32CD32' // Green
              : '#FF6347' // Tomato
          }
          style={styles.statusIcon}
        />
        <View style={styles.statusTextContainer}>
          <Text style={styles.statusSummaryText}>
            {dateCounts[selectedDate] > 0
              ? `You are up for ${dateCounts[selectedDate]} crew(s) on ${moment(
                  selectedDate,
                ).format('MMMM Do, YYYY')}.`
              : `You are not up for any crews on ${moment(selectedDate).format(
                  'MMMM Do, YYYY',
                )}.`}
          </Text>
        </View>
      </View>

      {/* Toggle Status Button */}
      <View style={styles.toggleButtonContainer}>
        <CustomButton
          title={
            dateCounts[selectedDate] > 0
              ? "I'm no longer up for seeing any of my crews on this day"
              : "I'm up for seeing any of my crews on this day!"
          }
          onPress={handleToggleStatus}
          variant={dateCounts[selectedDate] > 0 ? 'danger' : 'primary'}
          icon={{
            name:
              dateCounts[selectedDate] > 0
                ? 'remove-circle-outline'
                : 'checkmark-circle-outline',
            size: 24,
            library: 'Ionicons',
          }}
          accessibilityLabel="Toggle Status"
          accessibilityHint={
            dateCounts[selectedDate] > 0
              ? 'Mark yourself as not up for it in all your crews for this day'
              : 'Mark yourself as up for it in all your crews for this day'
          }
        />
      </View>
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
    marginTop: 20,
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    color: '#333333', // Dark text for readability
    fontWeight: '700',
    marginTop: 15,
    marginBottom: 10,
  },
  calendarContainer: {
    width: '100%',
    marginBottom: 20,
  },
  statusSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 15,
    width: width * 0.9,
    borderWidth: 2,
    borderColor: '#F0F0F0',
    marginBottom: 20,
  },
  statusIcon: {
    marginRight: 15,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusSummaryText: {
    fontSize: 18,
    color: '#333333',
    fontWeight: '500',
    flexWrap: 'wrap',
  },
  toggleButtonContainer: {
    width: '100%',
    paddingHorizontal: 16,
    position: 'absolute',
    bottom: 20,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;
