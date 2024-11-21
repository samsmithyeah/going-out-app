// components/GoogleLoginButton.tsx

import React, { useEffect, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import { auth } from '../firebase';
import { addUserToFirestore } from '../utils/AddUserToFirestore';
import CustomButton from './CustomButton'; // Import CustomButton
import Toast from 'react-native-toast-message'; // Import Toast
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

export default function GoogleLoginButton() {
  // State to manage loading indicator
  const [loading, setLoading] = useState<boolean>(false);

  // Configure Google Auth request
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId:
      '814136772684-024bdeavoudavtj3qosdj9b7o8unsium.apps.googleusercontent.com',
  });

  useEffect(() => {
    const handleSignIn = async () => {
      if (response?.type === 'success') {
        setLoading(true); // Start loading
        const { id_token } = response.params;
        const credential = GoogleAuthProvider.credential(id_token);
        try {
          const userCredential = await signInWithCredential(auth, credential);
          const firestoreUser = {
            uid: userCredential.user.uid,
            email: userCredential.user.email || '',
            displayName: userCredential.user.displayName?.split(' ')[0] || '', // Use first name as display name
            photoURL: userCredential.user.photoURL || undefined,
            firstName: userCredential.user.displayName?.split(' ')[0] || '',
            lastName: userCredential.user.displayName?.split(' ')[1] || '',
          };
          await addUserToFirestore(firestoreUser);
        } catch (error: any) {
          console.error('Login Error:', error);
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: `Could not sign in with Google: ${error.message}`,
          });
        } finally {
          setLoading(false); // End loading
        }
      }
    };

    handleSignIn();
  }, [response]);

  const handleGoogleSignIn = async () => {
    promptAsync();
  };

  return (
    <CustomButton
      title="Login with Google"
      onPress={handleGoogleSignIn}
      variant="danger" // Assuming 'secondary' is styled for Google
      accessibilityLabel="Login with Google"
      accessibilityHint="Authenticate using your Google account"
      icon={{
        name: 'logo-google',
        size: 24,
        color: '#fff',
        library: 'Ionicons',
      }}
      loading={loading} // Show loading indicator when signing in
      disabled={!request || loading}
    />
  );
}
