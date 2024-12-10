// app/(main)/(tabs)/contacts/_layout.tsx

import { Stack } from 'expo-router';

export default function ContactsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="[userId]"
        options={{ headerBackTitleVisible: false }}
      />
    </Stack>
  );
}
