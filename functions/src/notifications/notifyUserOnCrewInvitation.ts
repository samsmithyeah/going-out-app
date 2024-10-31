import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { sendExpoNotifications } from '../utils/sendExpoNotifications';

// Notify user when invited to a crew
export const notifyUserOnCrewInvitation = onDocumentCreated(
  'invitations/{invitationId}',
  async (event) => {
    // Ensure event data exists
    if (!event.data) {
      console.log('Event data is undefined.');
      return null;
    }

    const invitationData = event.data.data();

    // Destructure necessary fields from invitation data
    const { crewId, toUserId, fromUserId, status } = invitationData;

    // Only send notifications for pending invitations
    if (status !== 'pending') {
      return null;
    }

    // Fetch the invited user's data
    const invitedUserRef = admin.firestore().collection('users').doc(toUserId);
    const invitedUserDoc = await invitedUserRef.get();

    if (!invitedUserDoc.exists) {
      console.log(`Invited user ${toUserId} does not exist.`);
      return null;
    }

    const invitedUserData = invitedUserDoc.data() as {
      displayName: string;
      expoPushToken?: string;
      expoPushTokens?: string[];
    };

    const expoPushTokens: string[] = [];

    // Collect all valid Expo push tokens for the invited user
    if (invitedUserData.expoPushToken && Expo.isExpoPushToken(invitedUserData.expoPushToken)) {
      expoPushTokens.push(invitedUserData.expoPushToken);
    }

    if (invitedUserData.expoPushTokens && Array.isArray(invitedUserData.expoPushTokens)) {
      invitedUserData.expoPushTokens.forEach((token) => {
        if (Expo.isExpoPushToken(token)) {
          expoPushTokens.push(token);
        }
      });
    }

    if (expoPushTokens.length === 0) {
      console.log(`No valid Expo push tokens found for user ${toUserId}.`);
      return null;
    }

    // Fetch the crew's data to get the crew name
    const crewRef = admin.firestore().collection('crews').doc(crewId);
    const crewDoc = await crewRef.get();

    if (!crewDoc.exists) {
      console.log(`Crew ${crewId} does not exist.`);
      return null;
    }

    const crewData = crewDoc.data();
    if (!crewData || !crewData.name || !crewData.memberIds) {
      console.log(`Crew ${crewId} is missing required data.`);
      return null;
    }
    const crewName = crewData.name;

    // Fetch the inviter's data to get their display name
    const inviterUserRef = admin.firestore().collection('users').doc(fromUserId);
    const inviterUserDoc = await inviterUserRef.get();

    if (!inviterUserDoc.exists) {
      console.log(`Inviter user ${fromUserId} does not exist.`);
      return null;
    }

    const inviterUserData = inviterUserDoc.data() as { displayName: string };
    const inviterUserName = inviterUserData.displayName || 'Someone';

    const messageBody = `${inviterUserName} has invited you to join their crew!`;

    const messages: ExpoPushMessage[] = expoPushTokens.map((pushToken) => ({
      to: pushToken,
      sound: 'default',
      title: `Invitation to join ${crewName}`,
      body: messageBody,
      data: {
        crewId,
        fromUserId,
        toUserId,
        screen: 'Invitations',
      },
    }));

    // Send the notifications
    await sendExpoNotifications(messages);

    console.log(`Sent crew invitation notification to user ${toUserId}.`);

    return null;
  }
);
