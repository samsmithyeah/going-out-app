// context/UserContext.tsx
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User as FirebaseUser, auth } from '../firebase';
import { Alert } from 'react-native';

type UserContextType = {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export interface User extends FirebaseUser {
  firstName?: string;
  lastName?: string;
  profilePictureUrl?: string;
}

type UserProviderProps = {
  children: ReactNode;
};

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    console.log('Current user:', user?.displayName);
  }, [user]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      Alert.alert('Logout', 'Are you sure you want to logout?', [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          onPress: async () => {
            await auth.signOut();
            setUser(null); // Update user state
          },
        },
      ]);
    } catch (error) {
      console.error('Logout Error:', error);
      throw error; // Re-throw the error to handle it in the calling component
    }
  };

  return (
    <UserContext.Provider value={{ user, setUser, logout }}>
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