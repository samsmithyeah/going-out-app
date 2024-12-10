// app/(main)/(tabs)/user/_layout.tsx

import { Stack } from 'expo-router';

export default function UserProfileLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerTitle: 'Profile' }} />
      <Stack.Screen
        name="edit"
        options={{ headerTitle: 'Edit Profile', headerBackTitleVisible: false }}
      />
    </Stack>
  );
}
