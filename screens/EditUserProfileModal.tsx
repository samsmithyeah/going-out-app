// screens/EditUserProfileModal.tsx

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { useUser } from '@/context/UserContext';
import ProfilePicturePicker from '@/components/ProfilePicturePicker';
import CustomButton from '@/components/CustomButton';
import CustomTextInput from '@/components/CustomTextInput';
import Toast from 'react-native-toast-message';

const EditUserProfileModal: React.FC = () => {
  const { user, setUser } = useUser();
  const [firstName, setFirstName] = useState<string>(user?.firstName || '');
  const [lastName, setLastName] = useState<string>(user?.lastName || '');
  const [displayName, setDisplayName] = useState<string>(
    user?.displayName || '',
  );
  const [photoURL, setPhotoURL] = useState<string>(user?.photoURL || '');
  const [saving, setSaving] = useState<boolean>(false);

  const navigation = useNavigation();

  if (!user) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  const handleSave = async () => {
    // Prevent multiple save actions
    if (saving) return;

    // Validate inputs
    if (!firstName.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'First name cannot be empty.',
      });
      return;
    }

    if (!lastName.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Last name cannot be empty.',
      });
      return;
    }

    if (!displayName.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Display name cannot be empty.',
      });
      return;
    }

    setSaving(true);

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: displayName.trim(),
        photoURL: photoURL.trim(),
      });

      // Update local user context
      setUser({
        ...user,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: displayName.trim(),
        photoURL: photoURL.trim(),
      });

      Toast.show({
        type: 'success',
        text1: 'Profile updated',
        text2: 'Your profile has been updated successfully.',
      });
      navigation.goBack(); // Close the modal after saving

      // Dismiss the keyboard after saving
      Keyboard.dismiss();
    } catch (error) {
      console.error('Error updating profile:', error);
      Toast.show({
        type: 'error',
        text1: 'Update Error',
        text2: 'Failed to update your profile. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Editing',
      'Are you sure you want to discard your changes?',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes',
          onPress: () => {
            // Reset fields to original values
            setFirstName(user.firstName || '');
            setLastName(user.lastName || '');
            setDisplayName(user.displayName || '');
            setPhotoURL(user.photoURL || '');
            navigation.goBack(); // Close the modal after canceling
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile Picture */}
        <ProfilePicturePicker
          imageUrl={photoURL || null}
          onImageUpdate={async (newUrl) => {
            setPhotoURL(newUrl);
            try {
              const userRef = doc(db, 'users', user.uid);
              await updateDoc(userRef, {
                photoURL: newUrl,
              });
              console.log('photoURL updated successfully in Firestore', newUrl);
            } catch (error) {
              console.error('Error updating profile picture URL:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to update profile picture',
              });
            }
          }}
          editable={true}
          storagePath={`users/${user.uid}/profile.jpg`}
          size={150}
        />

        {/* Form Fields */}
        <View style={styles.formContainer}>
          {/* First Name */}
          <View>
            <CustomTextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Enter your first name"
              autoCapitalize="words"
              returnKeyType="next"
              hasBorder={true}
              labelText="First name"
            />
          </View>

          {/* Last Name */}
          <View>
            <CustomTextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Enter your last name"
              autoCapitalize="words"
              returnKeyType="next"
              hasBorder={true}
              labelText="Last name"
            />
          </View>

          {/* Display Name */}
          <View>
            <CustomTextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter your display name"
              autoCapitalize="words"
              returnKeyType="done"
              hasBorder={true}
              labelText="Display name"
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <CustomButton
            title="Save"
            onPress={handleSave}
            loading={saving}
            variant="primary"
            icon={{
              name: 'save-outline',
              size: 24,
              color: '#FFFFFF',
            }}
            disabled={
              saving ||
              !firstName.trim() ||
              !lastName.trim() ||
              !displayName.trim()
            }
            accessibilityLabel="Save Profile"
            accessibilityHint="Save your updated profile information"
          />

          <CustomButton
            title="Cancel"
            onPress={handleCancel}
            loading={saving}
            variant="secondary"
            icon={{
              name: 'close-outline',
              size: 24,
            }}
            accessibilityLabel="Cancel Editing"
            accessibilityHint="Discard changes and close the edit screen"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default EditUserProfileModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
    alignItems: 'center',
  },
  formContainer: {
    width: '100%',
    marginTop: 10,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    marginTop: 20,
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 100, // Add some margin to prevent the buttons from being hidden by the keyboard
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
