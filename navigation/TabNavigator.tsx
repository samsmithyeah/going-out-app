// navigation/TabNavigator.tsx

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import InvitationsScreen from '../screens/InvitationsScreen';
import UserProfileStackNavigator from './UserProfileStackNavigator';
import DashboardStackNavigator from './DashboardStackNavigator';
import CrewsStackNavigator from './CrewsStackNavigator';
import { useInvitations } from '../context/InvitationsContext';
import ChatsStackNavigator from './ChatsStackNavigator';

export type TabsParamList = {
  DashboardStack: undefined;
  CrewsStack: { screen: string; params: { crewId: string } };
  Invitations: undefined;
  ChatsStack: undefined;
  UserProfileStack: undefined;
};

const Tab = createBottomTabNavigator<TabsParamList>();

const TabNavigator: React.FC = () => {
  const { pendingCount } = useInvitations();

  return (
    <Tab.Navigator
      initialRouteName="DashboardStack"
      screenOptions={{ headerShown: false, headerStatusBarHeight: 0 }}
    >
      <Tab.Screen
        name="DashboardStack"
        component={DashboardStackNavigator}
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
      {/* <Tab.Screen
        name="ChatsStack"
        component={ChatsStackNavigator}
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      /> */}
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
