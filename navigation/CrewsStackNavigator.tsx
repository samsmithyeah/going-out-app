// navigation/CrewsStackNavigator.tsx

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import CrewsListScreen from '@/screens/CrewsListScreen';
import CrewScreen from '@/screens/CrewScreen';
import CrewSettingsScreen from '@/screens/CrewSettingsScreen';
import { NavParamList } from '@/navigation/AppNavigator';
import AddMembersScreen from '@/screens/AddMembersScreen';
import OtherUserProfileScreen from '@/screens/OtherUserProfileScreen';

const Stack = createStackNavigator<NavParamList>();

const CrewsStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator initialRouteName="CrewsList">
      <Stack.Screen
        name="CrewsList"
        component={CrewsListScreen}
        options={{ title: 'Your Crews', headerShown: false }}
      />
      <Stack.Screen
        name="Crew"
        component={CrewScreen}
        options={{
          headerBackTitleVisible: false,
          title: 'Crew',
        }}
      />
      <Stack.Screen
        name="CrewSettings"
        component={CrewSettingsScreen}
        options={{ headerBackTitleVisible: false, title: 'Crew settings' }}
      />
      <Stack.Screen
        name="AddMembers"
        component={AddMembersScreen}
        options={{
          headerBackTitleVisible: false,
          title: 'Add members',
        }}
      />
      <Stack.Screen
        name="OtherUserProfile"
        component={OtherUserProfileScreen}
        options={{ headerBackTitleVisible: false }}
      />
    </Stack.Navigator>
  );
};

export default CrewsStackNavigator;
