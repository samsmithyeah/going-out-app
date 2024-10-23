// index.tsx
import React from 'react';
import { registerRootComponent } from 'expo';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from '../navigation/AppNavigator';
import { UserProvider } from '../context/UserContext';

const App: React.FC = () => {
  return (
    <UserProvider>
        <AppNavigator />
    </UserProvider>
  );
};

export default App;

registerRootComponent(App);