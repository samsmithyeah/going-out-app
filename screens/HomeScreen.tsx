// screens/HomeScreen.tsx

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useCrews } from '../context/CrewsContext';
import { useUser } from '../context/UserContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import moment from 'moment';

const getDotColor = (count: number, total: number): string => {
  if (count === total && total > 0) return '#32CD32'; // Green
  if (count > 0 && count < total) return '#FFA500'; // Orange
  return '#D3D3D3'; // Grey
};

const HomeScreen: React.FC = () => {
  const { user } = useUser();
  const { crewIds, dateCounts, toggleStatusForDate } = useCrews();
  const [loading, setLoading] = useState<boolean>(false);

  // Generate week dates
  const weekDates = React.useMemo(() => {
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      dates.push(moment().add(i, 'days').format('YYYY-MM-DD'));
    }
    return dates;
  }, []);

  // Render a single day item
  const renderDayItem = ({ item }: { item: string }) => {
    const count = dateCounts[item] || 0;
    const total = crewIds.length;
    const isDisabled = moment(item).isBefore(moment(), 'day');
    const statusColor = getDotColor(count, total);
    const statusText = `Up for seeing ${count} of ${total} crew${total !== 1 ? 's' : ''}`;
    const isFullyUp = count === total;
    const isNotUp = count === 0;

    return (
      <View
        style={[styles.dayContainer, isDisabled && styles.disabledDayContainer]}
      >
        <View style={styles.dayHeader}>
          <Text style={[styles.dayText, isDisabled && styles.disabledDayText]}>
            {moment(item).format('dddd, MMMM Do')}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <View style={styles.statusInfo}>
            <View
              style={[styles.statusDot, { backgroundColor: statusColor }]}
            />
            <Text
              style={[styles.statusText, isDisabled && styles.disabledDayText]}
            >
              {statusText}
            </Text>
          </View>
          {!isDisabled && (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                onPress={() => handleToggle(item, true)}
                disabled={isFullyUp || loading}
                style={[
                  styles.iconButton,
                  (isFullyUp || loading) && styles.disabledButton,
                ]}
                accessibilityLabel={`Mark as up for ${moment(item).format('dddd, MMMM Do')}`}
                accessibilityHint={
                  isFullyUp
                    ? `You are already marked as up for all crews on ${moment(item).format('MMMM Do, YYYY')}.`
                    : `Tap to mark yourself as up for all crews on ${moment(item).format('MMMM Do, YYYY')}.`
                }
              >
                <Icon
                  name="check-circle"
                  size={24}
                  color={isFullyUp ? '#A9A9A9' : '#32CD32'} // Grey if disabled, Green otherwise
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleToggle(item, false)}
                disabled={isNotUp || loading}
                style={[
                  styles.iconButton,
                  (isNotUp || loading) && styles.disabledButton,
                ]}
                accessibilityLabel={`Mark as not up for ${moment(item).format('dddd, MMMM Do')}`}
                accessibilityHint={
                  isNotUp
                    ? `You are already marked as not up for any crews on ${moment(item).format('MMMM Do, YYYY')}.`
                    : `Tap to mark yourself as not up for any crews on ${moment(item).format('MMMM Do, YYYY')}.`
                }
              >
                <Icon
                  name="cancel"
                  size={24}
                  color={isNotUp ? '#A9A9A9' : '#FF6347'} // Grey if disabled, Tomato otherwise
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  // Handle toggle actions with loading state
  const handleToggle = async (date: string, toggleTo: boolean) => {
    setLoading(true);
    await toggleStatusForDate(date, toggleTo);
    setLoading(false);
  };

  // Render loading indicator while performing actions
  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#1E90FF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Profile Section */}
      <View style={styles.profileContainer}>
        <Text style={styles.greeting}>Hi {user?.displayName}!</Text>
      </View>

      {/* Weekly Status List */}
      <FlatList
        data={weekDates}
        renderItem={renderDayItem}
        keyExtractor={(item) => item}
        horizontal={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.weekListContainer}
      />
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F5F5F5', // Solid light background
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  profileContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 20, // Adjust as needed
    color: '#333333', // Dark text for readability
    fontWeight: '700',
  },
  weekListContainer: {
    alignItems: 'center',
  },
  dayContainer: {
    width: width * 0.9, // Slightly wider for better readability
    backgroundColor: '#FFFFFF',
    paddingVertical: 12, // Reduced vertical padding
    paddingHorizontal: 16,
    borderRadius: 10, // Slightly smaller border radius
    marginBottom: 12, // Reduced margin between cards
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  disabledDayContainer: {
    backgroundColor: '#E0E0E0',
  },
  dayHeader: {
    marginBottom: 6, // Reduced margin
  },
  dayText: {
    fontSize: 16, // Adjust as needed
    color: '#333333',
    fontWeight: '600',
  },
  disabledDayText: {
    color: '#A9A9A9',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10, // Smaller dot
    height: 10,
    borderRadius: 5,
    marginRight: 6, // Reduced margin
  },
  statusText: {
    fontSize: 14, // Adjust for compactness
    color: '#333333',
  },
  buttonRow: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;
