// app/_layout.tsx

import React, { useEffect, useRef } from 'react';
import { Slot, useRouter } from 'expo-router';
import { UserProvider } from '@/context/UserContext';
import { CrewsProvider } from '@/context/CrewsContext';
import { ContactsProvider } from '@/context/ContactsContext';
import { InvitationsProvider } from '@/context/InvitationsContext';
import { CrewDateChatProvider } from '@/context/CrewDateChatContext';
import { DirectMessagesProvider } from '@/context/DirectMessagesContext';
import { BadgeCountProvider } from '@/context/BadgeCountContext';
import Toast, {
  BaseToast,
  ErrorToast,
  InfoToast,
  ToastProps,
} from 'react-native-toast-message';
import { LogBox } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import { captureConsoleIntegration } from '@sentry/core';

// Initialize Sentry
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

LogBox.ignoreLogs([
  'Sending `onAnimatedValueUpdate` with no listeners registered.',
]);

const toastConfig = {
  success: (props: ToastProps) => (
    <BaseToast
      {...props}
      text1Style={{ fontSize: 15, fontWeight: '400' }}
      text2Style={{ fontSize: 13 }}
      style={{ borderLeftColor: '#008000' }}
    />
  ),
  error: (props: ToastProps) => (
    <ErrorToast
      {...props}
      text1Style={{ fontSize: 15, fontWeight: '400' }}
      text2Style={{ fontSize: 13 }}
      style={{ borderLeftColor: '#FF0000' }}
    />
  ),
  info: (props: ToastProps) => (
    <InfoToast
      {...props}
      text1Style={{ fontSize: 15, fontWeight: '400' }}
      text2Style={{ fontSize: 13 }}
      style={{ borderLeftColor: '#FFA500' }}
    />
  ),
};

export default function RootLayout() {
  const router = useRouter();
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    // Listen for incoming notifications while app is foregrounded
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log('Notification Received:', notification);
      });

    // Listen for notification responses (when user taps on notification)
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log('Notification Response:', response);
        const { screen, crewId, chatId, senderId, date } = response.notification
          .request.content.data as {
          screen?: string;
          crewId?: string;
          chatId?: string;
          senderId?: string;
          date?: string;
        };

        // Navigate based on notification data
        if (screen === 'Crew' && crewId) {
          router.push(`/crews/${crewId}${date ? `?date=${date}` : ''}`);
        } else if (screen === 'CrewDateChat' && chatId) {
          router.push(`/chats/crew-date-chat/${chatId}`);
        } else if (screen === 'DMChat' && senderId) {
          router.push(`/chats/dm/${senderId}`);
        } else if (screen) {
          router.push(`./${screen.toLowerCase()}`);
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
  }, [router]);

  return (
    <UserProvider>
      <ContactsProvider>
        <CrewsProvider>
          <InvitationsProvider>
            <CrewDateChatProvider>
              <DirectMessagesProvider>
                <BadgeCountProvider>
                  <Toast config={toastConfig} />
                  <Slot />
                </BadgeCountProvider>
              </DirectMessagesProvider>
            </CrewDateChatProvider>
          </InvitationsProvider>
        </CrewsProvider>
      </ContactsProvider>
    </UserProvider>
  );
}
