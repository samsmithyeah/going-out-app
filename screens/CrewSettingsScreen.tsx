// screens/CrewSettingsScreen.tsx

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
  Image,
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
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { db, deleteCrew, storage } from '../firebase';
import { useUser, FullUser } from '../context/UserContext';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';

type CrewSettingsScreenRouteProp = RouteProp<RootStackParamList, 'CrewSettings'>;

interface Crew {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  iconUrl?: string;
}

interface Status {
  upForGoingOutTonight: boolean;
  timestamp: any;
}

const CrewSettingsScreen: React.FC = () => {
  const { user } = useUser();
  const route = useRoute<CrewSettingsScreenRouteProp>();
  const { crewId } = route.params;
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [crew, setCrew] = useState<Crew | null>(null);
  const [members, setMembers] = useState<FullUser[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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
          navigation.setOptions({ title: 'Crew info' });
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

    return () => {
      unsubscribeCrew();
    };
  }, [crewId, isDeleting, user]);

  // Fetch member profiles
  useEffect(() => {
    const fetchMembers = async () => {
      if (crew && crew.memberIds.length > 0) {
        try {
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

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      if (result.assets && result.assets.length > 0) {
        uploadImage(result.assets[0].uri);
      }
    }
  };

  const uploadImage = async (uri: string) => {
    setIsUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `crews/${crewId}/icon.jpg`);
      await uploadBytes(storageRef, blob);

      const downloadUrl = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'crews', crewId), { iconUrl: downloadUrl });
      setCrew((prev) => (prev ? { ...prev, iconUrl: downloadUrl } : prev));

      Alert.alert('Success', 'Crew icon updated');
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Could not upload image');
    } finally {
      setIsUploading(false);
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
        <TouchableOpacity onPress={pickImage} style={styles.iconContainer}>
          {crew?.iconUrl ? (
            <Image source={{ uri: crew.iconUrl }} style={styles.groupIcon} />
          ) : (
            <Ionicons name="camera" size={48} color="#888" />
          )}
        </TouchableOpacity>
        <Text style={styles.groupName}>{crew?.name}</Text>
      </View>

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

      {/* Leave Crew Button */}
      {user?.uid && (
        <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveCrew}>
          <Text style={styles.leaveButtonText}>Leave Crew</Text>
        </TouchableOpacity>
      )}

      {/* Members List */}
      <Text style={styles.sectionTitle}>{members.length} members:</Text>
      <FlatList
        data={members}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => (
          <View style={styles.memberItem}>
            <Text style={styles.memberText}>{item.displayName}</Text>
          </View>
        )}
        ListEmptyComponent={<Text>No members found</Text>}
      />

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

export default CrewSettingsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  groupInfo: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  groupIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  groupName: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    marginBottom: 10,
  },
  deleteButton: {
    backgroundColor: '#ff4d4d', // Red color for delete
    padding: 10,
    borderRadius: 5,
    alignSelf: 'flex-end',
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
    fontSize: 16,
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
