// components/CreateCrewModal.tsx

import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useUser } from '../context/UserContext';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import CustomModal from './CustomModal';
import CustomTextInput from './CustomTextInput';

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
          variant: 'primary',
        },
        {
          label: 'Cancel',
          onPress: handleCancel,
          disabled: loading,
          variant: 'secondary',
        },
      ]}
      loading={loading}
    >
      <CustomTextInput
        placeholder="Crew name"
        placeholderTextColor="#666"
        value={newCrewName}
        onChangeText={setNewCrewName}
        autoCapitalize="words"
        hasBorder={true}
      />
    </CustomModal>
  );
};

export default CreateCrewModal;
