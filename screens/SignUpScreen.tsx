import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { auth, createUserWithEmailAndPassword, updateProfile, User, doc, db, getDoc, setDoc, addUserToFirestore } from '../firebase';
import { useUser } from '@/context/UserContext';

type RootStackParamList = {
  SignUp: undefined;
  Home: undefined;
};

type SignUpScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SignUp'>;
type SignUpScreenRouteProp = RouteProp<RootStackParamList, 'SignUp'>;

type Props = {
  navigation: SignUpScreenNavigationProp;
  route: SignUpScreenRouteProp;
};

const SignUpScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const { setUser } = useUser();

  const handleSignUp = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const thisUser: User = userCredential.user;
      await updateProfile(thisUser, {
        displayName: `${firstName} ${lastName}`,
      });
      console.log('User signed up:', thisUser);
      setUser(thisUser);
      await addUserToFirestore(thisUser);
      navigation.navigate('Home');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Email"
        onChangeText={(text) => setEmail(text)}
        value={email}
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />
      <TextInput
        placeholder="First Name"
        onChangeText={(text) => setFirstName(text)}
        value={firstName}
        style={styles.input}
      />
      <TextInput
        placeholder="Last Name"
        onChangeText={(text) => setLastName(text)}
        value={lastName}
        style={styles.input}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        onChangeText={(text) => setPassword(text)}
        value={password}
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Sign Up" onPress={handleSignUp} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16 },
  input: { marginBottom: 12, borderWidth: 1, padding: 8, borderRadius: 4 },
  error: { color: 'red', marginBottom: 12 },
});

export default SignUpScreen;