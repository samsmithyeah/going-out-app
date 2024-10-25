import { Expo, ExpoPushMessage } from 'expo-server-sdk';

// Initialize Expo SDK
const expo = new Expo();

// Helper function to send notifications via Expo
export const sendExpoNotifications = async (messages: ExpoPushMessage[]) => {
  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error('Error sending notification chunk:', error);
    }
  }

  return tickets;
};
