// components/GoogleLoginButton.tsx

import React, { useEffect, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import { auth, db } from '@/firebase';
import {
  addUserToFirestore,
  registerForPushNotificationsAsync,
} from '@/utils/AddUserToFirestore';
import CustomButton from '@/components/CustomButton';
import Toast from 'react-native-toast-message';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavParamList } from '@/navigation/AppNavigator';
import { User } from '@/types/User';
import { doc, getDoc } from 'firebase/firestore';
import { useUser } from '@/context/UserContext';

const GoogleLoginButton: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const { setUser } = useUser();

  // Configure Google Auth request
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId:
      '814136772684-024bdeavoudavtj3qosdj9b7o8unsium.apps.googleusercontent.com',
  });

  const navigation = useNavigation<NativeStackNavigationProp<NavParamList>>();

  useEffect(() => {
    const handleSignIn = async () => {
      if (response?.type === 'success') {
        setLoading(true);
        const { id_token } = response.params;
        const credential = GoogleAuthProvider.credential(id_token);
        try {
          const userCredential = await signInWithCredential(auth, credential);
          const firebaseUser = userCredential.user;

          // Fetch user data from Firestore
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data() as User;

            await registerForPushNotificationsAsync(userData);

            if (!userData.phoneNumber) {
              // Redirect to PhoneVerificationScreen
              navigation.replace('PhoneVerification', {
                uid: firebaseUser.uid,
              });
            } else {
              // User already has a verified phone number
              setUser(userData);
            }
          } else {
            // User document does not exist, create one
            const firestoreUser: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              firstName: firebaseUser.displayName?.split(' ')[0] || '',
              lastName: firebaseUser.displayName?.split(' ')[1] || '',
              photoURL: firebaseUser.photoURL || '',
              badgeCount: 0,
              // phoneNumber is optional and not set here
            };
            await addUserToFirestore(firestoreUser);
            await registerForPushNotificationsAsync(firestoreUser);
            Toast.show({
              type: 'success',
              text1: 'Success',
              text2: 'Account created and logged in successfully!',
            });
            // Redirect to PhoneVerificationScreen
            navigation.replace('PhoneVerification', { uid: firebaseUser.uid });
          }
        } catch (error: unknown) {
          console.error('Login Error:', error);
          if (error instanceof Error) {
            Toast.show({
              type: 'error',
              text1: 'Error',
              text2: `Could not sign in with Google: ${error.message}`,
            });
          }
        } finally {
          setLoading(false);
        }
      }
    };

    handleSignIn();
  }, [response, navigation, setUser]);

  const handleGoogleSignIn = async () => {
    promptAsync();
  };

  return (
    <CustomButton
      title="Login with Google"
      onPress={handleGoogleSignIn}
      variant="danger" // Assuming 'danger' is styled for Google
      accessibilityLabel="Login with Google"
      accessibilityHint="Authenticate using your Google account"
      icon={{
        name: 'logo-google',
        size: 24,
        color: '#fff',
      }}
      loading={loading} // Show loading indicator when signing in
      disabled={!request || loading}
    />
  );
};

export default GoogleLoginButton;
