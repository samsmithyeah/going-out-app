// functions/src/index.ts

import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import {Expo, ExpoPushMessage} from "expo-server-sdk";

// Initialize Firebase Admin SDK
admin.initializeApp();

// Initialize Expo SDK
const expo = new Expo();

// Helper function to send notifications via Expo
const sendExpoNotifications = async (messages: ExpoPushMessage[]) => {
  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error("Error sending notification chunk:", error);
    }
  }

  return tickets;
};

// Cloud Function triggered on status update
export const notifyCrewOnStatusUp = onDocumentWritten(
  "crews/{crewId}/statuses/{userId}",
  async (event) => {
    const {crewId, userId} = event.params;

    // Access 'before' and 'after' snapshots correctly
    const beforeData = event.data?.before.exists ?
      event.data.before.data() :
      null;
    const afterData = event.data?.after.exists ?
      event.data.after.data() :
      null;

    // Check if the status was changed to 'upForGoingOutTonight'
    if (
      !beforeData?.upForGoingOutTonight &&
      afterData?.upForGoingOutTonight
    ) {
      // Fetch the crew document to get memberIds
      const crewRef = admin.firestore().collection("crews").doc(crewId);
      const crewDoc = await crewRef.get();

      if (!crewDoc.exists) {
        console.log(`Crew ${crewId} does not exist.`);
        return null;
      }

      const crewData = crewDoc.data() as { memberIds: string[] };
      const memberIds = crewData.memberIds.filter((id) => id !== userId);

      if (memberIds.length === 0) {
        console.log("No other members in the crew to notify.");
        return null;
      }

      // Fetch statuses of other members to find who are also up
      const statusesRef = crewRef.collection("statuses");
      const upStatusesSnapshot = await statusesRef
        .where("upForGoingOutTonight", "==", true)
        .get();

      if (upStatusesSnapshot.empty) {
        console.log("No other members are up for going out tonight.");
        return null;
      }

      // Collect Expo push tokens of members who are up
      const expoPushTokens: string[] = [];

      for (const doc of upStatusesSnapshot.docs) {
        const memberId = doc.id;
        // Fetch the user's Expo push token from the users collection
        const userRef = admin.firestore().collection("users").doc(memberId);
        const userDoc = await userRef.get();

        if (userDoc.exists) {
          const userData = userDoc.data();
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
        }
      }

      if (expoPushTokens.length === 0) {
        console.log("No valid Expo push tokens found for members.");
        return null;
      }

      // Prepare the notification message
      const messages: ExpoPushMessage[] = expoPushTokens.map(
        (pushToken) => ({
          to: pushToken,
          sound: "default",
          title: "Crew Update",
          body: `${userId} from ${crewId} is up for going out tonight!`,
          data: {crewId, userId},
        })
      );

      // Send the notifications
      await sendExpoNotifications(messages);

      return null;
    }

    return null;
  }
);
