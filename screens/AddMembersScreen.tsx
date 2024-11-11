// screens/AddMembersScreen.tsx

import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  getDoc,
  limit,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from '../context/UserContext';
import { User } from '../types/User';
import MemberList from '../components/MemberList';
import CustomSearchInput from '../components/CustomSearchInput';
import CustomButton from '../components/CustomButton';
import CustomTextInput from '../components/CustomTextInput';
import { NavParamList } from '../navigation/AppNavigator';

type AddMembersScreenRouteProp = RouteProp<NavParamList, 'AddMembers'>;

const AddMembersScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<AddMembersScreenRouteProp>();
  const { crewId } = route.params;
  const { user } = useUser();

  const [allPotentialMembers, setAllPotentialMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [emailToAdd, setEmailToAdd] = useState<string>('');
  const [addingByEmail, setAddingByEmail] = useState<boolean>(false);

  // Fetch all members from all of the user's crews
  useEffect(() => {
    const fetchPotentialMembers = async () => {
      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        setLoading(false);
        return;
      }

      try {
        // Fetch all crews the user is part of
        const crewsRef = collection(db, 'crews');
        const userCrewsQuery = query(
          crewsRef,
          where('memberIds', 'array-contains', user.uid),
        );
        const crewsSnapshot = await getDocs(userCrewsQuery);

        // Collect all unique member IDs from all crews
        const memberIdsSet = new Set<string>();

        crewsSnapshot.forEach((crewDoc) => {
          const crewData = crewDoc.data();
          const memberIds: string[] = crewData.memberIds || [];
          memberIds.forEach((id) => memberIdsSet.add(id));
        });

        // Remove members already in the current crew
        const currentCrewRef = doc(db, 'crews', crewId);
        const currentCrewSnap = await getDoc(currentCrewRef);
        if (!currentCrewSnap.exists()) {
          Alert.alert('Error', 'Crew does not exist');
          setLoading(false);
          return;
        }
        const currentCrewData = currentCrewSnap.data();
        const currentCrewMemberIds: string[] = currentCrewData.memberIds || [];
        currentCrewMemberIds.forEach((id) => memberIdsSet.delete(id));

        // Convert the set to an array
        const potentialMemberIds = Array.from(memberIdsSet);

        if (potentialMemberIds.length === 0) {
          setAllPotentialMembers([]);
          setLoading(false);
          return;
        }

        // Fetch user profiles
        const usersRef = collection(db, 'users');
        const userDocsPromises = potentialMemberIds.map((memberId) =>
          getDoc(doc(usersRef, memberId)),
        );
        const userDocs = await Promise.all(userDocsPromises);

        const potentialMembers: User[] = userDocs
          .filter((docSnap) => docSnap.exists())
          .map((docSnap) => ({
            uid: docSnap.id,
            ...(docSnap.data() as Omit<User, 'uid'>),
          }));

        setAllPotentialMembers(potentialMembers);
      } catch (error) {
        console.error('Error fetching potential members:', error);
        Alert.alert('Error', 'Could not fetch potential members');
      } finally {
        setLoading(false);
      }
    };

    fetchPotentialMembers();
  }, [crewId, user]);

  // Handle selection toggling
  const handleSelectMember = (memberId: string) => {
    setSelectedMemberIds((prevSelected) => {
      if (prevSelected.includes(memberId)) {
        return prevSelected.filter((id) => id !== memberId);
      } else {
        return [...prevSelected, memberId];
      }
    });
  };

  // Handle adding selected members to the crew
  const handleAddSelectedMembers = async () => {
    if (selectedMemberIds.length === 0) {
      Alert.alert('Info', 'No members selected to add');
      return;
    }

    try {
      // Iterate through selectedMemberIds and send invitations
      const invitationsRef = collection(db, 'invitations');
      const batch = writeBatch(db); // Optional: Use batch writes for atomicity

      for (const memberId of selectedMemberIds) {
        // Check if there's already a pending invitation
        const existingInvitationQuery = query(
          invitationsRef,
          where('crewId', '==', crewId),
          where('toUserId', '==', memberId),
          where('status', '==', 'pending'),
        );
        const existingInvitationSnapshot = await getDocs(
          existingInvitationQuery,
        );

        if (!existingInvitationSnapshot.empty) {
          continue; // Skip if already invited
        }

        // Create an invitation
        const newInvitationRef = doc(invitationsRef);
        batch.set(newInvitationRef, {
          crewId: crewId,
          fromUserId: user?.uid,
          toUserId: memberId,
          status: 'pending',
          timestamp: new Date(),
        });
      }

      await batch.commit();

      const successMessage = () => {
        if (selectedMemberIds.length === 1) {
          return '1 member invited to the crew';
        }

        return `${selectedMemberIds.length} members invited to the crew`;
      };

      Alert.alert('Success', successMessage());
      navigation.goBack();
    } catch (error) {
      console.error('Error adding members:', error);
      Alert.alert('Error', 'Could not add selected members');
    }
  };

  const getSelectedMemberText = () => {
    if (selectedMemberIds.length === 0) {
      return 'Add members';
    }

    return `Add ${selectedMemberIds.length} member${selectedMemberIds.length > 1 ? 's' : ''}`;
  };

  // Handle adding a member by email
  const handleAddByEmail = async () => {
    if (!emailToAdd.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    setAddingByEmail(true);

    try {
      // Normalize the email to lowercase
      const normalizedEmail = emailToAdd.trim().toLowerCase();

      // Find the user by email
      const usersRef = collection(db, 'users');
      const emailQuery = query(
        usersRef,
        where('email', '==', normalizedEmail),
        where('memberIds', 'array-contains', user?.uid), // Ensure the user is part of at least one crew
        limit(1),
      );
      const querySnapshot = await getDocs(emailQuery);

      if (querySnapshot.empty) {
        Alert.alert('Error', 'No user found with that email');
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const inviteeId = userDoc.id;

      // Check if the user is already a member of the crew
      const crewDoc = await getDoc(doc(db, 'crews', crewId));
      const crewData = crewDoc.data();
      const crewMemberIds: string[] = crewData?.memberIds || [];

      if (crewMemberIds.includes(inviteeId)) {
        Alert.alert('Error', 'User is already a member of the crew');
        return;
      }

      // Check if there's already a pending invitation
      const invitationsRef = collection(db, 'invitations');
      const existingInvitationQuery = query(
        invitationsRef,
        where('crewId', '==', crewId),
        where('toUserId', '==', inviteeId),
        where('status', '==', 'pending'),
      );
      const existingInvitationSnapshot = await getDocs(existingInvitationQuery);

      if (!existingInvitationSnapshot.empty) {
        Alert.alert(
          'Error',
          'A pending invitation already exists for this user',
        );
        return;
      }

      // Create an invitation
      await addDoc(collection(db, 'invitations'), {
        crewId: crewId,
        fromUserId: user?.uid,
        toUserId: inviteeId,
        status: 'pending',
        timestamp: new Date(),
      });

      Alert.alert('Success', 'Invitation sent');
      setEmailToAdd('');
      navigation.goBack();
    } catch (error) {
      console.error('Error adding member by email:', error);
      Alert.alert('Error', 'Could not add member by email');
    } finally {
      setAddingByEmail(false);
    }
  };

  // Filtered list based on search query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) {
      return allPotentialMembers;
    }

    const lowercasedQuery = searchQuery.trim().toLowerCase();

    return allPotentialMembers.filter((member) => {
      const displayNameMatch = member.displayName
        ? member.displayName.toLowerCase().includes(lowercasedQuery)
        : false;
      const emailMatch = member.email
        ? member.email.toLowerCase().includes(lowercasedQuery)
        : false;

      return displayNameMatch || emailMatch;
    });
  }, [allPotentialMembers, searchQuery]);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <CustomSearchInput
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
      />

      {/* Members List */}
      <MemberList
        members={filteredMembers}
        currentUserId={user?.uid || null}
        selectedMemberIds={selectedMemberIds}
        onSelectMember={handleSelectMember}
        isLoading={loading}
        emptyMessage={
          searchQuery.trim() !== ''
            ? 'No members match your search.'
            : 'No members available to add.'
        }
        adminIds={[]} // Adjust if there are admins to highlight
      />

      {/* Add Selected Members Button */}
      <CustomButton
        title={getSelectedMemberText()}
        onPress={handleAddSelectedMembers}
        disabled={selectedMemberIds.length === 0}
        accessibilityLabel="Add Selected Members to Crew"
        accessibilityHint="Adds the selected members to the crew"
        variant="primary"
      />

      {/* Divider */}
      <View style={styles.divider} />

      {/* Add by Email Section */}
      <Text style={styles.sectionTitle}>Or via email address:</Text>
      <View>
        <CustomTextInput
          placeholder="Email address"
          value={emailToAdd}
          onChangeText={setEmailToAdd}
          keyboardType="email-address"
          autoCapitalize="none"
          hasBorder={true}
        />
        <CustomButton
          title="Add member"
          onPress={handleAddByEmail}
          loading={addingByEmail}
          accessibilityLabel="Add Member by Email"
          accessibilityHint="Adds a member to the crew by their email address"
          variant="primary"
          disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToAdd)}
        />
      </View>
    </View>
  );
};

export default AddMembersScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 20,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
