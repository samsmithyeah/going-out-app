// app/(auth)/_layout.tsx

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false }}
      initialRouteName="login/index"
    >
      <Stack.Screen name="login/index" />
      <Stack.Screen name="sign-up/index" />
      <Stack.Screen name="forgot-password/index" />
      <Stack.Screen name="phone-verification/[uid]" />
    </Stack>
  );
}
