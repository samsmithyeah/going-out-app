// app/index.tsx

import React from 'react';
import { Stack } from 'expo-router';
import { useUser } from '@/context/UserContext';

export default function App() {
  const { user } = useUser();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {!user ? <Stack.Screen name="(auth)" /> : <Stack.Screen name="(main)" />}
    </Stack>
  );
}
