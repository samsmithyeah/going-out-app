// screens/HomeScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import * as WebBrowser from 'expo-web-browser';
import { db, doc, setDoc } from '../firebase';
import { useUser } from '../context/UserContext';

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

WebBrowser.maybeCompleteAuthSession();

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { user } = useUser();

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Hi {user?.displayName}!</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  greeting: { fontSize: 20, marginBottom: 20 },
});

export default HomeScreen;
