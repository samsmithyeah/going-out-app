// screens/CrewSettingsScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  useRoute,
  RouteProp,
  useNavigation,
  NavigationProp,
} from '@react-navigation/native';
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
} from 'firebase/firestore';
import { deleteCrew, db } from '../firebase';
import { useUser } from '../context/UserContext';
import { User } from '../types/User';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { NavParamList } from '../navigation/AppNavigator';
import ProfilePicturePicker from '../components/ProfilePicturePicker';
import MemberList from '../components/MemberList';
import { Crew } from './CrewScreen';

type CrewSettingsScreenRouteProp = RouteProp<NavParamList, 'CrewSettings'>;

const CrewSettingsScreen: React.FC = () => {
  const { user } = useUser();
  const route = useRoute<CrewSettingsScreenRouteProp>();
  const { crewId } = route.params;
  const navigation = useNavigation<NavigationProp<NavParamList>>();
  const [crew, setCrew] = useState<Crew | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);
  const [isEditNameModalVisible, setIsEditNameModalVisible] = useState(false);
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [newCrewName, setNewCrewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  // Fetch crew data and listen for real-time updates
  useEffect(() => {
    if (!crewId) {
      Alert.alert('Error', 'Crew ID is missing');
      setLoading(false);
      return;
    }

    const crewRef = doc(db, 'crews', crewId);

    const unsubscribeCrew = onSnapshot(
      crewRef,
      (docSnap) => {
        if (!user) return;

        if (docSnap.exists()) {
          const crewData: Crew = {
            id: docSnap.id,
            ...(docSnap.data() as Omit<Crew, 'id'>),
          };
          setCrew(crewData);
          setNewCrewName(crewData.name);
          navigation.setOptions({ title: 'Crew Info' });
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
      },
    );

    return () => {
      unsubscribeCrew();
    };
  }, [crewId, isDeleting, user, navigation]);

  // Fetch member profiles
  useEffect(() => {
    const fetchMembers = async () => {
      if (crew && crew.memberIds.length > 0) {
        try {
          const memberDocsPromises = crew.memberIds.map((memberId) =>
            getDoc(doc(db, 'users', memberId)),
          );
          const memberDocs = await Promise.all(memberDocsPromises);

          const membersList: User[] = memberDocs
            .filter((docSnap) => docSnap.exists())
            .map((docSnap) => ({
              uid: docSnap.id,
              ...(docSnap.data() as Omit<User, 'uid'>),
            }));

          setMembers(membersList);
        } catch (error) {
          console.error('Error fetching members:', error);
          Alert.alert('Error', 'Could not fetch member profiles');
        }
      } else {
        setMembers([]);
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
        fromUserId: user.uid,
        toUserId: inviteeId,
        status: 'pending',
        timestamp: new Date(),
      });

      // Close modal and clear input
      setIsInviteModalVisible(false);
      setInviteeEmail('');

      Alert.alert('Success', 'Invitation sent');
    } catch (error) {
      console.error('Error inviting user:', error);
      Alert.alert('Error', 'Could not send invitation');
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
              Alert.alert(
                'Error',
                error.message || 'Could not delete the crew',
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  // Function to leave the crew
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
                  const remainingMembers = crew.memberIds.filter(
                    (memberId) => memberId !== user.uid,
                  );
                  const newOwnerId =
                    remainingMembers[
                      Math.floor(Math.random() * remainingMembers.length)
                    ];

                  // Update the crew document with the new owner and remove the current user
                  await updateDoc(crewRef, {
                    ownerId: newOwnerId,
                    memberIds: remainingMembers,
                  });

                  navigation.navigate('CrewsList');
                  Alert.alert(
                    'Success',
                    'You have left the crew, and ownership was transferred.',
                  );
                }
              } else {
                // If the user is not the owner, simply remove them from the crew
                const updatedMemberIds = crew.memberIds.filter(
                  (memberId) => memberId !== user.uid,
                );

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
      ],
    );
  };

  // Function to handle crew name update
  const handleUpdateCrewName = async () => {
    if (!newCrewName.trim()) {
      Alert.alert('Error', 'Crew name cannot be empty');
      return;
    }

    if (newCrewName.trim().length < 3) {
      Alert.alert('Error', 'Crew name must be at least 3 characters long');
      return;
    }

    setIsUpdatingName(true);

    try {
      await updateDoc(doc(db, 'crews', crewId), { name: newCrewName.trim() });
      setCrew((prev) => (prev ? { ...prev, name: newCrewName.trim() } : prev));
      setIsEditNameModalVisible(false);
      Alert.alert('Success', 'Crew name updated successfully');
    } catch (error) {
      console.error('Error updating crew name:', error);
      Alert.alert('Error', 'Could not update crew name');
    } finally {
      setIsUpdatingName(false);
    }
  };

  if (loading || !crew) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.groupInfo}>
        <ProfilePicturePicker
          imageUrl={crew.iconUrl ?? null}
          onImageUpdate={async (newUrl) => {
            // Update local state
            setCrew({ ...crew, iconUrl: newUrl });

            // Update Firestore
            if (crewId) {
              try {
                const crewRef = doc(db, 'crews', crewId);
                await updateDoc(crewRef, { iconUrl: newUrl });
                console.log(
                  'iconUrl successfully updated in Firestore:',
                  newUrl,
                );
              } catch (error) {
                console.error('Error updating iconUrl in Firestore:', error);
                Alert.alert('Error', 'Could not update crew profile picture');
              }
            }
          }}
          editable={user?.uid === crew.ownerId}
          storagePath={`crews/${crewId}/icon.jpg`}
          size={120}
        />
        <View style={styles.groupNameContainer}>
          <Text style={styles.groupName}>{crew.name}</Text>
          {user?.uid === crew.ownerId && (
            <TouchableOpacity
              onPress={() => setIsEditNameModalVisible(true)}
              style={styles.editButton}
              accessibilityLabel="Edit Crew Name"
            >
              <Ionicons name="pencil" size={20} color="#1e90ff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Members List */}
      <Text style={styles.listTitle}>{`${members.length} members:`}</Text>
      <MemberList
        members={members}
        currentUserId={user?.uid || null}
        isLoading={loading}
        emptyMessage="No members in this crew."
        adminIds={[crew.ownerId]}
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setIsInviteModalVisible(true)}
        accessibilityLabel="Invite Member"
      >
        <MaterialIcons name="person-add" size={28} color="white" />
      </TouchableOpacity>

      {/* Leave Crew Button */}
      {user?.uid && (
        <TouchableOpacity
          style={styles.leaveButton}
          onPress={handleLeaveCrew}
          accessibilityLabel="Leave Crew"
        >
          <Text style={styles.leaveButtonText}>Leave crew</Text>
        </TouchableOpacity>
      )}

      {/* Delete Crew Button (Visible to Owner Only) */}
      {user?.uid === crew.ownerId && (
        <TouchableOpacity
          style={styles.leaveButton}
          onPress={handleDeleteCrew}
          accessibilityLabel="Delete Crew"
        >
          {isDeleting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.leaveButtonText}>Delete crew</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Modal for Inviting Member */}
      <Modal visible={isInviteModalVisible} animationType="slide" transparent>
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
              <TouchableOpacity
                style={styles.modalButton}
                onPress={inviteUserToCrew}
                accessibilityLabel="Send Invitation"
              >
                <Text style={styles.modalButtonText}>Send Invitation</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsInviteModalVisible(false)}
                accessibilityLabel="Cancel Invitation"
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal for Editing Crew Name */}
      <Modal visible={isEditNameModalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Crew Name</Text>
            <TextInput
              style={styles.input}
              placeholder="New Crew Name"
              value={newCrewName}
              onChangeText={setNewCrewName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleUpdateCrewName}
                accessibilityLabel="Update Crew Name"
              >
                {isUpdatingName ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Update Name</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setIsEditNameModalVisible(false);
                  setNewCrewName('');
                }}
                accessibilityLabel="Cancel Name Update"
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

      {/* Updating Name Indicator */}
      {isUpdatingName && (
        <View style={styles.updatingNameOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.updatingNameText}>Updating Name...</Text>
        </View>
      )}
    </View>
  );
};

export default CrewSettingsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  listTitle: {
    fontSize: 20,
    marginTop: 20,
    fontWeight: 'bold',
  },
  groupInfo: {
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  groupNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  groupName: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  editButton: {
    marginLeft: 10,
    padding: 5,
  },
  sectionTitle: {
    fontSize: 20,
    marginVertical: 10,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 16,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  memberText: {
    fontSize: 16,
    color: '#333',
    paddingLeft: 10,
  },
  youText: {
    color: 'gray',
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
    elevation: 5, // Add shadow for Android
    shadowColor: '#000', // Add shadow for iOS
    shadowOffset: { width: 0, height: 2 }, // iOS shadow
    shadowOpacity: 0.3, // iOS shadow
    shadowRadius: 3, // iOS shadow
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
    textAlign: 'center',
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
    flexDirection: 'row',
    justifyContent: 'center',
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
    backgroundColor: '#ff6347',
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
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 18,
  },
  updatingNameOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  updatingNameText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 18,
  },
});
