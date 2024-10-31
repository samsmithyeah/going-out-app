// functions/src/index.ts

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { sendExpoNotifications } from '../utils/sendExpoNotifications';

const getDateDescription = (dateStr: string): string => {
  const today = new Date();
  const targetDate = new Date(`${dateStr}T00:00:00Z`); // Treat as UTC date

  // Get today's date in UTC
  const currentUTC = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  );

  // Calculate difference in days
  const diffTime = targetDate.getTime() - currentUTC.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'tonight';
  } else if (diffDays === 1) {
    return 'tomorrow night';
  } else if (diffDays >= 2 && diffDays <= 6) {
    // Get the day of the week, e.g., "Friday"
    const options: Intl.DateTimeFormatOptions = { weekday: 'long' };
    const dayOfWeek = targetDate.toLocaleDateString('en-US', options);
    return `on ${dayOfWeek}`;
  } else {
    return `on ${dateStr}`;
  }
};

/**
 * Cloud Function to notify crew members when a user's status changes.
 */
export const notifyCrewOnStatusChange = onDocumentWritten(
  'crews/{crewId}/statuses/{date}/userStatuses/{userId}',
  async (event) => {
    const { crewId, date, userId } = event.params;

    const beforeData = event.data?.before.exists ?
      event.data.before.data() :
      null;
    const afterData = event.data?.after.exists ?
      event.data.after.data() :
      null;

    // Determine if the status was changed to up or down
    const statusChangedToUp =
      !beforeData?.upForGoingOutTonight && afterData?.upForGoingOutTonight;
    const statusChangedToDown =
      beforeData?.upForGoingOutTonight && !afterData?.upForGoingOutTonight;

    if (!statusChangedToUp && !statusChangedToDown) {
      // Status did not change in a way that requires notification
      return null;
    }

    // Fetch the crew document to get memberIds and crew.name
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
    const memberIds = crewData.memberIds.filter((id: string) => id !== userId);

    if (memberIds.length === 0) {
      console.log('No other members in the crew to notify.');
      return null;
    }

    // Fetch the user's displayName
    const userRef = admin.firestore().collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log(`User ${userId} does not exist.`);
      return null;
    }

    const userData = userDoc.data() as { displayName: string };
    const userName = userData.displayName;

    // Determine date description
    const dateDescription = getDateDescription(date);
    console.log(`Date Description: ${dateDescription}`);

    // Determine notification message based on status change
    let messageBody = '';
    if (statusChangedToUp) {
      messageBody = `${userName} is up for going out ${dateDescription}!`;
    } else if (statusChangedToDown) {
      messageBody = `${userName} is no longer up for going out ${dateDescription}.`;
    }

    console.log(`Notification Message: ${messageBody}`);

    // Collect Expo push tokens of members to notify
    const expoPushTokens: string[] = [];

    // Firestore 'in' queries support up to 10 elements
    const batchSize = 10;
    for (let i = 0; i < memberIds.length; i += batchSize) {
      const batch = memberIds.slice(i, i + batchSize);
      const usersSnapshot = await admin
        .firestore()
        .collection('users')
        .where(admin.firestore.FieldPath.documentId(), 'in', batch)
        .get();

      usersSnapshot.forEach((doc) => {
        const memberData = doc.data();
        const token = memberData?.expoPushToken;
        const tokensArray = memberData?.expoPushTokens;

        if (token && Expo.isExpoPushToken(token)) {
          expoPushTokens.push(token);
        }

        if (tokensArray && Array.isArray(tokensArray)) {
          tokensArray.forEach((tok: string) => {
            if (Expo.isExpoPushToken(tok)) {
              expoPushTokens.push(tok);
            }
          });
        }
      });
    }

    if (expoPushTokens.length === 0) {
      console.log('No valid Expo push tokens found for members.');
      return null;
    }

    // Prepare the notification messages
    const messages: ExpoPushMessage[] = expoPushTokens.map((pushToken) => ({
      to: pushToken,
      sound: 'default',
      title: crewName,
      body: messageBody,
      data: { crewId, userId, date, statusChangedToUp, statusChangedToDown, screen: 'Crew' },
    }));

    console.log(`Prepared Messages: ${JSON.stringify(messages)}`);

    // Send the notifications
    await sendExpoNotifications(messages);

    console.log('Notifications sent successfully.');

    return null;
  }
);
