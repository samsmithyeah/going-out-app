// src/screens/ContactsScreen.tsx

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useContacts } from '@/context/ContactsContext';
import MemberList from '@/components/MemberList';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavParamList } from '@/navigation/AppNavigator';
import { User } from '@/types/User';
import ScreenTitle from '@/components/ScreenTitle';
import globalStyles from '@/styles/globalStyles';

type ContactsScreenProp = NativeStackNavigationProp<NavParamList, 'Contacts'>;

const ContactsScreen: React.FC = () => {
  const { matchedUsers, loading, error, refreshContacts } = useContacts();
  const navigation = useNavigation<ContactsScreenProp>();

  const handleContactPress = (contact: User) => {
    // Navigate to the member's profile or perform another action
    navigation.navigate('OtherUserProfile', { userId: contact.uid });
  };

  return (
    <View style={globalStyles.container}>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e90ff" />
          <Text>Loading contacts...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={refreshContacts}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && (
        <>
          <ScreenTitle title="Contacts" />
          <MemberList
            members={matchedUsers}
            currentUserId={''}
            onMemberPress={handleContactPress}
            isLoading={loading}
            emptyMessage="No registered contacts found."
          />
        </>
      )}
    </View>
  );
};

export default ContactsScreen;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },
  retryButton: {
    padding: 10,
    backgroundColor: '#1e90ff',
    borderRadius: 5,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
});
