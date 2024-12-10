// app/(auth)/login/index.tsx

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
} from 'react-native';
import { auth, db } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import * as WebBrowser from 'expo-web-browser';
import FastImage from 'react-native-fast-image';
import GoogleLoginButton from '@/components/GoogleLoginButton';
import { useUser } from '@/context/UserContext';
import CustomButton from '@/components/CustomButton';
import CustomTextInput from '@/components/CustomTextInput';
import Colors from '@/styles/colors';
import { doc, getDoc } from 'firebase/firestore';
import { User } from '@/types/User';
import { FirebaseError } from 'firebase/app';
import { useRouter } from 'expo-router';

WebBrowser.maybeCompleteAuthSession();

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');
  const { setUser } = useUser();
  const router = useRouter();

  const handleEmailLogin = async () => {
    setFormError('');

    if (!email.trim() || !password) {
      setFormError('Please enter both email and password.');
      return;
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email.trim())) {
      setFormError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      const thisUser = userCredential.user;

      // Fetch user data from Firestore
      const userDocRef = doc(db, 'users', thisUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data() as User;

        if (!userData.phoneNumber) {
          // Redirect to PhoneVerificationScreen
          router.replace(`./phone-verification/${thisUser.uid}`);
        } else {
          // Proceed to main app
          setUser(userData);
        }
      } else {
        setFormError('User data not found.');
      }
    } catch (error: unknown) {
      console.error('Login Error:', error);
      if (error instanceof FirebaseError) {
        switch (error.code) {
          case 'auth/user-not-found':
            setFormError('No account found for this email.');
            break;
          case 'auth/wrong-password':
            setFormError('Incorrect password.');
            break;
          case 'auth/invalid-email':
            setFormError('Invalid email address.');
            break;
          default:
            setFormError('Failed to log in. Please try again.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <View style={styles.logoContainer}>
          <FastImage
            source={require('@/assets/images/flock-transparent.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.formContainer}>
          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          <CustomTextInput
            iconName="mail-outline"
            placeholder="Email address"
            placeholderTextColor="#666"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (formError) setFormError('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="username"
            importantForAutofill="yes"
            hasBorder
          />

          <CustomTextInput
            iconName="lock-closed-outline"
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
            importantForAutofill="yes"
            hasBorder
          />

          <TouchableOpacity
            style={styles.forgotPasswordContainer}
            onPress={() => router.push('./forgot-password')}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <CustomButton
            title="Login"
            onPress={handleEmailLogin}
            variant="primary"
            accessibilityLabel="Login"
            accessibilityHint="Press to log into your account"
            loading={loading}
          />

          <View style={styles.separatorContainer}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>OR</Text>
            <View style={styles.separatorLine} />
          </View>

          <GoogleLoginButton />

          <TouchableOpacity
            style={styles.signupContainer}
            onPress={() => router.push('./sign-up')}
          >
            <Text style={styles.signupText}>Don't have an account? </Text>
            <Text style={styles.signupLink}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.flock,
  },
  logoContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 10,
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 15,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 50,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 15,
    paddingRight: 10,
  },
  forgotPasswordText: {
    color: '#ff6b6b',
    fontSize: 14,
    fontWeight: '500',
    marginTop: -7,
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
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  signupText: {
    color: '#333',
    fontSize: 16,
  },
  signupLink: {
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

export default LoginScreen;
