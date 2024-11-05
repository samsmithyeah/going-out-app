// functions/src/notifyCrewOnThreeUp.ts

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { sendExpoNotifications } from '../utils/sendExpoNotifications';
import { getDateDescription } from './notifyCrewOnStatusChange';

export const notifyCrewOnThreeUp = onDocumentWritten(
  'crews/{crewId}/statuses/{date}/userStatuses/{userId}',
  async (event) => {
    const db = admin.firestore();
    const { crewId, date } = event.params;

    const beforeData = event.data?.before.exists ?
      event.data.before.data() :
      null;
    const afterData = event.data?.after.exists ?
      event.data.after.data() :
      null;

    // Check if upForGoingOutTonight status changed
    const statusChanged =
      (beforeData?.upForGoingOutTonight === false &&
        afterData?.upForGoingOutTonight === true) ||
      (beforeData?.upForGoingOutTonight === true &&
        afterData?.upForGoingOutTonight === false);

    if (!statusChanged) {
      // No relevant status change; exit
      console.log('No relevant status change detected.');
      return null;
    }

    // Fetch all user statuses for the crew and date
    const userStatusesRef = db
      .collection('crews')
      .doc(crewId)
      .collection('statuses')
      .doc(date)
      .collection('userStatuses');

    const userStatusesSnapshot = await userStatusesRef.get();

    const totalUpCount = userStatusesSnapshot.docs.filter(
      (doc) => doc.data().upForGoingOutTonight === true
    ).length;

    console.log(`Total members up for going out tonight: ${totalUpCount}`);

    // Check if the count has reached or exceeded 3
    // Also, ensure this is the first time crossing the threshold to prevent redundant notifications
    if (totalUpCount >= 3) {
      // Identify members who are NOT up for going out
      const membersNotUp: string[] = [];
      userStatusesSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (!data.upForGoingOutTonight) {
          membersNotUp.push(doc.id); // Assuming doc.id is userId
        }
      });

      if (membersNotUp.length === 0) {
        console.log('All crew members are up; no one to notify.');
        return null;
      }

      console.log(`Members not up for going out tonight: ${membersNotUp}`);

      // Fetch the crew's name
      const crewRef = db.collection('crews').doc(crewId);
      const crewDoc = await crewRef.get();

      if (!crewDoc.exists) {
        console.log(`Crew ${crewId} does not exist.`);
        return null;
      }

      const crewData = crewDoc.data();
      if (!crewData || !crewData.name) {
        console.log(`Crew ${crewId} is missing required data.`);
        return null;
      }

      const crewName = crewData.name;

      // Prepare notification message
      const dateDescription = getDateDescription(date);
      const messageBody = `${totalUpCount} of your crew members are up for going out ${dateDescription}!`;

      // Fetch push tokens for members not up
      const batchSize = 10; // Firestore 'in' queries support up to 10 elements per query
      const expoPushTokens: string[] = [];

      for (let i = 0; i < membersNotUp.length; i += batchSize) {
        const batch = membersNotUp.slice(i, i + batchSize);

        const usersSnapshot = await db
          .collection('users')
          .where(admin.firestore.FieldPath.documentId(), 'in', batch)
          .get();

        usersSnapshot.docs.forEach((doc) => {
          const userData = doc.data();
          const token = userData?.expoPushToken;
          const tokensArray = userData?.expoPushTokens;

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
        console.log('No valid Expo push tokens found for members not up.');
        return null;
      }

      console.log(`Expo Push Tokens to notify: ${expoPushTokens}`);

      // Prepare the notification messages
      const messages: ExpoPushMessage[] = expoPushTokens.map((pushToken) => ({
        to: pushToken,
        sound: 'default',
        title: crewName,
        body: messageBody,
        data: {
          crewId,
          date,
          screen: 'Crew',
        },
      }));

      // Send the notifications
      await sendExpoNotifications(messages);

      console.log(
        `Sent notifications to members not up in crew ${crewName} for date ${dateDescription}.`
      );

      return null;
    }
    return null;
  }
);
