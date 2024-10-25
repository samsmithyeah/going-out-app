// firebase.ts
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  User,
  updateProfile
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  onSnapshot,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Your Firebase configuration (from the Firebase console)
const firebaseConfig = {
  apiKey: "AIzaSyBGzk3lvP9pboBVpOERejYweH6Xk1dHB8k",
  authDomain: "goingoutapp-c90b1.firebaseapp.com",
  projectId: "goingoutapp-c90b1",
  storageBucket: "goingoutapp-c90b1.appspot.com",
  messagingSenderId: "814136772684",
  appId: "1:814136772684:web:287e5a3b413533b81b8ce9",
  measurementId: "G-XZSBDHERB0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

const addUserToFirestore = async (user: User) => {
  const userDocRef = doc(db, 'users', user.uid);
  try {
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) {
      console.log(`Adding user to Firestore: ${user.displayName} (${user.email})`);
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        firstName: user.displayName?.split(' ')[0],
        lastName: user.displayName?.split(' ')[1],
      });
    } else {
      console.log(`User already exists in Firestore: ${user.displayName} (${user.email})`);
    }
  } catch (err: any) {
    console.error('Error checking/creating user document:', err);
  }
}

const deleteCrew = (crewId: string) => {
  const deleteCrewCallable = httpsCallable(functions, 'deleteCrew');
  return deleteCrewCallable({ crewId });
};

export { auth, db, functions, deleteCrew, updateProfile, signInWithCredential, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, doc, getDoc, setDoc, collection, addDoc, onSnapshot, User, addUserToFirestore };
