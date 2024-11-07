// screens/UserProfileScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from '../context/UserContext';
import { User } from '../types/User';
import ProfilePicturePicker from '../components/ProfilePicturePicker';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { TabsParamList } from '../navigation/TabNavigator';
import ScreenTitle from '../components/ScreenTitle';
import CustomButton from '../components/CustomButton'; // Import CustomButton

type UserProfileScreenProps = BottomTabScreenProps<
  TabsParamList,
  'UserProfile'
>;

const UserProfileScreen: React.FC<UserProfileScreenProps> = ({
  navigation,
}) => {
  const { user, setUser, logout } = useUser();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const handleLogout = async () => {
    try {
      await logout(); // Call the logout function from UserContext
    } catch (error) {
      console.error('Error logging out: ', error);
      Alert.alert('Logout Error', 'An error occurred while logging out.');
    }
  };

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.uid) {
        console.log('User not logged in');
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();

          // Ensure 'uid' exists in the fetched
          if (!userData.uid) {
            Alert.alert('Error', 'User UID is missing in the profile.');
            return;
          }

          const updatedUser: User = {
            uid: userSnap.id, // Ensure 'uid' is set correctly
            displayName: userData.displayName || '',
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
            photoURL: userData.photoURL,
            // Include other fields as necessary
          };
          setUser(updatedUser);
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

  const handleEditPress = () => {
    setNewDisplayName(user?.displayName || '');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setNewDisplayName('');
  };

  const handleSaveDisplayName = async () => {
    // Prevent multiple save actions
    if (saving) return;

    // Validate the new display name
    if (!newDisplayName.trim()) {
      Alert.alert('Validation Error', 'Display name cannot be empty.');
      return;
    }

    // Ensure 'user' and 'user.uid' are defined
    if (!user || !user.uid) {
      Alert.alert('Error', 'User is not logged in.');
      return;
    }

    setSaving(true);

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: newDisplayName.trim(),
      });

      // Update local user context
      setUser({ ...user, displayName: newDisplayName.trim() });

      // Alert.alert('Success', 'Display name updated successfully.');
      setIsEditing(false);

      // Dismiss the keyboard after saving
      Keyboard.dismiss();
    } catch (error) {
      console.error('Error updating display name:', error);
      Alert.alert('Update Error', 'Failed to update display name.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenTitle title="Your profile" />
      <View style={styles.detailsContainer}>
        <ProfilePicturePicker
          imageUrl={user.photoURL ?? null}
          onImageUpdate={async (newUrl) => {
            // Update local state
            setUser({ ...user, photoURL: newUrl });

            // Update Firestore
            try {
              const userRef = doc(db, 'users', user.uid);
              await updateDoc(userRef, {
                photoURL: newUrl,
              });
              console.log('photoURL updated successfully in Firestore', newUrl);
            } catch (error) {
              console.error('Error updating profile picture URL:', error);
              Alert.alert('Update Error', 'Failed to update profile picture.');
            }
          }}
          editable={true}
          storagePath={`users/${user.uid}/profile.jpg`}
          size={150}
        />

        <View style={styles.displayNameContainer}>
          {isEditing ? (
            <>
              <TextInput
                style={styles.displayNameInput}
                value={newDisplayName}
                onChangeText={setNewDisplayName}
                placeholder="Enter new display name"
                autoFocus
                maxLength={30}
                onSubmitEditing={handleSaveDisplayName}
                returnKeyType="done"
                blurOnSubmit={true}
                editable={!saving}
              />
            </>
          ) : (
            <>
              <Text style={styles.displayName}>
                {user.displayName || 'No Display Name'}
              </Text>
              <TouchableOpacity
                onPress={handleEditPress}
                style={styles.editIcon}
                accessibilityLabel="Edit Display Name"
                accessibilityHint="Enable editing of your display name"
              >
                <Ionicons name="pencil-outline" size={20} color="#1e90ff" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {isEditing && (
        <View style={styles.actionButtonsContainer}>
          {/* Replace Save Button */}
          <CustomButton
            title="Save"
            onPress={handleSaveDisplayName}
            loading={saving}
            variant="success" // Green variant
            icon={{
              name: 'checkmark',
              size: 24,
              library: 'Ionicons',
            }}
            accessibilityLabel="Save Display Name"
            accessibilityHint="Save your new display name"
          />

          {/* Replace Cancel Button */}
          <CustomButton
            title="Cancel"
            onPress={handleCancelEdit}
            loading={saving} // Optional: show loading state if needed
            variant="danger" // Red variant
            icon={{
              name: 'close',
              size: 24,
              library: 'Ionicons',
            }}
            accessibilityLabel="Cancel Editing"
            accessibilityHint="Discard changes to your display name"
          />
        </View>
      )}

      <View style={styles.buttonContainer}>
        {/* Replace Log out Button */}
        <CustomButton
          title="Log out"
          onPress={handleLogout}
          variant="danger" // Red variant
          icon={{
            name: 'exit-outline',
            size: 24,
            library: 'Ionicons',
          }}
          accessibilityLabel="Log out"
          accessibilityHint="Log out of your account"
        />
      </View>
    </KeyboardAvoidingView>
  );
};

export default UserProfileScreen;

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  detailsContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  displayNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  displayNameInput: {
    fontSize: 24,
    borderBottomWidth: 1,
    borderColor: '#1e90ff',
    padding: 5,
    width: '60%',
    textAlign: 'center',
  },
  editIcon: {
    marginLeft: 10,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    marginTop: 10,
    justifyContent: 'space-between',
    width: '80%',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainer: {
    marginTop: 40,
    width: width * 0.8,
    justifyContent: 'center',
    flexDirection: 'row',
    position: 'absolute',
    bottom: 100,
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#ff3b30',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    width: '60%',
    justifyContent: 'center',
    position: 'absolute',
  },
  logoutText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 10,
  },
});
