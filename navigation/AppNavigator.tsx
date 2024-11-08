// navigation/AppNavigator.tsx

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useUser } from '../context/UserContext';
import SignUpScreen from '../screens/SignUpScreen';
import LoginScreen from '../screens/LoginScreen';
import TabNavigator from './TabNavigator';

export type NavParamList = {
  SignUp: undefined;
  Login: undefined;
  MainTabs: undefined;
  CrewsStack: { screen: string; params: { crewId: string } } | undefined;
  CrewsList: undefined;
  Crew: { crewId: string };
  CrewSettings: { crewId: string };
  UserProfileStack: undefined;
  UserProfile: { userId: string };
  EditUserProfile: undefined;
  Invitations: undefined;
};

const Stack = createStackNavigator<NavParamList>();

const AppNavigator: React.FC = () => {
  const { user } = useUser();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
        </>
      ) : (
        <Stack.Screen name="MainTabs" component={TabNavigator} />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
