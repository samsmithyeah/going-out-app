// InvitationsScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from '../context/UserContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type InvitationsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Invitations'
>;

interface Invitation {
  id: string;
  crewId: string;
  fromUserId: string;
  toUserId: string;
  status: string;
  timestamp: any;
}

const InvitationsScreen: React.FC<InvitationsScreenProps> = ({
  navigation,
}) => {
  const { user } = useUser();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    // Reference to the invitations collection
    const invitationsRef = collection(db, 'invitations');

    // Query to get pending invitations for the user
    const q = query(
      invitationsRef,
      where('toUserId', '==', user.uid),
      where('status', '==', 'pending'),
    );

    // Real-time listener
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const invitationsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Invitation, 'id'>),
        }));
        setInvitations(invitationsList);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching invitations:', error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const acceptInvitation = async (invitation: Invitation) => {
    try {
      // Reference to the crew document
      const crewRef = doc(db, 'crews', invitation.crewId);
      const crewSnap = await getDoc(crewRef);

      if (!crewSnap.exists()) {
        Alert.alert('Error', 'Crew does not exist');
        return;
      }

      // Update the crew's memberIds
      await updateDoc(crewRef, {
        memberIds: arrayUnion(user!.uid),
      });

      // Update the invitation status
      const invitationRef = doc(db, 'invitations', invitation.id);
      await updateDoc(invitationRef, {
        status: 'accepted',
      });

      Alert.alert('Success', 'You have joined the crew');

      // Optionally navigate to the CrewScreen
      navigation.navigate('Crew', { crewId: invitation.crewId });
    } catch (error) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Error', 'Could not accept invitation');
    }
  };

  const declineInvitation = async (invitation: Invitation) => {
    try {
      // Update the invitation status
      const invitationRef = doc(db, 'invitations', invitation.id);
      await updateDoc(invitationRef, {
        status: 'declined',
      });

      Alert.alert('Invitation Declined');
    } catch (error) {
      console.error('Error declining invitation:', error);
      Alert.alert('Error', 'Could not decline invitation');
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Invitations</Text>
      <FlatList
        data={invitations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.invitationItem}>
            <Text style={styles.invitationText}>Invitation to join a crew</Text>
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={[styles.button, styles.acceptButton]}
                onPress={() => acceptInvitation(item)}
              >
                <Text style={styles.buttonText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.declineButton]}
                onPress={() => declineInvitation(item)}
              >
                <Text style={styles.buttonText}>Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text>No invitations found</Text>}
      />
    </View>
  );
};

export default InvitationsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  invitationItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  invitationText: {
    fontSize: 18,
    marginBottom: 10,
  },
  buttonsContainer: {
    flexDirection: 'row',
  },
  button: {
    padding: 10,
    borderRadius: 5,
    width: '48%',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#28a745',
    marginRight: '4%',
  },
  declineButton: {
    backgroundColor: '#dc3545',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
