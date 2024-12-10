// app/(main)/(tabs)/_layout.tsx

import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="dashboard" options={{ title: 'Your week' }} />
      <Tabs.Screen name="crews" options={{ title: 'Crews' }} />
      <Tabs.Screen name="contacts" options={{ title: 'Contacts' }} />
      <Tabs.Screen name="invitations" options={{ title: 'Invitations' }} />
      <Tabs.Screen name="chats" options={{ title: 'Chats' }} />
      <Tabs.Screen name="user" options={{ title: 'Your profile' }} />
    </Tabs>
  );
}
