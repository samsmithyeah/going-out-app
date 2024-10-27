// functions/src/crews/deleteCrew.ts

import { https } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { deleteCollection } from '../utils/deleteCollection';

interface DeleteCrewData {
  crewId: string;
}

// Corrected Cloud Function
export const deleteCrew = https.onCall(async (request: https.CallableRequest<DeleteCrewData>) => {
  const { data, auth } = request;

  console.log('deleteCrew called with data:', data);
  console.log('deleteCrew called with auth:', auth);

  // 1. Authentication check
  if (!auth || !auth.uid) {
    console.error('Unauthenticated or missing auth.uid in request.');
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
    // 2. Delete statuses subcollection
    await deleteCollection(crewRef, 'statuses');

    // 3. Delete invitations

    const invitationsRef = admin.firestore().collection('invitations').where('crewId', '==', crewId);
    const invitationsSnapshot = await invitationsRef.get();

    const batch = admin.firestore().batch();
    invitationsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    // 4. Delete the crew document
    await crewRef.delete();

    // 5. Optionally, notify members about the crew deletion via push notifications
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
