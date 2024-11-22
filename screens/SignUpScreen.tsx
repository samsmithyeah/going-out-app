// SignUpScreen.tsx

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { auth } from '@/firebase';
import { addUserToFirestore } from '@/utils/AddUserToFirestore';
import { useUser } from '@/context/UserContext';
import CustomButton from '@/components/CustomButton';
import CustomTextInput from '@/components/CustomTextInput';
import zxcvbn from 'zxcvbn';
import {
  createUserWithEmailAndPassword,
  User as FirebaseUser,
  updateProfile,
} from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import Colors from '@/styles/colors';

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

const SignUpScreen: React.FC<Props> = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const { setUser } = useUser();
  const [passwordStrength, setPasswordStrength] = useState<number>(0);
  const navigation = useNavigation<StackNavigationProp<NavParamList>>();

  const evaluatePasswordStrength = (pass: string) => {
    const evaluation = zxcvbn(pass);
    setPasswordStrength(evaluation.score);
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
    setFormError('');

    if (!email.trim() || !password || !firstName.trim() || !lastName.trim()) {
      setFormError('Please fill in all fields.');
      return;
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email.trim())) {
      setFormError('Please enter a valid email address.');
      return;
    }

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
    } catch (err: any) {
      console.error('Sign Up Error:', err);
      setFormError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
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
                evaluatePasswordStrength(text);
              }}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              importantForAutofill="yes"
            />

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
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.loginText}>Already have an account? </Text>
              <Text style={styles.loginLink}>Login</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.flock,
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 15,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 200,
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
