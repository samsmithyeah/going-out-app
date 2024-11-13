// App.tsx
import React, { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import AppNavigator from '../navigation/AppNavigator';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
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
