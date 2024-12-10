// app/(main)/(tabs)/chats/_layout.tsx

import { Stack } from 'expo-router';

export default function ChatsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="dm/[otherUserId]"
        options={{ headerBackTitleVisible: false }}
      />
      <Stack.Screen
        name="crew-date-chat/[id]"
        options={{ headerBackTitleVisible: false }}
      />
    </Stack>
  );
}
