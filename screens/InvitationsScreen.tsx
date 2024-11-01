// screens/InvitationsScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
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
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { TabsParamList } from '../navigation/TabNavigator';
import { Ionicons } from '@expo/vector-icons';
import { User } from '../context/UserContext';
import { Crew } from '../screens/CrewScreen';
import InvitationCard from '../components/InvitationCard';

type InvitationsScreenProps = BottomTabScreenProps<
  TabsParamList,
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

export interface InvitationWithDetails extends Invitation {
  crew?: Crew;
  inviter?: User;
}

const InvitationsScreen: React.FC<InvitationsScreenProps> = ({
  navigation,
}) => {
  const { user } = useUser();
  const [invitations, setInvitations] = useState<InvitationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [crewsCache, setCrewsCache] = useState<{ [key: string]: Crew }>({});
  const [usersCache, setUsersCache] = useState<{ [key: string]: User }>({});

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
      async (snapshot) => {
        const invitationsList: Invitation[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Invitation, 'id'>),
        }));

        // Extract unique crewIds and fromUserIds
        const uniqueCrewIds = Array.from(
          new Set(invitationsList.map((inv) => inv.crewId)),
        );
        const uniqueFromUserIds = Array.from(
          new Set(invitationsList.map((inv) => inv.fromUserId)),
        );

        // Fetch crew details
        const newCrewsCache = { ...crewsCache };
        await Promise.all(
          uniqueCrewIds.map(async (crewId) => {
            if (!newCrewsCache[crewId]) {
              const crewSnap = await getDoc(doc(db, 'crews', crewId));
              if (crewSnap.exists()) {
                const crewData = crewSnap.data();
                newCrewsCache[crewId] = {
                  id: crewSnap.id,
                  name: crewData.name,
                  ownerId: crewData.ownerId,
                  memberIds: crewData.memberIds,
                  iconUrl: crewData.iconUrl,
                };
              } else {
                newCrewsCache[crewId] = {
                  id: crewId,
                  name: 'Unknown Crew',
                  ownerId: '',
                  memberIds: [],
                  iconUrl: '',
                };
              }
            }
          }),
        );

        setCrewsCache(newCrewsCache);

        // Fetch inviter details
        const newUsersCache = { ...usersCache };
        await Promise.all(
          uniqueFromUserIds.map(async (userId) => {
            if (!newUsersCache[userId]) {
              const userSnap = await getDoc(doc(db, 'users', userId));
              if (userSnap.exists()) {
                const userData = userSnap.data();
                newUsersCache[userId] = {
                  uid: userSnap.id,
                  displayName: userData.displayName,
                  firstName: userData.firstName,
                  lastName: userData.lastName,
                  email: userData.email,
                  photoURL: userData.photoURL,
                };
              } else {
                newUsersCache[userId] = {
                  uid: userId,
                  displayName: 'Unknown User',
                  email: '',
                };
              }
            }
          }),
        );

        setUsersCache(newUsersCache);

        // Combine invitation with crew and inviter details
        const invitationsWithDetails: InvitationWithDetails[] =
          invitationsList.map((inv) => ({
            ...inv,
            crew: newCrewsCache[inv.crewId],
            inviter: newUsersCache[inv.fromUserId],
          }));

        setInvitations(invitationsWithDetails);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching invitations:', error);
        setLoading(false);
        Alert.alert('Error', 'Could not fetch invitations');
      },
    );

    return () => unsubscribe();
  }, [user?.uid, crewsCache, usersCache]);

  const acceptInvitation = async (invitation: InvitationWithDetails) => {
    if (!user) {
      Alert.alert('Error', 'User not logged in');
      return;
    }

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
        memberIds: arrayUnion(user.uid),
      });

      // Update the invitation status
      const invitationRef = doc(db, 'invitations', invitation.id);
      await updateDoc(invitationRef, {
        status: 'accepted',
      });

      Alert.alert('Success', `You have joined ${invitation.crew?.name}`);

      navigation.navigate('CrewsStack', {
        screen: 'Crew',
        params: { crewId: invitation.crewId },
      });
    } catch (error) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Error', 'Could not accept invitation');
    }
  };

  const declineInvitation = async (invitation: InvitationWithDetails) => {
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

  const renderItem = ({ item }: { item: InvitationWithDetails }) => (
    <InvitationCard
      invitation={item}
      onAccept={() => acceptInvitation(item)}
      onDecline={() => declineInvitation(item)}
    />
  );

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {invitations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="mail-open-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>No invitations found</Text>
        </View>
      ) : (
        <FlatList
          data={invitations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
};

export default InvitationsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f9f9f9', // Light background for contrast
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 20,
    fontSize: 18,
    color: '#666',
  },
  listContent: {
    paddingBottom: 20,
  },
  separator: {
    height: 16,
  },
});
