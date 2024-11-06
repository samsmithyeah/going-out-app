// components/CrewList.tsx

import React from 'react';
import {
  FlatList,
  TouchableOpacity,
  Text,
  View,
  Image,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Crew } from '../types/Crew'; // Assuming you have a Crew type
import { User } from '../types/User';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavParamList } from '../navigation/AppNavigator';

type CrewListProps = {
  crews: Crew[];
  usersCache: { [key: string]: User };
  navigation: NativeStackNavigationProp<NavParamList, 'CrewsList'>;
};

const CrewList: React.FC<CrewListProps> = ({
  crews,
  usersCache,
  navigation,
}) => {
  return (
    <FlatList
      data={crews}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const memberNames = item.memberIds
          .map(
            (uid) =>
              usersCache[uid]?.firstName ||
              usersCache[uid]?.displayName ||
              'Unknown',
          )
          .filter((name) => name) // Remove any undefined or empty names
          .reduce((acc, name, index, array) => {
            if (index === 0) {
              return name;
            } else if (index === array.length - 1) {
              return `${acc} and ${name}`;
            } else {
              return `${acc}, ${name}`;
            }
          }, '');

        return (
          <TouchableOpacity
            style={styles.crewItem}
            onPress={() => navigation.navigate('Crew', { crewId: item.id })}
          >
            {/* Crew Image */}
            {item.iconUrl ? (
              <Image source={{ uri: item.iconUrl }} style={styles.crewImage} />
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons name="people-outline" size={24} color="#888" />
              </View>
            )}
            {/* Crew Details */}
            <View style={styles.crewDetails}>
              {/* Crew Name */}
              <Text style={styles.crewText}>{item.name}</Text>
              {/* Member Names */}
              <Text style={styles.memberText}>{memberNames}</Text>
            </View>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={<Text style={styles.emptyText}>No crews found</Text>}
      contentContainerStyle={crews.length === 0 && styles.emptyContainer}
    />
  );
};

export default CrewList;

const styles = StyleSheet.create({
  crewItem: {
    flexDirection: 'row', // Arrange image and text horizontally
    alignItems: 'center', // Vertically center items
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 8,
    elevation: 1, // Add slight shadow for Android
    shadowColor: '#000', // Add shadow for iOS
    shadowOffset: { width: 0, height: 1 }, // iOS shadow
    shadowOpacity: 0.1, // iOS shadow
    shadowRadius: 1, // iOS shadow
  },
  crewImage: {
    width: 50, // Adjust size as needed
    height: 50,
    borderRadius: 25,
    marginRight: 16, // Space between image and text
  },
  placeholderImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  crewDetails: {
    flex: 1, // Take up remaining space
  },
  crewText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
  },
  memberText: {
    fontSize: 14,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#888',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
