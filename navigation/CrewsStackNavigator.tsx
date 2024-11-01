// navigation/CrewsStackNavigator.tsx

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import CrewsListScreen from '../screens/CrewsListScreen';
import CrewScreen from '../screens/CrewScreen';
import CrewSettingsScreen from '../screens/CrewSettingsScreen';
import { TabNavParamList } from './AppNavigator';

const Stack = createStackNavigator<TabNavParamList>();

const CrewsStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator initialRouteName="CrewsList">
      <Stack.Screen
        name="CrewsList"
        component={CrewsListScreen}
        options={{ title: 'Your Crews', headerStatusBarHeight: 0 }}
      />
      <Stack.Screen
        name="Crew"
        component={CrewScreen}
        options={{ headerBackTitleVisible: false, headerStatusBarHeight: 0 }}
      />
      <Stack.Screen
        name="CrewSettings"
        component={CrewSettingsScreen}
        options={{ headerBackTitleVisible: false, headerStatusBarHeight: 0 }}
      />
    </Stack.Navigator>
  );
};

export default CrewsStackNavigator;
