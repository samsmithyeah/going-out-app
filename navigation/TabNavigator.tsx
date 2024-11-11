// navigation/TabNavigator.tsx

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import InvitationsScreen from '../screens/InvitationsScreen';
import UserProfileStackNavigator from './UserProfileStackNavigator';
import CrewsStackNavigator from './CrewsStackNavigator';
import { useInvitations } from '../context/InvitationsContext';

export type TabsParamList = {
  Home: undefined;
  CrewsStack: { screen: string; params: { crewId: string } };
  Invitations: undefined;
  UserProfileStack: undefined;
};

const Tab = createBottomTabNavigator<TabsParamList>();

const TabNavigator: React.FC = () => {
  const { pendingCount } = useInvitations();

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{ headerShown: false, headerStatusBarHeight: 0 }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
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
        }}
      />
      <Tab.Screen
        name="Invitations"
        component={InvitationsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="mail-outline" size={size} color={color} />
          ),
          tabBarBadge:
            pendingCount > 0
              ? pendingCount > 99
                ? '99+'
                : pendingCount
              : undefined,
        }}
      />
      <Tab.Screen
        name="UserProfileStack"
        component={UserProfileStackNavigator}
        options={{
          title: 'Your profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default TabNavigator;
