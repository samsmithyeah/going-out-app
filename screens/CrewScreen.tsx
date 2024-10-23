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
import { useRoute, RouteProp } from '@react-navigation/native';
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
import { db } from '../firebase';
import { useUser } from '../context/UserContext';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';

type CrewScreenRouteProp = RouteProp<RootStackParamList, 'Crew'>;

interface Crew {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
}

interface UserProfile {
  uid: string;
  email: string;
  name?: string;
}

interface Status {
  upForGoingOutTonight: boolean;
  timestamp: any; // Firestore timestamp
}

const CrewScreen: React.FC = () => {
  const { user } = useUser();
  const route = useRoute<CrewScreenRouteProp>();
  const { crewId } = route.params;
  const [crew, setCrew] = useState<Crew | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [statuses, setStatuses] = useState<{ [userId: string]: boolean }>({});
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [loading, setLoading] = useState(true);

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
        if (docSnap.exists()) {
          const crewData: Crew = {
            id: docSnap.id,
            ...(docSnap.data() as Omit<Crew, 'id'>),
          };
          setCrew(crewData);
        } else {
          Alert.alert('Error', 'Crew not found');
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching crew:', error);
        Alert.alert('Error', 'Could not fetch crew data');
        setLoading(false);
      }
    );

    const unsubscribeStatuses = onSnapshot(
      statusesRef,
      (snapshot) => {
        const newStatuses: { [userId: string]: boolean } = {};
        snapshot.docs.forEach((doc) => {
          const data = doc.data() as Status;
          newStatuses[doc.id] = data.upForGoingOutTonight || false;
        });
        setStatuses(newStatuses);
      },
      (error) => {
        console.error('Error fetching statuses:', error);
        Alert.alert('Error', 'Could not fetch statuses');
      }
    );

    return () => {
      unsubscribeCrew();
      unsubscribeStatuses();
    };
  }, [crewId]);

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

          const membersList: UserProfile[] = memberDocs
            .filter((docSnap) => docSnap.exists())
            .map((docSnap) => ({
              uid: docSnap.id,
              ...(docSnap.data() as Omit<UserProfile, 'uid'>),
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
      <Text style={styles.crewName}>{crew.name}</Text>
      <Text style={styles.sectionTitle}>Members:</Text>
      <FlatList
        data={members}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => (
          <View style={styles.memberItem}>
            <Text style={styles.memberText}>
              {item.name ? `${item.name} (${item.email})` : item.email}
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
                  {item.name ? `${item.name} (${item.email})` : item.email}
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
    marginBottom: 10,
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
});