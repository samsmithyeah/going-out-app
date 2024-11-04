// navigation/DrawerNavigator.tsx

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import InvitationsScreen from '../screens/InvitationsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import CrewsStackNavigator from './CrewsStackNavigator';

export type TabsParamList = {
  Home: undefined;
  CrewsStack: { screen: string; params: { crewId: string } };
  Invitations: undefined;
  UserProfile: undefined;
};

const Tab = createBottomTabNavigator<TabsParamList>();

const TabNavigator: React.FC = () => {
  return (
    <Tab.Navigator initialRouteName="Home">
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="CrewsStack"
        component={CrewsStackNavigator}
        options={{
          title: 'Crews',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
          unmountOnBlur: true,
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Invitations"
        component={InvitationsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="mail-outline" size={size} color={color} />
          ),
          headerStatusBarHeight: 0,
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{
          title: 'Your profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
          headerStatusBarHeight: 0,
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
};

export default TabNavigator;
