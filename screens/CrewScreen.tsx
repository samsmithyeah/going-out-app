// screens/CrewScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRoute, RouteProp, useNavigation, NavigationProp } from '@react-navigation/native';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, deleteCrew } from '../firebase';
import { useUser, FullUser } from '../context/UserContext';
import { MaterialIcons, Ionicons } from '@expo/vector-icons'; // Added Ionicons for delete icon
import { RootStackParamList } from '../navigation/AppNavigator';

type CrewScreenRouteProp = RouteProp<RootStackParamList, 'Crew'>;

interface Crew {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
}

interface Status {
  upForGoingOutTonight: boolean;
  timestamp: any; // Firestore timestamp
}

const CrewScreen: React.FC = () => {
  const { user } = useUser();
  const route = useRoute<CrewScreenRouteProp>();
  const { crewId } = route.params;
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [crew, setCrew] = useState<Crew | null>(null);
  const [members, setMembers] = useState<FullUser[]>([]);
  const [statuses, setStatuses] = useState<{ [userId: string]: boolean }>({});
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false); // State for deletion process

  // Fetch crew data and statuses in real-time
useEffect(() => {
  if (!crewId) {
    Alert.alert('Error', 'Crew ID is missing');
    setLoading(false);
    return;
  }

  const crewRef = doc(db, 'crews', crewId);
  const statusesRef = collection(crewRef, 'statuses');

  const unsubscribeCrew = onSnapshot(
    crewRef,
    (docSnap) => {
      // Check if user is still logged in
      if (!user) return;

      if (docSnap.exists()) {
        const crewData: Crew = {
          id: docSnap.id,
          ...(docSnap.data() as Omit<Crew, 'id'>),
        };
        setCrew(crewData);
        navigation.setOptions({ title: crewData.name });
      } else {
        if (!isDeleting) {
          console.warn('Crew not found');
        }
      }
      setLoading(false);
    },
    (error) => {
      if (user) {
        console.error('Error fetching crew:', error);
        Alert.alert('Error', 'Could not fetch crew data');
      }
      setLoading(false);
    }
  );

  const unsubscribeStatuses = onSnapshot(
    statusesRef,
    (snapshot) => {
      if (!user) return;

      const newStatuses: { [userId: string]: boolean } = {};
      snapshot.docs.forEach((doc) => {
        const data = doc.data() as Status;
        newStatuses[doc.id] = data.upForGoingOutTonight || false;
      });
      setStatuses(newStatuses);
    },
    (error) => {
      if (user) { 
        console.error('Error fetching statuses:', error);
        Alert.alert('Error', 'Could not fetch statuses');
      }
    }
  );

  return () => {
    unsubscribeCrew();
    unsubscribeStatuses();
  };
}, [crewId, isDeleting, user]); // Add `user` to dependencies to reset on logout


  // Fetch member profiles whenever crew.memberIds changes
  useEffect(() => {
    const fetchMembers = async () => {
      if (crew && crew.memberIds.length > 0) {
        try {
          // Fetch each member by their UID (document ID)
          const memberDocsPromises = crew.memberIds.map((memberId) =>
            getDoc(doc(db, 'users', memberId))
          );
          const memberDocs = await Promise.all(memberDocsPromises);

          const membersList: FullUser[] = memberDocs
            .filter((docSnap) => docSnap.exists())
            .map((docSnap) => ({
              uid: docSnap.id,
              ...(docSnap.data() as Omit<FullUser, 'uid'>),
            }));

          setMembers(membersList);
        } catch (error) {
          console.error('Error fetching members:', error);
          Alert.alert('Error', 'Could not fetch member profiles');
        }
      } else {
        setMembers([]); // Reset members if no memberIds
      }
    };

    fetchMembers();
  }, [crew]);

  // Function to invite a user by email
  const inviteUserToCrew = async () => {
    if (!inviteeEmail.trim()) {
      Alert.alert('Error', 'Email address is required');
      return;
    }

    try {
      if (!user?.uid) {
        Alert.alert('Error', 'User is not authenticated');
        return;
      }

      if (user.uid !== crew?.ownerId) {
        Alert.alert('Error', 'Only the crew owner can invite members');
        return;
      }

      const normalizedEmail = inviteeEmail.trim().toLowerCase();

      // Find the user by email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', normalizedEmail));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Alert.alert('Error', 'No user found with that email');
        return;
      }

      const inviteeDoc = querySnapshot.docs[0];
      const inviteeId = inviteeDoc.id;

      // Check if the user is already a member
      if (crew?.memberIds.includes(inviteeId)) {
        Alert.alert('Error', 'User is already a member of the crew');
        return;
      }

      // Check if there's already a pending invitation
      const invitationsRef = collection(db, 'invitations');
      const existingInvitationQuery = query(
        invitationsRef,
        where('crewId', '==', crewId),
        where('toUserId', '==', inviteeId),
        where('status', '==', 'pending')
      );
      const existingInvitationSnapshot = await getDocs(existingInvitationQuery);

      if (!existingInvitationSnapshot.empty) {
        Alert.alert('Error', 'A pending invitation already exists for this user');
        return;
      }

      // Create an invitation
      await addDoc(collection(db, 'invitations'), {
        crewId: crewId,
        fromUserId: user.uid,
        toUserId: inviteeId,
        status: 'pending',
        timestamp: new Date(),
      });

      // Close modal and clear input
      setIsModalVisible(false);
      setInviteeEmail('');

      Alert.alert('Success', 'Invitation sent');
    } catch (error) {
      console.error('Error inviting user:', error);
      Alert.alert('Error', 'Could not send invitation');
    }
  };

  // Function to toggle user's status
  const toggleStatus = async () => {
    if (!user?.uid || !crew) {
      Alert.alert('Error', 'User or Crew data is missing');
      return;
    }

    try {
      const crewRef = doc(db, 'crews', crewId);
      const statusesRef = collection(crewRef, 'statuses');
      const userStatusRef = doc(statusesRef, user.uid);

      const userStatusSnap = await getDoc(userStatusRef);
      if (userStatusSnap.exists()) {
        const currentStatus = userStatusSnap.data().upForGoingOutTonight || false;
        await updateDoc(userStatusRef, { upForGoingOutTonight: !currentStatus, timestamp: new Date() });
      } else {
        // If no status exists, set it to true
        await setDoc(userStatusRef, { upForGoingOutTonight: true, timestamp: new Date() });
      }

      // The onSnapshot listener will update the local state
    } catch (error) {
      console.error('Error toggling status:', error);
      Alert.alert('Error', 'Could not update your status');
    }
  };

  // Function to delete the crew
  const handleDeleteCrew = async () => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete this crew? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user?.uid || !crew) {
              Alert.alert('Error', 'User or Crew data is missing');
              return;
            }

            if (user.uid !== crew.ownerId) {
              Alert.alert('Error', 'Only the crew owner can delete the crew');
              return;
            }

            setIsDeleting(true);

            try {
              // Call the Cloud Function to delete the crew
              const result = await deleteCrew(crewId);
              const data = result.data as { success: boolean };
              if (data.success) {
                navigation.navigate('CrewsList'); 
                Alert.alert('Success', 'Crew deleted successfully');
              } else {
                throw new Error('Deletion failed');
              }
            } catch (error: any) {
              console.error('Error deleting crew:', error);
              Alert.alert('Error', error.message || 'Could not delete the crew');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleLeaveCrew = async () => {
  if (!user?.uid || !crew) {
    Alert.alert('Error', 'User or Crew data is missing');
    return;
  }

  Alert.alert(
    'Confirm Leaving',
    'Are you sure you want to leave this crew?',
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            const crewRef = doc(db, 'crews', crewId);

            // If the user is the owner of the crew
            if (user.uid === crew.ownerId) {
              if (crew.memberIds.length === 1) {
                // If the user is the only member, delete the crew
                await deleteCrew(crewId);
                navigation.navigate('CrewsList');
                Alert.alert('Success', 'You have left and deleted the crew');
              } else {
                // Assign a new owner randomly from the remaining members
                const remainingMembers = crew.memberIds.filter((memberId) => memberId !== user.uid);
                const newOwnerId = remainingMembers[Math.floor(Math.random() * remainingMembers.length)];

                // Update the crew document with the new owner and remove the current user
                await updateDoc(crewRef, {
                  ownerId: newOwnerId,
                  memberIds: remainingMembers,
                });

                navigation.navigate('CrewsList');
                Alert.alert('Success', 'You have left the crew, and ownership was transferred.');
              }
            } else {
              // If the user is not the owner, simply remove them from the crew
              const updatedMemberIds = crew.memberIds.filter((memberId) => memberId !== user.uid);

              await updateDoc(crewRef, {
                memberIds: updatedMemberIds,
              });

              navigation.navigate('CrewsList');
              Alert.alert('Success', 'You have left the crew');
            }
          } catch (error) {
            console.error('Error leaving crew:', error);
            Alert.alert('Error', 'Could not leave the crew');
          }
        },
      },
    ]
  );
};


  // Derive current user's status directly from statuses object
  const currentUserStatus = user?.uid ? statuses[user.uid] || false : false;

  // Get list of members who are up for going out tonight
  const membersUpForGoingOut = members.filter((member) => statuses[member.uid]);

  if (loading || !crew) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Crew Header */}
      <View style={styles.headerContainer}>
        {/* Delete Crew Button (Visible to Owner Only) */}
        {user?.uid === crew.ownerId && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteCrew}>
            {isDeleting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Ionicons name="trash-outline" size={24} color="white" />
            )}
          </TouchableOpacity>
        )}
        {user?.uid && (
          <TouchableOpacity
            style={styles.leaveButton}
            onPress={handleLeaveCrew}
          >
            <Text style={styles.leaveButtonText}>Leave Crew</Text>
          </TouchableOpacity>
)}
      </View>

      {/* Members List */}
      <Text style={styles.sectionTitle}>Members:</Text>
      <FlatList
        data={members}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => (
          <View style={styles.memberItem}>
            <Text style={styles.memberText}>
              {item.displayName}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text>No members found</Text>}
      />

      {/* Members Up for Going Out Tonight */}
      {currentUserStatus && (
        <>
          <Text style={styles.sectionTitle}>Members Up for Going Out Tonight:</Text>
          <FlatList
            data={membersUpForGoingOut}
            keyExtractor={(item) => item.uid}
            renderItem={({ item }) => (
              <View style={styles.memberItem}>
                <Text style={styles.memberText}>
                  {item.displayName}
                </Text>
              </View>
            )}
            ListEmptyComponent={<Text>No members are up for going out tonight.</Text>}
          />
        </>
      )}

      {/* Toggle Status Button */}
      <TouchableOpacity
        style={[
          styles.statusButton,
          currentUserStatus ? styles.statusButtonActive : styles.statusButtonInactive,
        ]}
        onPress={toggleStatus}
      >
        <Text style={styles.statusButtonText}>
          {currentUserStatus ? "I'm not up for going out tonight" : "I'm up for going out tonight"}
        </Text>
      </TouchableOpacity>

      {/* Invite Member Button (Visible to Owner Only) */}
      {user?.uid === crew.ownerId && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsModalVisible(true)}
        >
          <MaterialIcons name="person-add" size={28} color="white" />
        </TouchableOpacity>
      )}

      {/* Modal for Inviting Member */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Invite Member by Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Member's Email"
              value={inviteeEmail}
              onChangeText={setInviteeEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={inviteUserToCrew}>
                <Text style={styles.modalButtonText}>Send Invitation</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Deletion Indicator */}
      {isDeleting && (
        <View style={styles.deletionOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.deletionText}>Deleting Crew...</Text>
        </View>
      )}
    </View>
  );
};

export default CrewScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  crewName: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#ff4d4d', // Red color for delete
    padding: 10,
    borderRadius: 5,
  },
  sectionTitle: {
    fontSize: 20,
    marginVertical: 10,
  },
  memberItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  memberText: {
    fontSize: 18,
  },
  addButton: {
    backgroundColor: '#1e90ff',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  statusButton: {
    padding: 15,
    borderRadius: 10,
    marginVertical: 20,
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: '#ff6347', // Tomato color when active
  },
  statusButtonInactive: {
    backgroundColor: '#32cd32', // LimeGreen color when inactive
  },
  statusButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
    backgroundColor: 'rgba(0,0,0,0.5)', // Semi-transparent background
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 35,
    alignItems: 'center',
    width: '80%',
    shadowColor: '#000',
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    marginBottom: 15,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    backgroundColor: '#1e90ff',
    padding: 10,
    borderRadius: 5,
    width: '48%',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deletionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deletionText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 18,
  },
  leaveButton: {
  backgroundColor: '#ff6347', // Tomato color for leave button
  padding: 15,
  borderRadius: 10,
  alignItems: 'center',
  marginTop: 10,
},
leaveButtonText: {
  color: 'white',
  fontWeight: 'bold',
  fontSize: 16,
},
});
