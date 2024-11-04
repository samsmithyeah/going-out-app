import { isDevice } from 'expo-device';
import Constants from 'expo-constants';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { db } from '../firebase';
import { User } from '../types/User';

const registerForPushNotificationsAsync = async (user: User) => {
  let token;

  if (isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    console.log('Existing permission status:', existingStatus);
    if (existingStatus !== 'granted') {
      console.log('Requesting permission for push notifications');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('Permission status:', finalStatus);
    }
    if (finalStatus !== 'granted') {
      Alert.alert('Failed to get push token for push notification!');
      return;
    }
    console.log('Getting Expo push token');
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        throw new Error('Project ID is not defined in Expo config');
      }
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error getting Expo push token:', error.message);
        console.error('Error getting Expo push token:', error);
      } else {
        Alert.alert(
          'Error getting Expo push token, contact developer for details',
        );
        console.error('Error getting Expo push token:', error);
      }
    }
    console.log('Expo Push Token:', token);
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  if (token) {
    try {
      const userRef = doc(db, 'users', user.uid);
      // If storing a single token
      console.log('Updating user with token:', token);
      await updateDoc(userRef, {
        expoPushToken: token,
      });
      console.log('Expo push token saved successfully.');

      // If supporting multiple tokens per user (e.g., multiple devices)
      // await updateDoc(userRef, {
      //   expoPushTokens: arrayUnion(token),
      // });
    } catch (error) {
      console.error('Error saving Expo push token:', error);
    }
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }
};

export const addUserToFirestore = async (user: User) => {
  const userDocRef = doc(db, 'users', user.uid);
  try {
    console.log(
      `Adding/updating user in Firestore: ${user.displayName} (${user.email}). Photo: ${user.photoURL}`,
    );
    const userData: User = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      firstName: user.firstName,
      lastName: user.lastName,
      photoURL: user.photoURL,
    };

    const userExists = (await getDoc(userDocRef)).exists();
    if (userExists) {
      console.log('User document already exists in Firestore.');
      return;
    }
    await setDoc(userDocRef, userData, { merge: true });
    await registerForPushNotificationsAsync(user);
    console.log('User document added to Firestore.');
  } catch (err: any) {
    console.error('Error adding user document:', err);
  }
};
