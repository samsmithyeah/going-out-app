// SignUpScreen.tsx

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
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
import CustomButton from '../components/CustomButton';
import CustomTextInput from '../components/CustomTextInput'; // Import the CustomTextInput
import { LinearGradient } from 'expo-linear-gradient';
import zxcvbn from 'zxcvbn'; // Password strength library

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

  const [passwordStrength, setPasswordStrength] = useState<number>(0);

  const evaluatePasswordStrength = (pass: string) => {
    const evaluation = zxcvbn(pass);
    setPasswordStrength(evaluation.score); // Score ranges from 0 to 4
  };

  const getPasswordStrengthLabel = () => {
    switch (passwordStrength) {
      case 0:
      case 1:
        return { label: 'Weak', color: '#ff4d4d' };
      case 2:
        return { label: 'Fair', color: '#ffae42' };
      case 3:
        return { label: 'Good', color: '#2ecc71' };
      case 4:
        return { label: 'Strong', color: '#27ae60' };
      default:
        return { label: '', color: '#ccc' };
    }
  };

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
        displayName: `${firstName.trim()} ${lastName.trim()}`,
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
            <Text style={styles.title}>Create account</Text>
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
              iconName="person-outline"
              placeholder="First name"
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

            <CustomTextInput
              iconName="person-outline"
              placeholder="Last name"
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

            <CustomTextInput
              iconName="lock-closed-outline"
              placeholder="Password"
              placeholderTextColor="#666"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (formError) setFormError('');
                evaluatePasswordStrength(text); // Evaluate strength on change
              }}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password" // Important for AutoFill
              importantForAutofill="yes" // Ensures AutoFill is active
            />

            {/* Password Strength Indicator */}
            {password.length > 0 && (
              <View style={styles.passwordStrengthContainer}>
                <View style={styles.passwordStrengthBarContainer}>
                  <View
                    style={[
                      styles.passwordStrengthBar,
                      {
                        backgroundColor: getPasswordStrengthLabel().color,
                        width: `${(passwordStrength + 1) * 20}%`,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.passwordStrengthText,
                    { color: getPasswordStrengthLabel().color },
                  ]}
                >
                  {getPasswordStrengthLabel().label}
                </Text>
              </View>
            )}

            <CustomButton
              title="Sign up"
              onPress={handleSignUp}
              variant="danger"
              accessibilityLabel="Sign up"
              accessibilityHint="Press to create a new account"
              loading={loading}
            />

            <View style={styles.separatorContainer}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>OR</Text>
              <View style={styles.separatorLine} />
            </View>

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
  passwordStrengthContainer: {
    marginBottom: 15,
  },
  passwordStrengthBarContainer: {
    height: 5,
    width: '100%',
    backgroundColor: '#e0e0e0',
    borderRadius: 2.5,
    marginBottom: 5,
  },
  passwordStrengthBar: {
    height: '100%',
    borderRadius: 2.5,
  },
  passwordStrengthText: {
    fontSize: 12,
    fontWeight: '500',
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
