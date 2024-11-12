// components/SkeletonUserItem.tsx

import React from 'react';
import { View, StyleSheet } from 'react-native';
import SpinLoader from './SpinLoader';

const LoadingOverlay: React.FC = () => {
  return (
    <View style={styles.loadingOverlay}>
      <SpinLoader />
    </View>
  );
};

export default LoadingOverlay;

const styles = StyleSheet.create({
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});
