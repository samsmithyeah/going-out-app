// functions/src/crews/deleteCrew.ts

import { https } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { deleteCollection } from '../utils/deleteCollection'; // Ensure the path is correct

// Cloud Function to delete a crew and its related data
export const deleteCrew = https.onCall(async ({ data, auth }) => {
  // 1. Authentication check
  if (!auth) {
    throw new https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const { crewId } = data;

  if (!crewId) {
    throw new https.HttpsError(
      'invalid-argument',
      'The function must be called with a crewId.'
    );
  }

  const crewRef = admin.firestore().collection('crews').doc(crewId);
  const crewDoc = await crewRef.get();

  if (!crewDoc.exists) {
    throw new https.HttpsError(
      'not-found',
      'Crew not found.'
    );
  }

  const crewData = crewDoc.data();

  if (!crewData) {
    throw new https.HttpsError(
      'invalid-argument',
      'Crew data is missing.'
    );
  }

  const ownerId = crewData.ownerId;

  if (ownerId !== auth.uid) {
    throw new https.HttpsError(
      'permission-denied',
      'Only the crew owner can delete the crew.'
    );
  }

  try {
    // 2. Delete subcollections (statuses, invitations)
    await deleteCollection(crewRef, 'statuses');
    await deleteCollection(crewRef, 'invitations'); // Assuming invitations are subcollections

    // 3. Delete the crew document
    await crewRef.delete();

    // 4. Optionally, notify members about the crew deletion via push notifications
    // (Requires additional implementation)

    return { success: true };
  } catch (error) {
    console.error('Error deleting crew:', error);
    throw new https.HttpsError(
      'unknown',
      'An error occurred while deleting the crew.'
    );
  }
});
