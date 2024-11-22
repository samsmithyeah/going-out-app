// navigation/ChatsStackNavigator.tsx

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ChatsListScreen from '@/screens/ChatsListScreen';
import CrewDateChatScreen from '@/screens/CrewDateChatScreen';
import DMChatScreen from '@/screens/DMChatScreen';

export type ChatsStackParamList = {
  ChatsList: undefined;
  CrewDateChat: { crewId?: string; date?: string; id?: string };
  DMChat: { otherUserId: string };
};

const Stack = createStackNavigator<ChatsStackParamList>();

const UserProfileStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ChatsList"
        component={ChatsListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CrewDateChat"
        component={CrewDateChatScreen}
        options={{
          headerBackTitleVisible: false,
          headerStatusBarHeight: 0,
        }}
      />
      <Stack.Screen
        name="DMChat"
        component={DMChatScreen}
        options={{
          headerBackTitleVisible: false,
          headerStatusBarHeight: 0,
        }}
      />
    </Stack.Navigator>
  );
};

export default UserProfileStackNavigator;
