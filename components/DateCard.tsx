// components/DateCard.tsx

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import moment from 'moment';
import { Dimensions } from 'react-native';

interface DateCardProps {
  date: string;
  count: number;
  matches: number;
  total: number;
  isDisabled: boolean;
  statusColor: string;
  isLoading: boolean;
  onToggle: (date: string, toggleTo: boolean) => void;
  onPressMatches: (date: string) => void; // New Prop
}

const DateCard: React.FC<DateCardProps> = ({
  date,
  count,
  matches,
  total,
  isDisabled,
  statusColor,
  isLoading,
  onToggle,
  onPressMatches, // Destructure the new prop
}) => {
  const statusText = `Up for seeing ${count} of ${total} crew${total !== 1 ? 's' : ''}`;
  const isFullyUp = count === total;
  const isNotUp = count === 0;

  const handleToggle = (toggleTo: boolean) => {
    Alert.alert(
      'Confirm update',
      `Are you sure you want to mark yourself ${toggleTo ? 'available' : 'unavailable'} across all your crews on ${moment(date).format('MMMM Do, YYYY')}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'OK',
          onPress: () => onToggle(date, toggleTo),
        },
      ],
      { cancelable: false },
    );
  };

  return (
    <View
      style={[styles.dayContainer, isDisabled && styles.disabledDayContainer]}
    >
      <View style={styles.dayHeader}>
        <Text style={[styles.dayText, isDisabled && styles.disabledDayText]}>
          {moment(date).format('dddd, MMMM Do')}
        </Text>
      </View>
      <View style={styles.statusRow}>
        <View style={styles.statusInfo}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text
            style={[styles.statusText, isDisabled && styles.disabledDayText]}
          >
            {statusText}
          </Text>
        </View>
        {!isDisabled && (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={() => handleToggle(true)}
              disabled={isFullyUp || isLoading}
              style={[
                styles.iconButton,
                (isFullyUp || isLoading) && styles.disabledButton,
              ]}
              accessibilityLabel={`Mark as up for ${moment(date).format(
                'dddd, MMMM Do',
              )}`}
              accessibilityHint={
                isFullyUp
                  ? `You are already marked as up for all crews on ${moment(
                      date,
                    ).format('MMMM Do, YYYY')}.`
                  : `Tap to mark yourself as up for all crews on ${moment(
                      date,
                    ).format('MMMM Do, YYYY')}.`
              }
            >
              <Icon
                name="check-circle"
                size={24}
                color={isFullyUp ? '#A9A9A9' : '#32CD32'} // Grey if disabled, Green otherwise
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleToggle(false)}
              disabled={isNotUp || isLoading}
              style={[
                styles.iconButton,
                (isNotUp || isLoading) && styles.disabledButton,
              ]}
              accessibilityLabel={`Mark as not up for ${moment(date).format(
                'dddd, MMMM Do',
              )}`}
              accessibilityHint={
                isNotUp
                  ? `You are already marked as not up for any crews on ${moment(
                      date,
                    ).format('MMMM Do, YYYY')}.`
                  : `Tap to mark yourself as not up for any crews on ${moment(
                      date,
                    ).format('MMMM Do, YYYY')}.`
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
      {/* Display Matches */}
      {matches > 0 && (
        <TouchableOpacity
          style={styles.matchesContainer}
          onPress={() => onPressMatches(date)} // Handle press
          accessibilityLabel={`${matches} matches`}
          accessibilityHint={`Tap to view your matching crews on ${moment(date).format('MMMM Do, YYYY')}`}
        >
          <Text style={styles.matchesText}>
            {matches === 1 ? '🎉 1 match' : `🎉 ${matches} matches`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  dayContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 12,
    borderColor: '#E0E0E0',
    borderWidth: 1,
    width: width * 0.9,
  },
  disabledDayContainer: {
    backgroundColor: '#E0E0E0',
  },
  dayHeader: {
    marginBottom: 6,
  },
  dayText: {
    fontSize: 16,
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
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    color: '#333333',
  },
  matchesContainer: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#1E90FF',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  matchesText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
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
});

export default DateCard;
