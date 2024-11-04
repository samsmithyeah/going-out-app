// SignUpScreen.tsx

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import {
  auth,
  updateProfile,
  FirebaseUser,
  createUserWithEmailAndPassword,
} from '../firebase';
import { addUserToFirestore } from '../helpers/AddUserToFirestore';
import { useUser } from '../context/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type NavParamList = {
  SignUp: undefined;
  Login: undefined;
  Home: undefined;
};

type SignUpScreenNavigationProp = StackNavigationProp<NavParamList, 'SignUp'>;
type SignUpScreenRouteProp = RouteProp<NavParamList, 'SignUp'>;

type Props = {
  navigation: SignUpScreenNavigationProp;
  route: SignUpScreenRouteProp;
};

const SignUpScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const { setUser } = useUser();

  const handleSignUp = async () => {
    // Reset form error
    setFormError('');

    // Basic validation
    if (!email.trim() || !password || !firstName.trim() || !lastName.trim()) {
      setFormError('Please fill in all fields.');
      return;
    }

    // Email format validation
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email.trim())) {
      setFormError('Please enter a valid email address.');
      return;
    }

    // Password strength validation (minimum 6 characters)
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      const thisUser: FirebaseUser = userCredential.user;

      await updateProfile(thisUser, {
        displayName: `${firstName.trim()} ${lastName.trim()}`,
      });

      console.log('User signed up:', thisUser);

      const updatedUser = {
        uid: thisUser.uid,
        email: thisUser.email || '',
        displayName: thisUser.displayName || '',
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        photoURL: thisUser.photoURL || '',
      };

      await addUserToFirestore(updatedUser);

      setUser(updatedUser);

      navigation.navigate('Home');
    } catch (err: any) {
      console.error('Sign Up Error:', err);
      setFormError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <LinearGradient colors={['#4e488c', '#2575fc']} style={styles.gradient}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/images/icon.png')} // Replace with your logo
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Create Account</Text>
          </View>

          <View style={styles.formContainer}>
            {formError ? <Text style={styles.error}>{formError}</Text> : null}

            <View style={styles.inputContainer}>
              <Ionicons
                name="mail-outline"
                size={24}
                color="#333"
                style={styles.icon}
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#666"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (formError) setFormError('');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons
                name="person-outline"
                size={24}
                color="#333"
                style={styles.icon}
              />
              <TextInput
                style={styles.input}
                placeholder="First Name"
                placeholderTextColor="#666"
                value={firstName}
                onChangeText={(text) => {
                  setFirstName(text);
                  if (formError) setFormError('');
                }}
                autoCapitalize="words"
                autoComplete="name-given"
                textContentType="givenName"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons
                name="person-outline"
                size={24}
                color="#333"
                style={styles.icon}
              />
              <TextInput
                style={styles.input}
                placeholder="Last Name"
                placeholderTextColor="#666"
                value={lastName}
                onChangeText={(text) => {
                  setLastName(text);
                  if (formError) setFormError('');
                }}
                autoCapitalize="words"
                autoComplete="name-family"
                textContentType="familyName"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={24}
                color="#333"
                style={styles.icon}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#666"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (formError) setFormError('');
                }}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                textContentType="password"
              />
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign Up</Text>
              )}
            </TouchableOpacity>

            <View style={styles.separatorContainer}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>OR</Text>
              <View style={styles.separatorLine} />
            </View>

            {/* If you have a GoogleAuth component for sign-up as well */}
            {/* <GoogleAuth /> */}

            <TouchableOpacity
              style={styles.loginContainer}
              onPress={() => navigation.navigate('Login')} // Assuming you have a Login screen
            >
              <Text style={styles.loginText}>Already have an account? </Text>
              <Text style={styles.loginLink}>Login</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '700',
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 15,
    padding: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#333',
  },
  button: {
    backgroundColor: '#ff6b6b',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000', // For iOS shadow
    shadowOffset: { width: 0, height: 2 }, // For iOS shadow
    shadowOpacity: 0.3, // For iOS shadow
    shadowRadius: 4, // For iOS shadow
    elevation: 5, // For Android shadow
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  separatorText: {
    marginHorizontal: 10,
    color: '#333',
    fontSize: 16,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginText: {
    color: '#333',
    fontSize: 16,
  },
  loginLink: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#ff6b6b',
    marginBottom: 12,
    textAlign: 'center',
  },
});

export default SignUpScreen;
