// components/SkeletonUserItem.tsx

import React from 'react';
import { View, StyleSheet } from 'react-native';

const SkeletonUserItem: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.avatar} />
      <View style={styles.text} />
    </View>
  );
};

export default SkeletonUserItem;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    marginRight: 16,
  },
  text: {
    width: '60%',
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
});
