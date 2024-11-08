// screens/HomeScreen.tsx

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from '../context/UserContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import ProfilePicturePicker from '../components/ProfilePicturePicker';
import CustomButton from '../components/CustomButton'; // Import CustomButton

const HomeScreen: React.FC = () => {
  const { user } = useUser();
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const [totalCrews, setTotalCrews] = useState<number>(0); // Y
  const [upCrews, setUpCrews] = useState<number>(0); // X
  const [loading, setLoading] = useState<boolean>(true); // To handle initial loading state

  // Utility function to get today's date in 'YYYY-MM-DD' format
  const getTodayDateString = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Function to fetch current status
  const fetchCurrentStatus = async () => {
    if (!user?.uid) {
      console.warn('User not found.');
      setLoading(false);
      return;
    }

    try {
      // Query all crews where the user is a member
      const crewsRef = collection(db, 'crews');
      const q = query(crewsRef, where('memberIds', 'array-contains', user.uid));
      const crewsSnapshot = await getDocs(q);

      const Y = crewsSnapshot.size; // Total number of crews
      let X = 0; // Number of crews where user is up

      if (crewsSnapshot.empty) {
        console.log('User is not part of any crews.');
        setTotalCrews(0);
        setUpCrews(0);
        setLoading(false);
        return;
      }

      // Iterate through each crew to fetch the user's status
      const todayDate = getTodayDateString();
      const batchPromises = crewsSnapshot.docs.map(async (crewDoc) => {
        const crewId = crewDoc.id;
        const userStatusRef = doc(
          db,
          'crews',
          crewId,
          'statuses',
          todayDate,
          'userStatuses',
          user.uid,
        );
        const statusSnap = await getDoc(userStatusRef);

        if (statusSnap.exists()) {
          const statusData = statusSnap.data();
          if (typeof statusData.upForGoingOutTonight === 'boolean') {
            if (statusData.upForGoingOutTonight) {
              X += 1;
            }
          }
        }
      });

      await Promise.all(batchPromises); // Wait for all status fetches to complete

      setTotalCrews(Y);
      setUpCrews(X);
    } catch (error) {
      console.error('Error fetching current status:', error);
      Alert.alert('Error', 'There was an issue fetching your current status.');
    } finally {
      setLoading(false);
    }
  };

  // Use useFocusEffect to fetch status every time the screen is focused
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchCurrentStatus();
    }, [user?.uid]), // Re-run if user.uid changes
  );

  // Function to toggle user's status across all crews
  const toggleStatusAcrossCrews = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'User not found.');
      return;
    }

    setUpdatingStatus(true); // Start loading

    try {
      // Query all crews where the user is a member
      const crewsRef = collection(db, 'crews');
      const q = query(crewsRef, where('memberIds', 'array-contains', user.uid));
      const crewsSnapshot = await getDocs(q);

      const Y = crewsSnapshot.size; // Total number of crews

      if (crewsSnapshot.empty) {
        Alert.alert('No Crews Found', 'You are not part of any crews.');
        setUpdatingStatus(false);
        return;
      }

      // Determine the new status
      const newStatus = upCrews < Y; // If not all crews are up, set to up; else set to not up
      let newUpCrews = newStatus ? Y : 0; // New number of up crews

      const batch = writeBatch(db); // Initialize batch for atomic updates
      const todayDate = getTodayDateString();

      crewsSnapshot.forEach((crewDoc) => {
        const crewId = crewDoc.id;
        const userStatusRef = doc(
          db,
          'crews',
          crewId,
          'statuses',
          todayDate,
          'userStatuses',
          user.uid,
        );

        // Update the user's status
        batch.set(
          userStatusRef,
          {
            upForGoingOutTonight: newStatus,
            timestamp: Timestamp.fromDate(new Date()),
          },
          { merge: true }, // Merge with existing data
        );
      });

      await batch.commit(); // Commit all updates atomically

      setUpCrews(newUpCrews); // Update upCrews count

      Alert.alert(
        'Success',
        `You've been marked as ${newStatus ? 'up' : 'not up'} for it in all your crews.`,
      );
    } catch (error) {
      console.error('Error toggling statuses:', error);
      Alert.alert('Error', 'There was an issue updating your status.');
    } finally {
      setUpdatingStatus(false); // End loading
    }
  };

  // Function to handle confirmation before toggling status
  const handleToggleStatus = () => {
    const action =
      upCrews === totalCrews
        ? 'mark yourself as not up for it in all your crews'
        : 'mark yourself as up for it in all your crews';
    Alert.alert(
      'Confirm status change',
      `Are you sure you want to ${action}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm',
          onPress: toggleStatusAcrossCrews,
          style: 'destructive',
        },
      ],
      { cancelable: true },
    );
  };

  // Determine the status message based on upCrews and totalCrews
  const getStatusMessage = () => {
    if (totalCrews === 0) {
      return 'You are not in any crews yet 😢';
    } else if (upCrews === 0) {
      return 'You are not marked as up for it in any of your crews today.';
    } else if (upCrews === totalCrews) {
      return 'You are marked as up for it in all of your crews today!';
    } else {
      return `You are marked as up for it with ${upCrews} of your ${totalCrews} crews today.`;
    }
  };

  // Render loading indicator while fetching data
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E90FF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Profile Section */}
      <View style={styles.profileContainer}>
        <Text style={styles.greeting}>Hi {user?.displayName}!</Text>
        <ProfilePicturePicker
          imageUrl={user?.photoURL || null}
          onImageUpdate={() => {}}
          editable={false}
          size={150}
          borderWidth={3}
          borderColor="#fff"
          iconName="person"
          iconColor="#888"
          iconOffsetX={0.03}
          iconOffsetY={0.03}
        />
      </View>

      {/* Status Summary Card */}
      <View style={styles.statusSummaryCard}>
        <Icon
          name={
            upCrews === 0
              ? 'highlight-off'
              : upCrews === totalCrews
                ? 'check-circle'
                : 'info'
          }
          size={30}
          color={
            upCrews === 0
              ? '#FF6347' // Tomato
              : upCrews === totalCrews
                ? '#32CD32' // LimeGreen
                : '#1E90FF' // DodgerBlue
          }
          style={styles.statusIcon}
        />
        <View style={styles.statusTextContainer}>
          <Text style={styles.statusSummaryText}>{getStatusMessage()}</Text>
        </View>
      </View>

      {/* Toggle Status Button - Render only if the user is part of at least one crew */}
      {totalCrews > 0 && (
        <View style={{ position: 'absolute', bottom: 20 }}>
          <CustomButton
            title={
              upCrews === totalCrews
                ? "I'm no longer up for seeing any of my crews today"
                : "I'm up for seeing any of my crews today!"
            }
            onPress={handleToggleStatus}
            loading={updatingStatus}
            variant={upCrews === totalCrews ? 'danger' : 'primary'} // Choose variant based on status
            icon={{
              name:
                upCrews === totalCrews
                  ? 'remove-circle-outline'
                  : 'checkmark-circle-outline',
              size: 24,
              library: 'Ionicons', // Specify icon library if different
            }}
            accessibilityLabel="Toggle Status"
            accessibilityHint={
              upCrews === totalCrews
                ? 'Mark yourself as not up for it in all your crews for today'
                : 'Mark yourself as up for it in all your crews for today'
            }
          />
        </View>
      )}
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F5F5F5', // Solid light background
    alignItems: 'center',
    justifyContent: 'flex-start', // Ensure content starts from top
  },
  profileContainer: {
    alignItems: 'center',
    marginTop: 50,
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    color: '#333333', // Dark text for readability
    fontWeight: '700',
    marginTop: 15,
    marginBottom: 10,
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
    marginBottom: 20, // Space between card and button
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Additional styles can be added here if needed
});

export default HomeScreen;
