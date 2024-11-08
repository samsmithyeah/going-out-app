// screens/ForgotPasswordScreen.tsx

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableWithoutFeedback,
  Keyboard,
  Text,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavParamList } from '../navigation/AppNavigator';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import CustomButton from '../components/CustomButton';
import CustomTextInput from '../components/CustomTextInput'; // Import the CustomTextInput
import { LinearGradient } from 'expo-linear-gradient';

type ForgotPasswordProps = NativeStackScreenProps<
  NavParamList,
  'ForgotPassword'
>;

const ForgotPasswordScreen: React.FC<ForgotPasswordProps> = ({
  navigation,
}) => {
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handlePasswordReset = async () => {
    // Reset error
    setError('');

    // Basic validation
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    // Email format validation
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert(
        'Password Reset Email Sent',
        'A password reset link has been sent to your email address.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } catch (error: any) {
      console.error('Password Reset Error:', error);
      setError(error.message || 'Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <LinearGradient colors={['#4e488c', '#2575fc']} style={styles.gradient}>
        <View style={styles.container}>
          <Text style={styles.instructions}>
            Enter your email address below to receive a password reset link:
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <CustomTextInput
            iconName="mail-outline" // Optional: Specify the icon
            placeholder="Email address"
            placeholderTextColor="#666"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (error) setError('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="username" // Important for AutoFill
            importantForAutofill="yes" // Ensures AutoFill is active
          />

          <CustomButton
            title="Send reset link"
            onPress={handlePasswordReset}
            variant="primary" // Assuming 'primary' is styled appropriately in CustomButton
            loading={loading} // Show loading indicator when sending email
            accessibilityLabel="Send Password Reset Link"
            accessibilityHint="Press to send a password reset link to your email"
          />
        </View>
      </LinearGradient>
    </TouchableWithoutFeedback>
  );
};

export default ForgotPasswordScreen;

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  instructions: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  error: {
    color: '#ff6b6b',
    marginBottom: 15,
    textAlign: 'center',
    fontSize: 14,
  },
});
