// App.tsx
import React, { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import AppNavigator from '../navigation/AppNavigator';
import { StackNavigationProp } from '@react-navigation/stack';
import { isDevice } from 'expo-device';
import Constants from 'expo-constants';
import { doc, updateDoc } from 'firebase/firestore';
import { Alert, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { db } from '../firebase';
import { useUser } from '../context/UserContext';
import { NavParamList } from '../navigation/AppNavigator';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const App: React.FC = () => {
  const { user } = useUser();
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();
  const navigation = useNavigation<StackNavigationProp<NavParamList>>();

  useEffect(() => {
    if (!user) return;

    const registerForPushNotificationsAsync = async () => {
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
          token = (await Notifications.getExpoPushTokenAsync({ projectId }))
            .data;
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
        Alert.alert('Must use physical device for Push Notifications');
      }

      if (token) {
        try {
          const userRef = doc(db, 'users', user.uid);
          // If storing a single token
          console.log('Updating user with token:', token);
          await updateDoc(userRef, {
            expoPushToken: token,
          });

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

    registerForPushNotificationsAsync();

    // Listen to incoming notifications while the app is foregrounded
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log('Notification Received:', notification);
      });

    // Listen to notification responses (when user taps on a notification)
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log('Notification Response:', response);
        const { screen, crewId } = response.notification.request.content.data;
        if (screen === 'Crew' && crewId) {
          navigation.navigate('CrewsStack', { screen, params: { crewId } });
        } else if (screen) {
          navigation.navigate(screen);
        } else {
          console.log('No screen to navigate to');
        }
      });

    return () => {
      Notifications.removeNotificationSubscription(
        notificationListener.current,
      );
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, [user]);

  return <AppNavigator />;
};

export default App;
