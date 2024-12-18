// navigation/ContactsStackNavigator.tsx

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavParamList } from './AppNavigator';
import ContactsScreen from '@/screens/ContactsScreen';
import OtherUserProfileScreen from '@/screens/OtherUserProfileScreen';
//import DMChatScreen from '@/screens/DMChatScreen';

const Stack = createStackNavigator<NavParamList>();

const ContactsStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator initialRouteName="Contacts">
      <Stack.Screen
        name="Contacts"
        component={ContactsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="OtherUserProfile"
        component={OtherUserProfileScreen}
        options={{
          headerBackTitleVisible: false,
        }}
      />
      {/* <Stack.Screen
        name="DMChat"
        component={DMChatScreen}
        options={{
          headerBackTitleVisible: false,
        }}
      /> */}
    </Stack.Navigator>
  );
};

export default ContactsStackNavigator;
