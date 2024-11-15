// screens/CrewSettingsScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Alert,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  useRoute,
  RouteProp,
  useNavigation,
  NavigationProp,
} from '@react-navigation/native';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { deleteCrew, db } from '../firebase';
import { useUser } from '../context/UserContext';
import { User } from '../types/User';
import { Ionicons } from '@expo/vector-icons';
import { NavParamList } from '../navigation/AppNavigator';
import ProfilePicturePicker from '../components/ProfilePicturePicker';
import MemberList from '../components/MemberList';
import { Crew } from '../types/Crew';
import CustomButton from '../components/CustomButton';
import CustomTextInput from '../components/CustomTextInput';
import CustomModal from '../components/CustomModal';
import LoadingOverlay from '../components/LoadingOverlay';

type CrewSettingsScreenRouteProp = RouteProp<NavParamList, 'CrewSettings'>;

const CrewSettingsScreen: React.FC = () => {
  const { user } = useUser();
  const route = useRoute<CrewSettingsScreenRouteProp>();
  const { crewId } = route.params;
  const navigation = useNavigation<NavigationProp<NavParamList>>();
  const [crew, setCrew] = useState<Crew | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [isEditNameModalVisible, setIsEditNameModalVisible] = useState(false);
  const [isEditActivityModalVisible, setIsEditActivityModalVisible] =
    useState(false);
  const [newCrewName, setNewCrewName] = useState('');
  const [newActivity, setNewActivity] = useState('');
  const [activityError, setActivityError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isUpdatingActivity, setIsUpdatingActivity] = useState(false);

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
          setNewActivity(crewData.activity || 'going out');
          navigation.setOptions({ title: 'Crew Info' });
        } else {
          if (!isDeleting) {
            console.warn('Crew not found');
            navigation.navigate('CrewsList');
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

  // Function to delete the crew
  const handleDeleteCrew = async () => {
    Alert.alert(
      'Confirm deletion',
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

  // Function to navigate to OtherUserProfileScreen
  const navigateToUserProfile = (selectedUser: User) => {
    if (selectedUser.uid === user?.uid) {
      navigation.navigate('UserProfileStack', {
        screen: 'UserProfile',
        params: { userId: user.uid },
        initial: false,
      });
      return;
    }
    navigation.navigate('OtherUserProfile', { userId: selectedUser.uid });
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

  // Function to handle activity update
  const handleUpdateActivity = async () => {
    if (!newActivity.trim()) {
      Alert.alert('Error', 'Crew activity cannot be empty');
      return;
    }

    if (newActivity.trim().length < 3) {
      Alert.alert('Error', 'Crew activity must be at least 3 characters long');
      return;
    }

    if (newActivity.trim().length > 50) {
      Alert.alert('Error', 'Crew activity cannot exceed 50 characters');
      return;
    }

    setIsUpdatingActivity(true);

    try {
      await updateDoc(doc(db, 'crews', crewId), {
        activity: newActivity.trim(),
      });
      setCrew((prev) =>
        prev ? { ...prev, activity: newActivity.trim() } : prev,
      );
      setIsEditActivityModalVisible(false);
      Alert.alert('Success', 'Crew activity updated successfully');
    } catch (error) {
      console.error('Error updating crew activity:', error);
      Alert.alert('Error', 'Could not update crew activity');
    } finally {
      setIsUpdatingActivity(false);
    }
  };

  if (!crew) {
    return <LoadingOverlay />;
  }

  return (
    <>
      {(loading || !crew) && <LoadingOverlay />}
      {isDeleting && <LoadingOverlay text="Deleting..." />}
      <ScrollView style={styles.container}>
        {/* Crew Header */}
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

        {/* Crew Activity Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Crew activity:</Text>
          <View style={styles.activityDisplayContainer}>
            <Text style={styles.activityText}>
              {crew.activity || 'going out'}
            </Text>
            <TouchableOpacity
              onPress={() => setIsEditActivityModalVisible(true)}
              style={styles.editActivityButton}
              accessibilityLabel="Edit Crew Activity"
            >
              <Ionicons name="pencil" size={20} color="#1e90ff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Members List Header with Add Button */}
        <View style={styles.sectionContainer}>
          <View style={styles.membersListHeader}>
            <Text
              style={styles.sectionTitle}
            >{`${members.length} member${members.length !== 1 ? 's' : ''}:`}</Text>
            <TouchableOpacity
              style={styles.addButtonInline}
              onPress={() =>
                navigation.navigate('AddMembers', { crewId: crewId })
              }
              accessibilityLabel="Add Member"
            >
              <Ionicons name="add-circle" size={30} color="#1e90ff" />
            </TouchableOpacity>
          </View>

          {/* Members List */}
          <MemberList
            members={members}
            currentUserId={user?.uid || null}
            isLoading={loading}
            emptyMessage="No members in this crew."
            adminIds={[crew.ownerId]}
            onMemberPress={navigateToUserProfile}
          />
        </View>

        {/* Leave Crew Button */}
        <View style={styles.leaveButton}>
          <CustomButton
            title="Leave crew"
            onPress={handleLeaveCrew}
            variant="secondaryDanger" // Red variant indicating a destructive action
            accessibilityLabel="Leave Crew"
            accessibilityHint="Leave the current crew"
          />
        </View>

        {/* Delete Crew Button (Visible to Owner Only) */}
        {user?.uid === crew.ownerId && (
          <CustomButton
            title="Delete crew"
            onPress={handleDeleteCrew}
            variant="danger" // Red variant indicating a destructive action
            accessibilityLabel="Delete Crew"
            accessibilityHint="Permanently delete this crew"
            loading={isDeleting} // Show loading indicator when deleting
          />
        )}

        {/* Modal for Editing Crew Name */}
        <CustomModal
          isVisible={isEditNameModalVisible}
          onClose={() => {
            setIsEditNameModalVisible(false);
            setNewCrewName('');
          }}
          title="Edit crew name"
          buttons={[
            {
              label: 'Update',
              onPress: handleUpdateCrewName,
              variant: 'primary',
              disabled: isUpdatingName || isUpdatingActivity,
            },
            {
              label: 'Cancel',
              onPress: () => {
                setIsEditNameModalVisible(false);
                setNewCrewName('');
              },
              variant: 'secondary',
              disabled: isUpdatingName || isUpdatingActivity,
            },
          ]}
          loading={isUpdatingName}
        >
          <CustomTextInput
            placeholder="New crew name"
            value={newCrewName}
            onChangeText={setNewCrewName}
            autoCapitalize="words"
            hasBorder={true}
          />
        </CustomModal>

        {/* Modal for Editing Crew Activity */}
        <CustomModal
          isVisible={isEditActivityModalVisible}
          onClose={() => {
            setIsEditActivityModalVisible(false);
            setNewActivity('');
            setActivityError('');
          }}
          title="Edit crew activity"
          buttons={[
            {
              label: 'Update',
              onPress: handleUpdateActivity,
              variant: 'primary',
              disabled: isUpdatingActivity,
            },
            {
              label: 'Cancel',
              onPress: () => {
                setIsEditActivityModalVisible(false);
                setNewActivity(crew.activity || 'going out');
                setActivityError('');
              },
              variant: 'secondary',
              disabled: isUpdatingActivity,
            },
          ]}
          loading={isUpdatingActivity}
        >
          <CustomTextInput
            placeholder="Enter crew activity"
            value={newActivity}
            onChangeText={setNewActivity}
            hasBorder={true}
          />
          {activityError ? (
            <Text style={styles.errorText}>{activityError}</Text>
          ) : null}
        </CustomModal>
      </ScrollView>
    </>
  );
};

export default CrewSettingsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  groupInfo: {
    alignItems: 'center',
    padding: 16,
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
  sectionContainer: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  activityDisplayContainer: {
    marginTop: 10,
    flexDirection: 'row',
  },
  activityText: {
    fontSize: 18,
    marginBottom: 15,
  },
  editActivityButton: {
    marginLeft: 10,
  },
  membersListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addButtonInline: {
    padding: 5,
  },
  leaveButton: {
    marginTop: 10,
    marginBottom: 10,
  },
  errorText: {
    color: 'red',
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
});
