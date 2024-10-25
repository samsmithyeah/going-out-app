// functions/src/utils/deleteCollection.ts

import { firestore } from 'firebase-admin';

/**
 * Recursively deletes a collection and its subcollections.
 * @param {FirebaseFirestore.DocumentReference} docRef - Reference to the document containing the subcollection.
 * @param {string} collectionPath - Path to the subcollection.
 * @param {number} batchSize - Number of documents to delete per batch.
 */
export const deleteCollection = async (
  docRef: firestore.DocumentReference,
  collectionPath: string,
  batchSize = 100
) => {
  const collectionRef = docRef.collection(collectionPath);
  const query = collectionRef.limit(batchSize);

  return new Promise<void>((resolve, reject) => {
    deleteQueryBatch(query, batchSize, resolve, reject);
  });
};

const deleteQueryBatch = (
  query: firestore.Query,
  batchSize: number,
  resolve: () => void,
  reject: (error: Error) => void
) => {
  query
    .get()
    .then((snapshot) => {
      if (snapshot.size === 0) {
        return resolve();
      }

      const batch = firestore().batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      return batch.commit().then(() => {
        process.nextTick(() => {
          deleteQueryBatch(query, batchSize, resolve, reject);
        });
      });
    })
    .catch(reject);
};
