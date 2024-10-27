import React, {  useEffect } from 'react';
import { Button, Text, Alert } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import { auth, signInWithCredential, GoogleAuthProvider, addUserToFirestore } from '../firebase';
import { useUser } from '../context/UserContext';

export default function GoogleAuth() {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: '814136772684-024bdeavoudavtj3qosdj9b7o8unsium.apps.googleusercontent.com',
  });
  const { user } = useUser();

  useEffect(() => {
    const handleSignIn = async () => {
      if (response?.type === 'success') {
        const { id_token } = response.params;
        const credential = GoogleAuthProvider.credential(id_token);
        try {
          const userCredential = await signInWithCredential(auth, credential);
          await addUserToFirestore(userCredential.user);
        } catch (error: any) {
          Alert.alert('Login Error', error.message);
        }
      }
    };

    handleSignIn();
  }, [response]);

  const handleGoogleSignIn = async () => {
    promptAsync();
  };

  return (
    <>
      {user ? (
        <Text>Welcome, {user.displayName}</Text>
      ) : null}
      <Button
        disabled={!request}
        title="Login with Google"
        onPress={handleGoogleSignIn}
      />
    </>
  );
}