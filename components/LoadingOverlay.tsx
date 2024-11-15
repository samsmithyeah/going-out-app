// components/LoadingOverlay.tsx

import React from 'react';
import { View, StyleSheet } from 'react-native';
import SpinLoader from './SpinLoader';

const LoadingOverlay: React.FC = () => {
  return (
    <View style={styles.overlayContainer}>
      <SpinLoader />
    </View>
  );
};

export default LoadingOverlay;

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1,
  },
});
