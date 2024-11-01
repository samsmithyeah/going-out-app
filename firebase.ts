// firebase.ts
import { initializeApp } from 'firebase/app';
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  updateProfile,
  getReactNativePersistence,
  initializeAuth,
  createUserWithEmailAndPassword,
  User as FirebaseUser,
  getAuth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  onSnapshot,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { User } from './types/User';

// Your Firebase configuration (from the Firebase console)
const firebaseConfig = {
  apiKey: 'AIzaSyBGzk3lvP9pboBVpOERejYweH6Xk1dHB8k',
  authDomain: 'goingoutapp-c90b1.firebaseapp.com',
  projectId: 'goingoutapp-c90b1',
  storageBucket: 'goingoutapp-c90b1.appspot.com',
  messagingSenderId: '814136772684',
  appId: '1:814136772684:web:287e5a3b413533b81b8ce9',
  measurementId: 'G-XZSBDHERB0',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
let auth: ReturnType<typeof initializeAuth> | ReturnType<typeof getAuth>;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e: any) {
  if (e.code === 'app/duplicate-app' || e.code === 'auth/already-initialized') {
    auth = getAuth(app);
  } else {
    throw e;
  }
}
const db = getFirestore(app);
const functions = getFunctions(app);
const storage = getStorage(app);

const addUserToFirestore = async (user: User) => {
  const userDocRef = doc(db, 'users', user.uid);
  try {
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) {
      console.log(
        `Adding user to Firestore: ${user.displayName} (${user.email}). Photo: ${user.photoURL}`,
      );
      const userData: User = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        firstName: user.displayName.split(' ')[0],
        lastName: user.displayName.split(' ')[1],
        photoURL: user.photoURL,
      };

      await setDoc(userDocRef, userData);
    } else {
      console.log(
        `User already exists in Firestore: ${user.displayName} (${user.email})`,
      );
    }
  } catch (err: any) {
    console.error('Error checking/creating user document:', err);
  }
};

// const isAndroid = Platform.OS === 'android';
// const isIOS = Platform.OS === 'ios';

// let emulatorHost = 'localhost'; // Default for iOS Simulator
// let emulatorPort = 5001; // Default Functions emulator port

// if (isAndroid) {
//   emulatorHost = '10.0.2.2'; // Android Emulator
// } else if (isIOS) {
//   emulatorHost = 'localhost'; // iOS Simulator
// } else {
//   // For physical devices, replace with your computer's IP
//   emulatorHost = '192.168.4.160';
// }

// Connect to Functions emulator if in development
// if (__DEV__) {
//   console.log('Connecting to Functions emulator:', emulatorHost, emulatorPort);
//   connectFunctionsEmulator(functions, emulatorHost, emulatorPort);
// }

const deleteCrew = (crewId: string) => {
  if (!auth.currentUser) {
    throw new Error('User is not authenticated');
  }
  const deleteCrewCallable = httpsCallable(functions, 'deleteCrew');
  return deleteCrewCallable({ crewId });
};

export {
  auth,
  db,
  functions,
  storage,
  deleteCrew,
  updateProfile,
  signInWithCredential,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  onSnapshot,
  addUserToFirestore,
  FirebaseUser,
};
