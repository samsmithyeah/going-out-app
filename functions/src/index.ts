/* eslint-disable max-len */
// functions/src/index.ts

import {onDocumentWritten, onDocumentCreated, onDocumentUpdated} from "firebase-functions/v2/firestore";
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

// Notify crew members when a user's status changes
export const notifyCrewOnStatusChange = onDocumentWritten(
  "crews/{crewId}/statuses/{userId}",
  async (event) => {
    const {crewId, userId} = event.params;

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

    // Fetch the crew document to get memberIds and crew.Name
    const crewRef = admin.firestore().collection("crews").doc(crewId);
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
      console.log("No other members in the crew to notify.");
      return null;
    }

    // Fetch the user's displayName
    const userRef = admin.firestore().collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log(`User ${userId} does not exist.`);
      return null;
    }

    const userData = userDoc.data() as { displayName: string };
    const userName = userData.displayName;

    // Determine notification message based on status change
    let messageBody = "";
    if (statusChangedToUp) {
      messageBody = `${userName} from ${crewName} is up for going out tonight!`;
    } else if (statusChangedToDown) {
      messageBody = `${userName} from ${crewName} is no longer up for ` +
                    "going out tonight.";
    }

    // Collect Expo push tokens of members to notify
    const expoPushTokens: string[] = [];

    // Fetch all user documents in a single query if possible
    // Firestore 'in' queries support up to 10 elements
    const batchSize = 10;
    for (let i = 0; i < memberIds.length; i += batchSize) {
      const batch = memberIds.slice(i, i + batchSize);
      const usersSnapshot = await admin
        .firestore()
        .collection("users")
        .where(admin.firestore.FieldPath.documentId(), "in", batch)
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
      console.log("No valid Expo push tokens found for members.");
      return null;
    }

    // Prepare the notification message
    const messages: ExpoPushMessage[] = expoPushTokens.map((pushToken) => ({
      to: pushToken,
      sound: "default",
      title: "Crew Update",
      body: messageBody,
      data: {crewId, userId, statusChangedToUp, statusChangedToDown},
    }));

    // Send the notifications
    await sendExpoNotifications(messages);

    return null;
  }
);

// Notify user when invited to a crew
export const notifyUserOnCrewInvitation = onDocumentCreated(
  "invitations/{invitationId}",
  async (event) => {
    // Ensure event data exists
    if (!event.data) {
      console.log("Event data is undefined.");
      return null;
    }

    const invitationData = event.data.data();

    // Destructure necessary fields from invitation data
    const {crewId, toUserId, fromUserId, status} = invitationData;

    // Only send notifications for pending invitations
    if (status !== "pending") {
      return null;
    }

    // Fetch the invited user's data
    const invitedUserRef = admin.firestore().collection("users").doc(toUserId);
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
    const crewRef = admin.firestore().collection("crews").doc(crewId);
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

    const inviterUserRef = admin.firestore().collection("users").doc(fromUserId);
    const inviterUserDoc = await inviterUserRef.get();

    if (!inviterUserDoc.exists) {
      console.log(`Inviter user ${fromUserId} does not exist.`);
      return null;
    }

    const inviterUserData = inviterUserDoc.data() as { displayName: string };
    const inviterUserName = inviterUserData.displayName || "Someone";

    const messageBody = `${inviterUserName} has invited you to join their crew "${crewName}"!`;

    const messages: ExpoPushMessage[] = expoPushTokens.map((pushToken) => ({
      to: pushToken,
      sound: "default",
      title: "Crew Invitation",
      body: messageBody,
      data: {crewId, fromUserId, toUserId},
    }));

    // Send the notifications
    await sendExpoNotifications(messages);

    console.log(`Sent crew invitation notification to user ${toUserId}.`);

    return null;
  }
);

// Notify crew members when a new user joins the crew
export const notifyCrewMembersOnNewJoin = onDocumentUpdated(
  "crews/{crewId}",
  async (event) => {
    if (!event.data) {
      console.log("Event data is undefined.");
      return null;
    }
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();

    const crewId = event.params.crewId;

    const beforeMemberIds: string[] = beforeData?.memberIds || [];
    const afterMemberIds: string[] = afterData?.memberIds || [];

    // Determine newly added members
    const newMemberIds = afterMemberIds.filter((id) => !beforeMemberIds.includes(id));

    if (newMemberIds.length === 0) {
      // No new members added
      return null;
    }

    // Fetch the crew's name
    const crewName = afterData.name;

    // Fetch new members' display names
    const newMembersPromises = newMemberIds.map(async (userId) => {
      const userRef = admin.firestore().collection("users").doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        console.log(`User ${userId} does not exist.`);
        return {userId, displayName: "A new member"};
      }

      const userData = userDoc.data() as { displayName: string };
      return {userId, displayName: userData.displayName};
    });

    const newMembers = await Promise.all(newMembersPromises);

    // Fetch existing members' Expo push tokens (excluding new members)
    const existingMemberIds = beforeMemberIds; // Before the update

    if (existingMemberIds.length === 0) {
      console.log("No existing members to notify.");
      return null;
    }

    const expoPushTokens: string[] = [];

    // Firestore 'in' queries support up to 10 elements per query
    const batchSize = 10;
    for (let i = 0; i < existingMemberIds.length; i += batchSize) {
      const batch = existingMemberIds.slice(i, i + batchSize);
      const usersSnapshot = await admin
        .firestore()
        .collection("users")
        .where(admin.firestore.FieldPath.documentId(), "in", batch)
        .get();

      usersSnapshot.forEach((doc) => {
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
      console.log("No valid Expo push tokens found for existing members.");
      return null;
    }

    // Since 'to' expects a single token per message, we'll need to send individual messages
    const individualMessages: ExpoPushMessage[] = [];

    expoPushTokens.forEach((pushToken) => {
      newMembers.forEach(({userId, displayName}) => {
        individualMessages.push({
          to: pushToken,
          sound: "default",
          title: "New Crew Member",
          body: `${displayName} has joined the "${crewName}" crew!`,
          data: {crewId, newMemberId: userId},
        });
      });
    });

    // Send the notifications
    await sendExpoNotifications(individualMessages);

    console.log(`Sent notifications to existing members about new members: ${newMemberIds.join(", ")}`);

    return null;
  }
);
