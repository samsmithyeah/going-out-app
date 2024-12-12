// navigation/UserProfileStackNavigator.tsx

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import DashboardScreen from '@/screens/DashboardScreen';
import MatchesListScreen from '@/screens/MatchesListScreen';

export type DashboardStackParamList = {
  Dashboard: undefined;
  MatchesList: { date: string };
  Crew: { crewId: string };
};

const Stack = createStackNavigator<DashboardStackParamList>();

const DashboardStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MatchesList"
        component={MatchesListScreen}
        options={{
          headerBackTitleVisible: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default DashboardStackNavigator;
