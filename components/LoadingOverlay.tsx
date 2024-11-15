// components/LoadingOverlay.tsx

import React from 'react';
import { View, StyleSheet } from 'react-native';
import SpinLoader from './SpinLoader';

interface LoadingOverlayProps {
  text?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ text }) => {
  return (
    <View style={styles.overlayContainer}>
      <SpinLoader {...(text && { text })} />
    </View>
  );
};

export default LoadingOverlay;

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    zIndex: 1,
  },
});
