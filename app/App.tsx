// App.tsx
import React, { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import AppNavigator from '@/navigation/AppNavigator';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation, NavigationContainer } from '@react-navigation/native';
import { useUser } from '@/context/UserContext';
import { NavParamList } from '@/navigation/AppNavigator';
import * as Sentry from '@sentry/react-native';
import { captureConsoleIntegration } from '@sentry/integrations';

Sentry.init({
  dsn: 'https://ea17b86dea77e3f6b37bd8ad04223206@o4508365591281664.ingest.de.sentry.io/4508365591674960',
  integrations: [captureConsoleIntegration({ levels: ['warn', 'error'] })],
  tracesSampleRate: 1.0,
});

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
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
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
        const { screen, crewId, chatId, senderId, date } =
          response.notification.request.content.data;
        if (screen === 'Crew' && crewId) {
          navigation.navigate('CrewsStack', {
            screen,
            params: { crewId, ...(date && { date }) },
            initial: false,
          });
        } else if (screen === 'CrewDateChat' && chatId) {
          navigation.navigate('ChatsStack', {
            screen,
            params: { id: chatId },
            initial: false,
          });
        } else if (screen === 'DMChat' && senderId) {
          console.log('Navigating to DMChat');
          console.log('Sender ID:', senderId);
          navigation.navigate('ChatsStack', {
            screen,
            params: { otherUserId: senderId },
            initial: false,
          });
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

  const linking = {
    prefixes: [
      'com.googleusercontent.apps.814136772684-8bgo4g20f9q1p4g532kvqhj7lt497v7e://',
      'appScheme://',
      'goingoutapp://',
      'goingoutapp:///',
    ],
    config: {
      screens: {
        PhoneVerification: 'firebaseauth/link*',
      },
    },
  };

  return (
    <NavigationContainer linking={linking} independent>
      <AppNavigator />
    </NavigationContainer>
  );
};

export default Sentry.wrap(App);
