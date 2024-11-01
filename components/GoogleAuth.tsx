// components/GoogleAuth.tsx

import React, { useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import {
  auth,
  signInWithCredential,
  GoogleAuthProvider,
  addUserToFirestore,
} from '../firebase';
import { Ionicons } from '@expo/vector-icons';

export default function GoogleAuth() {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId:
      '814136772684-024bdeavoudavtj3qosdj9b7o8unsium.apps.googleusercontent.com',
  });

  useEffect(() => {
    const handleSignIn = async () => {
      if (response?.type === 'success') {
        const { id_token } = response.params;
        const credential = GoogleAuthProvider.credential(id_token);
        try {
          const userCredential = await signInWithCredential(auth, credential);
          const firestoreUser = {
            uid: userCredential.user.uid,
            email: userCredential.user.email || '',
            displayName: userCredential.user.displayName || '',
            photoURL: userCredential.user.photoURL || undefined,
            firstName: userCredential.user.displayName?.split(' ')[0] || '',
            lastName: userCredential.user.displayName?.split(' ')[1] || '',
          };
          await addUserToFirestore(firestoreUser);
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
    <TouchableOpacity
      style={styles.googleButton}
      onPress={handleGoogleSignIn}
      disabled={!request}
    >
      <Ionicons name="logo-google" size={24} color="#fff" />
      <Text style={styles.googleButtonText}>Login with Google</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  googleButton: {
    flexDirection: 'row',
    backgroundColor: '#db4437',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3, // For Android shadow
    shadowColor: '#000', // For iOS shadow
    shadowOffset: { width: 0, height: 2 }, // For iOS shadow
    shadowOpacity: 0.25, // For iOS shadow
    shadowRadius: 3.84, // For iOS shadow
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
});
