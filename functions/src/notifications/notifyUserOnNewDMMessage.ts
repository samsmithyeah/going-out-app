// functions/notifyUserOnNewDMMessage.js

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { sendExpoNotifications } from '../utils/sendExpoNotifications';

/**
 * Notify user when they receive a new Direct Message (DM)
 */
export const notifyUserOnNewDMMessage = onDocumentCreated(
  'direct_messages/{dmId}/messages/{messageId}',
  async (event) => {
    const db = admin.firestore();
    // Ensure event data exists
    if (!event.data) {
      console.log('Event data is undefined.');
      return null;
    }

    const { dmId } = event.params;
    const messageData = event.data.data();

    // Destructure necessary fields from message data
    const { senderId, text } = messageData;

    if (!senderId || !text) {
      console.log('Missing senderId or text in message data.');
      return null;
    }

    // Fetch the sender's user document to get their name
    const senderDoc = await db.collection('users').doc(senderId).get();

    if (!senderDoc.exists) {
      console.log(`Sender user ${senderId} does not exist.`);
      return null;
    }

    const senderData = senderDoc.data();
    const senderName = senderData?.displayName || 'Someone';

    // Assuming dmId is in the format 'user1_user2'
    const participantIds = dmId.split('_');
    const recipientId = participantIds.find((id) => id !== senderId);

    if (!recipientId) {
      console.log('Recipient ID not found.');
      return null;
    }

    // Fetch the recipient's user document
    const recipientDoc = await db.collection('users').doc(recipientId).get();

    if (!recipientDoc.exists) {
      console.log(`Recipient user ${recipientId} does not exist.`);
      return null;
    }

    const recipientData = recipientDoc.data();

    if (!recipientData) {
      console.log(`Recipient data for user ${recipientId} is undefined.`);
      return null;
    }

    const activeChats = recipientData.activeChats || [];

    // Check if the recipient has the DM chat open
    if (activeChats.includes(dmId)) {
      console.log('Recipient is actively viewing the DM chat. No notification sent.');
      return null;
    }

    // Collect all valid Expo push tokens for the recipient
    const expoPushTokens = [];

    if (recipientData.expoPushToken && Expo.isExpoPushToken(recipientData.expoPushToken)) {
      expoPushTokens.push(recipientData.expoPushToken);
    }

    if (recipientData.expoPushTokens && Array.isArray(recipientData.expoPushTokens)) {
      recipientData.expoPushTokens.forEach((token) => {
        if (Expo.isExpoPushToken(token)) {
          expoPushTokens.push(token);
        }
      });
    }

    if (expoPushTokens.length === 0) {
      console.log(`No valid Expo push tokens found for user ${recipientId}.`);
      return null;
    }

    // Prepare notification payload
    const messages: ExpoPushMessage[] = expoPushTokens.map((pushToken) => ({
      to: pushToken,
      sound: 'default',
      title: senderName,
      body: text,
      data: {
        screen: 'DMChat',
        dmId,
        senderId,
        senderName: senderName,
        messageText: text,
      },
      badge: 1,
    }));

    // Send the notifications using the sendExpoNotifications utility
    await sendExpoNotifications(messages);

    console.log(`Sent DM notification to user ${recipientId}.`);

    return null;
  }
);
