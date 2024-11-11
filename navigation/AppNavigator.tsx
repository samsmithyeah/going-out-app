// navigation/AppNavigator.tsx

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useUser } from '../context/UserContext';
import SignUpScreen from '../screens/SignUpScreen';
import TabNavigator from './TabNavigator';
import LoginStackNavigator from './LoginStackNavigator';

export type NavParamList = {
  SignUp: undefined;
  Login: undefined;
  LoginStack: undefined;
  MainTabs: undefined;
  CrewsStack: { screen: string; params: { crewId: string } } | undefined;
  CrewsList: undefined;
  Crew: { crewId: string };
  CrewSettings: { crewId: string };
  UserProfileStack: undefined;
  UserProfile: { userId: string };
  EditUserProfile: undefined;
  Invitations: undefined;
  ForgotPassword: undefined;
  AddMembers: { crewId: string };
};

const Stack = createStackNavigator<NavParamList>();

const AppNavigator: React.FC = () => {
  const { user } = useUser();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="LoginStack" component={LoginStackNavigator} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
        </>
      ) : (
        <Stack.Screen name="MainTabs" component={TabNavigator} />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
