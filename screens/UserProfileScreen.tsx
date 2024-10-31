// screens/UserProfileScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useUser, User } from '../context/UserContext';
import ProfilePicturePicker from '../components/ProfilePicturePicker';

const UserProfileScreen: React.FC = () => {
  const { user, setUser } = useUser();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.uid) {
        Alert.alert('Error', 'User not authenticated');
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData: User = {
            uid: userSnap.id,
            ...(userSnap.data() as Omit<User, 'uid'>),
          };
          setUser(userData);
        } else {
          Alert.alert('Error', 'User profile not found');
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        Alert.alert('Error', 'Could not fetch user profile');
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [user?.uid, setUser]);

  if (loading || !user) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ProfilePicturePicker
        imageUrl={user.photoURL ?? null}
        onImageUpdate={(newUrl) => {
          setUser({ ...user, photoURL: newUrl });
        }}
        editable={true}
        storagePath={`users/${user.uid}/profile.jpg`}
        size={150}
      />
      <Text style={styles.displayName}>{user.displayName || 'No Display Name'}</Text>
      {/* Add other user profile details here */}
    </View>
  );
};

export default UserProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
  },
  displayName: {
    fontSize: 24,
    marginTop: 20,
    fontWeight: 'bold',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
