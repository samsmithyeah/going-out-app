// navigation/DrawerNavigator.tsx

import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import HomeScreen from '../screens/HomeScreen';
import FriendsListScreen from '../screens/FriendsListScreen';
import InvitationsScreen from '../screens/InvitationsScreen';
import CustomDrawerContent from './CustomDrawerContent';
import CrewsStackNavigator from './CrewsStackNavigator'; // Import the CrewsStackNavigator

export type DrawerParamList = {
  Home: undefined;
  CrewsStack: undefined;
  Invitations: undefined;
};

const Drawer = createDrawerNavigator<DrawerParamList>();

const DrawerNavigator: React.FC = () => {
  return (
    <Drawer.Navigator
      initialRouteName="Home"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
    >
      <Drawer.Screen name="Home" component={HomeScreen} />
      <Drawer.Screen
        name="CrewsStack"
        component={CrewsStackNavigator}
        options={{ title: 'Crews' }}
      />
      <Drawer.Screen name="Invitations" component={InvitationsScreen} />
    </Drawer.Navigator>
  );
};

export default DrawerNavigator;
