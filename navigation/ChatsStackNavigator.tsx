// navigation/ChatsStackNavigator.tsx

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import CrewDateChatsListScreen from '../screens/CrewDateChatsListScreen';
import CrewDateChatScreen from '../screens/CrewDateChatScreen';

export type ChatsStackParamList = {
  CrewDateChatsList: undefined;
  CrewDateChat: { crewId: string; date: string };
};

const Stack = createStackNavigator<ChatsStackParamList>();

const UserProfileStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="CrewDateChatsList"
        component={CrewDateChatsListScreen}
        options={{ headerTitle: 'Profile' }}
      />
      <Stack.Screen
        name="CrewDateChat"
        component={CrewDateChatScreen}
        options={{
          headerBackTitleVisible: false,
          headerStatusBarHeight: 0,
        }}
      />
    </Stack.Navigator>
  );
};

export default UserProfileStackNavigator;
