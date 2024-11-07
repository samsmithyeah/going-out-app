// components/CreateCrewModal.tsx

import React, { useState } from 'react';
import { TextInput, StyleSheet, Alert } from 'react-native';
import { useUser } from '../context/UserContext';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import CustomModal from './CustomModal';

type CreateCrewModalProps = {
  isVisible: boolean;
  onClose: () => void;
  onCrewCreated: (crewId: string) => void;
};

const CreateCrewModal: React.FC<CreateCrewModalProps> = ({
  isVisible,
  onClose,
  onCrewCreated,
}) => {
  const { user } = useUser();
  const [newCrewName, setNewCrewName] = useState('');
  const [loading, setLoading] = useState(false);

  const createCrew = async () => {
    if (!newCrewName.trim()) {
      Alert.alert('Error', 'Crew name is required');
      return;
    }

    try {
      if (!user?.uid) {
        Alert.alert('Error', 'User is not authenticated');
        return;
      }

      setLoading(true);

      // Create a new crew
      const crewRef = await addDoc(collection(db, 'crews'), {
        name: newCrewName.trim(),
        ownerId: user.uid,
        memberIds: [user.uid],
        // Optionally, initialize iconUrl if you have a default image
        // iconUrl: 'https://example.com/default-icon.png',
      });

      // Clear input and close modal
      setNewCrewName('');
      onClose();
      console.log('Modal closed');

      // Notify parent component of the new crew creation
      onCrewCreated(crewRef.id);
    } catch (error) {
      console.error('Error creating crew:', error);
      Alert.alert('Error', 'Could not create crew');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setNewCrewName('');
    onClose();
  };

  return (
    <CustomModal
      isVisible={isVisible}
      onClose={onClose}
      title="Create a new crew"
      buttons={[
        {
          label: 'Create',
          onPress: createCrew,
          disabled: loading,
        },
        {
          label: 'Cancel',
          onPress: handleCancel,
          style: styles.cancelButton,
          disabled: loading,
        },
      ]}
      loading={loading}
    >
      <TextInput
        style={styles.input}
        placeholder="Crew name"
        value={newCrewName}
        onChangeText={setNewCrewName}
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={createCrew}
      />
    </CustomModal>
  );
};

export default CreateCrewModal;

const styles = StyleSheet.create({
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 25,
    padding: 15,
    marginBottom: 20,
    fontSize: 16,
    color: '#333',
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
});
