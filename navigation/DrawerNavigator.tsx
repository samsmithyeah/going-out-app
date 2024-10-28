// navigation/DrawerNavigator.tsx

import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import InvitationsScreen from '../screens/InvitationsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import CrewsStackNavigator from './CrewsStackNavigator';
import CustomDrawerContent from './CustomDrawerContent'; 


export type DrawerParamList = {
  Home: undefined;
  CrewsStack: undefined;
  FriendsList: undefined;
  Invitations: undefined;
  UserProfile: undefined;
};


const Drawer = createDrawerNavigator<DrawerParamList>();

const DrawerNavigator: React.FC = () => {
  return (
    <Drawer.Navigator
      initialRouteName="Home"
      drawerContent={(props) => <CustomDrawerContent {...props} />} // Use the updated CustomDrawerContent
    >
      <Drawer.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="CrewsStack"
        component={CrewsStackNavigator}
        options={{
          title: 'Crews',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Invitations"
        component={InvitationsScreen}
        options={{
          title: 'Invitations',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="mail-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{
          title: 'Profile',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Add other drawer items here if needed */}
    </Drawer.Navigator>
  );
};

export default DrawerNavigator;
