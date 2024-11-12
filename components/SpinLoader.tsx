// components/SkeletonUserItem.tsx

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

const SpinLoader: React.FC = () => {
  return (
    <View style={styles.loaderContainer}>
      <ActivityIndicator size="large" color="#1E90FF" />
      <Text style={styles.loaderText}>Loading...</Text>
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
