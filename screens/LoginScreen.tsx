// LoginScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { auth } from '../firebase';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { signInWithEmailAndPassword } from 'firebase/auth';
import * as WebBrowser from 'expo-web-browser';
import GoogleLoginButton from '../components/GoogleLoginButton';
import { NavParamList } from '../navigation/AppNavigator';
import { useUser } from '../context/UserContext';
import CustomButton from '../components/CustomButton';
import CustomTextInput from '../components/CustomTextInput';
import { LinearGradient } from 'expo-linear-gradient';

type LoginScreenProps = NativeStackScreenProps<NavParamList, 'Login'>;

WebBrowser.maybeCompleteAuthSession();

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');
  const { user } = useUser();

  useEffect(() => {
    if (user) {
      console.log('User logged in, redirecting to MainTabs');
      navigation.replace('MainTabs');
    }
  }, [user]);

  const handleEmailLogin = async () => {
    // Reset form error
    setFormError('');

    // Basic validation
    if (!email.trim() || !password) {
      setFormError('Please enter both email and password.');
      return;
    }

    // Email format validation
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email.trim())) {
      setFormError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // iOS should automatically offer to save the password upon successful login
    } catch (error: any) {
      console.error('Login Error:', error);
      // Map Firebase error codes to user-friendly messages
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <LinearGradient colors={['#4e488c', '#2575fc']} style={styles.gradient}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/images/icon.png')} // Replace with your logo
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Welcome!</Text>
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
            textContentType="username" // Important for AutoFill
            importantForAutofill="yes" // Ensures AutoFill is active
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
            textContentType="password" // Important for AutoFill
            importantForAutofill="yes" // Ensures AutoFill is active
          />

          {/* "Forgot Password?" Link */}
          <TouchableOpacity
            style={styles.forgotPasswordContainer}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <CustomButton
            title="Login"
            onPress={handleEmailLogin}
            variant="primary" // Assuming 'primary' is defined in CustomButton
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
            onPress={() => navigation.navigate('SignUp')}
          >
            <Text style={styles.signupText}>Don't have an account? </Text>
            <Text style={styles.signupLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  logoContainer: {
    marginTop: 70,
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
    marginHorizontal: 20,
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
