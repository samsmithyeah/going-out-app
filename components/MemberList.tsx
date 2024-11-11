// components/MemberList.tsx

import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import ProfilePicturePicker from './ProfilePicturePicker';
import SkeletonUserItem from './SkeletonUserItem'; // Ensure this component exists
import { User } from '../types/User';
import { Ionicons } from '@expo/vector-icons';

interface MemberListProps {
  members: User[];
  currentUserId: string | null;
  onMemberPress?: (member: User) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  adminIds?: string[];
  selectedMemberIds?: string[]; // New prop for selected members
  onSelectMember?: (memberId: string) => void; // New prop for selection handler
}

const MemberList: React.FC<MemberListProps> = ({
  members,
  currentUserId,
  onMemberPress,
  isLoading = false,
  emptyMessage = 'No members found.',
  adminIds = [],
  selectedMemberIds = [],
  onSelectMember,
}) => {
  // Memoize the sorted members to avoid unnecessary re-sorting on each render
  const sortedMembers = useMemo(() => {
    // Create a shallow copy to avoid mutating the original array
    const membersCopy = [...members];

    // Sort the members by displayName (case-insensitive)
    membersCopy.sort((a, b) => {
      const nameA = a.displayName ? a.displayName.toLowerCase() : '';
      const nameB = b.displayName ? b.displayName.toLowerCase() : '';

      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });

    return membersCopy;
  }, [members]);

  const renderItem = ({ item }: { item: User }) => {
    const isSelected = selectedMemberIds.includes(item.uid);

    return (
      <TouchableOpacity
        style={styles.memberItem}
        onPress={() => {
          if (onSelectMember) {
            onSelectMember(item.uid);
          }
          if (onMemberPress) {
            onMemberPress(item);
          }
        }}
        activeOpacity={onSelectMember || onMemberPress ? 0.7 : 1}
      >
        {/* Display Profile Picture */}
        <ProfilePicturePicker
          imageUrl={item.photoURL || null}
          onImageUpdate={() => {}}
          editable={false}
          storagePath={`users/${item.uid}/profile.jpg`}
          size={40}
        />
        <View style={styles.memberInfo}>
          <Text style={styles.memberText}>
            {item.displayName || 'Unnamed Member'}{' '}
            {item.uid === currentUserId && (
              <Text style={styles.youText}>(You)</Text>
            )}
          </Text>
          {adminIds.includes(item.uid) && (
            <>
              <View style={styles.adminIndicator}>
                <Text style={styles.adminText}>Admin</Text>
              </View>
            </>
          )}
        </View>
        {onSelectMember && (
          <Ionicons
            name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color="#1e90ff"
          />
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    // Display Skeletons or Loading Indicators
    return (
      <View style={styles.container}>
        {[...Array(6)].map((_, index) => (
          <SkeletonUserItem key={index} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sortedMembers}
        keyExtractor={(item) => item.uid}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        }
        scrollEnabled={false}
      />
    </View>
  );
};

export default MemberList;

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 10,
  },
  memberText: {
    fontSize: 16,
    color: '#333',
  },
  youText: {
    color: 'gray',
  },
  adminIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  adminText: {
    fontSize: 12,
    color: 'green',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
});
