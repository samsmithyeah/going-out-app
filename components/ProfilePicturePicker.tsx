// components/ProfilePicturePicker.tsx

import React, { useState } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // You can choose any icon library you prefer
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator'; // Import ImageManipulator
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';

interface ProfilePicturePickerProps {
  imageUrl: string | null;
  onImageUpdate: (newUrl: string) => void;
  editable: boolean;
  storagePath: string;
  size?: number;
  iconName?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconOffsetX?: number;
  iconOffsetY?: number;
}

const ProfilePicturePicker: React.FC<ProfilePicturePickerProps> = ({
  imageUrl,
  onImageUpdate,
  editable,
  storagePath,
  size = 100,
  iconName = 'person',
  iconColor = '#888',
  iconOffsetX = 0.03,
  iconOffsetY = 0.03,
}) => {
  const [isUploading, setIsUploading] = useState(false);

  // Function to request media library permissions
  const requestPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Permission to access media library is required!');
      return false;
    }
    return true;
  };

  // Function to handle image picking
  const pickImage = async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
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

  // Function to handle image removal (Optional)
  const removeImage = async () => {
    Alert.alert(
      'Remove Image',
      'Are you sure you want to remove your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete the image from Firebase Storage
              const storageRef = ref(storage, storagePath);
              await deleteObject(storageRef);

              // Update the parent component to remove the image URL
              onImageUpdate('');
              Alert.alert('Success', 'Profile picture removed successfully');
            } catch (error) {
              console.error('Error removing image:', error);
              Alert.alert('Error', 'Could not remove image');
            }
          },
        },
      ]
    );
  };

  // Function to upload image to Firebase Storage
  const uploadImage = async (uri: string) => {
    setIsUploading(true);
    try {
      // Resize the image using ImageManipulator
      const resizedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 500 } }], // Resize to a width of 500 pixels
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG } // Compress the image
      );

      const response = await fetch(resizedImage.uri);
      const blob = await response.blob();
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, blob);

      const downloadUrl = await getDownloadURL(storageRef);
      onImageUpdate(downloadUrl);
      Alert.alert('Success', 'Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Could not upload image');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={[styles.profilePictureContainer, { width: size, height: size, borderRadius: size / 2 }]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
          />
        ) : (
          <Ionicons name={iconName} size={size * 0.5} color={iconColor} />
        )}
        {isUploading && (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        )}
      </View>
      {editable && (
        <TouchableOpacity
          onPress={pickImage}
          onLongPress={imageUrl ? removeImage : undefined} // Optional: Allow removal on long press
          style={[
            styles.editIconContainer,
            {
              width: size * 0.3,
              height: size * 0.3,
              borderRadius: (size * 0.3) / 2,
              right: size * iconOffsetX, // Dynamic horizontal offset
              bottom: size * iconOffsetY, // Dynamic vertical offset
            },
          ]}
          accessibilityLabel="Change Profile Picture"
          activeOpacity={0.7}
        >
          <Ionicons name="camera" size={size * 0.15} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default ProfilePicturePicker;

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePictureContainer: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    resizeMode: 'cover',
  },
  editIconContainer: {
    position: 'absolute',
    backgroundColor: '#1e90ff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 1,
    elevation: 2, // For Android
  },
  uploadingOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    borderRadius: 999, // Ensure it's circular
  },
});
