// app/(main)/(tabs)/crews/_layout.tsx

import { Stack } from 'expo-router';

export default function CrewsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="[crewId]/index"
        options={{ title: 'Crew', headerBackTitleVisible: false }}
      />
      <Stack.Screen
        name="[crewId]/settings"
        options={{ headerBackTitleVisible: false }}
      />
      <Stack.Screen
        name="[crewId]/add-members"
        options={{ title: 'Add members', headerBackTitleVisible: false }}
      />
      <Stack.Screen
        name="[crewId]/date-chat/[id]"
        options={{ headerBackTitleVisible: false }}
      />
    </Stack>
  );
}
