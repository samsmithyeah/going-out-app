// components/LoadingOverlay.tsx

import React from 'react';
import { View } from 'react-native';
import SpinLoader from './SpinLoader';

const LoadingOverlay: React.FC = () => {
  return (
    <View>
      <SpinLoader />
    </View>
  );
};

export default LoadingOverlay;
