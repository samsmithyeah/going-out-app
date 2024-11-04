import React from 'react';
import { Text, StyleSheet } from 'react-native';

interface ScreenTitleProps {
  title: string;
}

const ScreenTitle: React.FC<ScreenTitleProps> = ({ title }) => {
  return <Text style={styles.title}>{title}</Text>;
};

export default ScreenTitle;

const styles = StyleSheet.create({
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 10,
    color: '#333',
  },
});
