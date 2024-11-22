import { StyleSheet } from 'react-native';
import Colors from '@/styles/colors';

const globalStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: Colors.background,
    justifyContent: 'flex-start',
    paddingBottom: 0,
  },
});

export default globalStyles;
