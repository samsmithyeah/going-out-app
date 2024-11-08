// components/CrewHeader.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Crew } from '../types/Crew';
import ProfilePicturePicker from './ProfilePicturePicker'; // Reuse existing component

interface CrewHeaderProps {
  crew: Crew;
}

const CrewHeader: React.FC<CrewHeaderProps> = ({ crew }) => {
  return (
    <View style={styles.container}>
      <ProfilePicturePicker
        imageUrl={crew.iconUrl || null}
        onImageUpdate={() => {}}
        editable={false}
        storagePath={`crews/${crew.id}/icon.jpg`}
        size={35}
      />
      <View style={styles.textContainer}>
        <Text style={styles.crewName}>{crew.name}</Text>
        <Text style={styles.memberCount}>
          {crew.memberIds.length}{' '}
          {crew.memberIds.length === 1 ? 'member' : 'members'}
        </Text>
      </View>
    </View>
  );
};

export default CrewHeader;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textContainer: {
    marginLeft: 10,
  },
  crewName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  memberCount: {
    fontSize: 14,
    color: '#666',
  },
});
