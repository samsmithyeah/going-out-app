// navigation/LoginStackNavigator.tsx

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '@/screens/LoginScreen';
import ForgotPasswordScreen from '@/screens/ForgotPasswordScreen';
import SignUpScreen from '@/screens/SignUpScreen';
import PhoneVerificationScreen from '@/screens/PhoneVerificationScreen';

export type LoginStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  SignUp: undefined;
  PhoneVerification: { uid: string };
};

const Stack = createStackNavigator<LoginStackParamList>();

const LoginStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{
          headerTitle: 'Reset password',
          headerBackTitleVisible: false,
          headerStatusBarHeight: 0,
        }}
      />
      <Stack.Screen
        name="SignUp"
        component={SignUpScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PhoneVerification"
        component={PhoneVerificationScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default LoginStackNavigator;
