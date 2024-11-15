// components/SpinLoader.tsx

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

interface SpinLoaderProps {
  text?: string;
}

const SpinLoader: React.FC<SpinLoaderProps> = ({ text }) => {
  return (
    <View style={styles.loaderContainer}>
      <ActivityIndicator size="large" color="#1E90FF" />
      <Text style={styles.loaderText}>{text ? text : 'Loading...'}</Text>
    </View>
  );
};

export default SpinLoader;

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 10,
    fontSize: 16,
    color: '#1E90FF',
  },
});
