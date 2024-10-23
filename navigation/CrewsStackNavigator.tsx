// navigation/CrewsStackNavigator.tsx

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import CrewsListScreen from '../screens/CrewsListScreen';
import CrewScreen from '../screens/CrewScreen';
import { RootStackParamList } from './AppNavigator'; // Adjust the import path as needed
import { TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const Stack = createStackNavigator<RootStackParamList>();

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
        options={({ title: 'Crew Details', headerBackTitleVisible: false })}
      />
    </Stack.Navigator>
  );
};

export default CrewsStackNavigator;
