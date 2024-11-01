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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useUser, User } from '../context/UserContext';
import ProfilePicturePicker from '../components/ProfilePicturePicker';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { TabsParamList } from '../navigation/TabNavigator';

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
        console.warn('User not logged in');
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
      <ProfilePicturePicker
        imageUrl={user.photoURL ?? null}
        onImageUpdate={(newUrl) => {
          setUser({ ...user, photoURL: newUrl });
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
              onSubmitEditing={handleSaveDisplayName} // Handle return key press
              returnKeyType="done" // Customize the return key
              blurOnSubmit={true} // Dismiss the keyboard on submit
              editable={!saving}
            />
          </>
        ) : (
          <>
            <Text style={styles.displayName}>
              {user.displayName || 'No Display Name'}
            </Text>
            <TouchableOpacity onPress={handleEditPress} style={styles.editIcon}>
              <Ionicons name="pencil-outline" size={20} color="#1e90ff" />
            </TouchableOpacity>
          </>
        )}
      </View>

      {isEditing && (
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            onPress={handleSaveDisplayName}
            style={styles.iconButton}
            disabled={saving}
            accessibilityLabel="Save Display Name"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#28a745" />
            ) : (
              <Ionicons name="checkmark" size={24} color="#28a745" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleCancelEdit}
            style={styles.iconButton}
            disabled={saving}
            accessibilityLabel="Cancel Editing"
          >
            <Ionicons name="close" size={24} color="#ff3b30" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="exit-outline" size={24} color="white" />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default UserProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
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
  },
  iconButton: {
    marginHorizontal: 10,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainer: {
    marginTop: 40,
    width: '100%',
    alignItems: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#ff3b30',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    width: '60%',
    justifyContent: 'center',
  },
  logoutText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 10,
  },
});
