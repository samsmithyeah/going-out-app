// components/CreateCrewModal.tsx

import React, { useState } from 'react';
import { useUser } from '@/context/UserContext';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import CustomModal from './CustomModal';
import CustomTextInput from './CustomTextInput';
import Toast from 'react-native-toast-message';
import { useCrews } from '@/context/CrewsContext';

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
  const { setCrews, setCrewIds } = useCrews();

  const createCrew = async () => {
    if (!newCrewName.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Crew name cannot be empty',
      });
      return;
    }

    try {
      if (!user?.uid) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'User not authenticated',
        });
        return;
      }

      setLoading(true);

      // Create a new crew
      const crewRef = await addDoc(collection(db, 'crews'), {
        name: newCrewName.trim(),
        ownerId: user.uid,
        memberIds: [user.uid],
      });

      // Update local state with the new crew
      setCrews((prevCrews) => [
        ...prevCrews,
        {
          id: crewRef.id,
          name: newCrewName.trim(),
          ownerId: user.uid,
          memberIds: [user.uid],
          activity: 'meeting up',
        },
      ]);
      setCrewIds((prevIds) => [...prevIds, crewRef.id]);

      // Clear input and close modal
      setNewCrewName('');
      onClose();
      console.log('Modal closed');

      // Notify parent component of the new crew creation
      onCrewCreated(crewRef.id);
    } catch (error) {
      console.error('Error creating crew:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to create the crew. Please try again.',
      });
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
          disabled: loading || !newCrewName.trim(),
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
