// screens/UserProfileScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Image,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useUser, User } from '../context/UserContext';

const UserProfileScreen: React.FC = () => {
  const { user } = useUser();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.uid) {
        Alert.alert('Error', 'User is not authenticated');
        setIsLoading(false);
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
          setCurrentUser(userData);
          setDisplayName(userData.displayName || '');
          setProfilePictureUrl(userData.profilePictureUrl);
        } else {
          Alert.alert('Error', 'User data not found');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        Alert.alert('Error', 'Could not fetch user data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [user?.uid]);

  // Request permissions for image picker
  useEffect(() => {
    const requestPermissions = async () => {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Sorry, we need camera roll permissions to make this work!'
          );
        }
      }
    };

    requestPermissions();
  }, []);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Square image
        quality: 0.5,
      });

      if (!result.canceled) {
        if (result.assets && result.assets.length > 0) {
          const selectedImage = result.assets[0].uri;
          await uploadImage(selectedImage);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Could not select image');
    }
  };

  const uploadImage = async (uri: string) => {
    if (!user?.uid) {
      Alert.alert('Error', 'User is not authenticated');
      return;
    }

    setIsUploadingImage(true);

    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `users/${user.uid}/profile.jpg`);

      // Upload the image to Firebase Storage
      await uploadBytes(storageRef, blob);

      // Get the download URL
      const downloadUrl = await getDownloadURL(storageRef);

      // Update Firestore with the new profile picture URL
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { profilePictureUrl: downloadUrl });

      // Update local state
      setProfilePictureUrl(downloadUrl);
      Alert.alert('Success', 'Profile picture updated');
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Could not upload image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'User is not authenticated');
      return;
    }

    if (!displayName.trim()) {
      Alert.alert('Error', 'Display name cannot be empty');
      return;
    }

    setIsUpdating(true);

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { displayName: displayName.trim() });

      // Update local state
      setCurrentUser((prev) => (prev ? { ...prev, displayName: displayName.trim() } : prev));
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Could not update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  if (!currentUser) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>User data not available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Profile Picture */}
      <TouchableOpacity onPress={pickImage} style={styles.profileImageContainer}>
        {profilePictureUrl ? (
          <Image source={{ uri: profilePictureUrl }} style={styles.profileImage} />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="person" size={50} color="#888" />
          </View>
        )}
        <Ionicons
          name="camera"
          size={24}
          color="#fff"
          style={styles.cameraIcon}
        />
      </TouchableOpacity>

      {isUploadingImage && (
        <View style={styles.uploadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.uploadingText}>Uploading Image...</Text>
        </View>
      )}

      {/* Display Name */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Display Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your display name"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />
      </View>

      {/* Update Button */}
      <TouchableOpacity
        style={styles.updateButton}
        onPress={handleUpdateProfile}
        disabled={isUpdating}
      >
        {isUpdating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.updateButtonText}>Update Profile</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

export default UserProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageContainer: {
    alignSelf: 'center',
    position: 'relative',
    marginBottom: 30,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  placeholderImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 10,
    backgroundColor: '#1e90ff',
    borderRadius: 20,
    padding: 5,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  uploadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 12,
    fontSize: 16,
  },
  updateButton: {
    backgroundColor: '#1e90ff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    textAlign: 'center',
    color: '#ff4d4d',
    fontSize: 16,
  },
});
