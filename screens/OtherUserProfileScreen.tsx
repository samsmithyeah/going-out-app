// screens/OtherUserProfileScreen.tsx

import React, { useEffect, useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import {
  RouteProp,
  useRoute,
  useNavigation,
  NavigationProp,
} from '@react-navigation/native';
import { User } from '@/types/User';
import ProfilePicturePicker from '@/components/ProfilePicturePicker';
import { NavParamList } from '@/navigation/AppNavigator';
import Toast from 'react-native-toast-message';
import CustomButton from '@/components/CustomButton';
import Colors from '@styles/colors';

type OtherUserProfileScreenRouteProp = RouteProp<
  NavParamList,
  'OtherUserProfile'
>;

const OtherUserProfileScreen: React.FC = () => {
  const route = useRoute<OtherUserProfileScreenRouteProp>();
  const navigation = useNavigation<NavigationProp<NavParamList>>();
  const { userId } = route.params;

  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const fetchedUser: User = {
            uid: userSnap.id,
            displayName: userData.displayName || '',
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            email: userData.email || '',
            photoURL: userData.photoURL || '',
          };
          setUserProfile(fetchedUser);
        } else {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'User profile not found',
          });
          navigation.goBack();
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Could not fetch user profile',
        });
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId, navigation]);

  useLayoutEffect(() => {
    if (userProfile) {
      navigation.setOptions({
        title: userProfile.displayName || 'User Profile',
      });
    }
  });

  // Optional: Add buttons like "Send Message" or "Add Friend"
  // For now, we'll keep it simple as per your request

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  if (!userProfile) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>User profile not available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ProfilePicturePicker
        imageUrl={userProfile.photoURL ?? null}
        onImageUpdate={() => {}}
        editable={false}
        storagePath={`users/${userProfile.uid}/profile.jpg`}
        size={150}
      />

      <View style={styles.infoContainer}>
        <InfoItem
          label="Name"
          value={`${userProfile.firstName} ${userProfile.lastName}`}
        />
        <InfoItem
          label="Display Name"
          value={userProfile.displayName || 'N/A'}
        />
        <InfoItem label="Email Address" value={userProfile.email || 'N/A'} />
      </View>

      <View style={styles.chatButton}>
        <CustomButton
          title={`Send a message to ${userProfile.displayName}`}
          onPress={() =>
            navigation.navigate('DMChat', {
              otherUserId: userProfile.uid,
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
    </View>
  );
};

// Reusable component for displaying label-value pairs
interface InfoItemProps {
  label: string;
  value: string;
}

const InfoItem: React.FC<InfoItemProps> = ({ label, value }) => (
  <View style={styles.infoItem}>
    <Text style={styles.infoLabel}>{label}:</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

export default OtherUserProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginTop: 20,
  },
  infoItem: {
    flexDirection: 'row',
    marginVertical: 8,
  },
  infoLabel: {
    fontWeight: '600',
    fontSize: 16,
    width: '40%',
    color: '#333',
  },
  infoValue: {
    fontSize: 16,
    color: '#555',
    flexShrink: 1,
  },
  errorText: {
    fontSize: 16,
    color: 'red',
  },
  chatButton: {
    marginTop: 20,
  },
});
