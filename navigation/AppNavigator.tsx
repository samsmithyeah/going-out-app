// navigation/AppNavigator.tsx

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useUser } from '../context/UserContext';
import SignUpScreen from '../screens/SignUpScreen';
import TabNavigator from './TabNavigator';
import LoginStackNavigator from './LoginStackNavigator';

export type NavParamList = {
  Home: undefined;
  SignUp: undefined;
  Login: undefined;
  LoginStack: undefined;
  MainTabs: undefined;
  CrewsStack:
    | {
        screen: string;
        params: { crewId: string; date?: string };
        initial: boolean;
      }
    | undefined;
  CrewsList: undefined;
  Crew: { crewId: string; date?: string };
  CrewSettings: { crewId: string };
  UserProfileStack:
    | {
        screen: string;
        params: { userId: string };
        initial: boolean;
      }
    | undefined;
  UserProfile: { userId: string };
  EditUserProfile: undefined;
  Invitations: undefined;
  ForgotPassword: undefined;
  AddMembers: { crewId: string };
  OtherUserProfile: { userId: string };
  MatchesList: { date: string };
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
