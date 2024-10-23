// context/UserContext.tsx
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User, auth, onAuthStateChanged, doc, onSnapshot, db, setDoc, getDoc } from '../firebase';

type UserContextType = {
  user: User | null;
  setUser: (user: User | null) => void;
  status: boolean;
  setStatus: (status: boolean) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

type UserProviderProps = {
  children: ReactNode;
};

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<boolean>(false);

  // useEffect(() => {
  //   const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser: User | null) => {
  //     console.log('UserContext: onAuthStateChanged:', currentUser);
  //     if (currentUser) {
  //       setUser(currentUser);
  //       const userDocRef = doc(db, 'users', currentUser.uid);

  //       try {
  //         const userDoc = await getDoc(userDocRef);

  //         if (!userDoc.exists()) {
  //           // User does not exist in Firestore, create a new document
  //           await setDoc(userDocRef, {
  //             uid: currentUser.uid,
  //             email: currentUser.email,
  //             displayName: currentUser.displayName,
  //             firstName: currentUser.displayName?.split(' ')[0],
  //             lastName: currentUser.displayName?.split(' ')[1],
  //           });
  //         }

  //         // Listen for real-time status changes
  //         const unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
  //           if (docSnap.exists()) {
  //             const data = docSnap.data();
  //             setStatus(data?.status || false);
  //           }
  //         });

  //         return () => unsubscribeSnapshot();
  //       } catch (error) {
  //         console.error('Error checking/creating user document:', error);
  //       }
  //     } else {
  //       setUser(null);
  //       setStatus(false);
  //     }
  //   });

  //   return () => unsubscribeAuth();
  // }, []);

  useEffect(() => {
    console.log('Current user:', user?.displayName);
  }, [user]);

  return (
    <UserContext.Provider value={{ user, setUser, status, setStatus }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};