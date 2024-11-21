// components/DateCard.tsx

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import moment from 'moment';
import { Ionicons } from '@expo/vector-icons';

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
  const [isModalVisible, setModalVisible] = useState(false);

  const statusText = `You're up for seeing ${count} of ${total} crew${total !== 1 ? 's' : ''}`;
  const isFullyUp = count === total;
  const isNotUp = count === 0;

  const handleToggle = (toggleTo: boolean) => {
    Alert.alert(
      'Confirm update',
      `Are you sure you want to mark yourself ${
        toggleTo ? 'available' : 'unavailable'
      } across all your crews on ${moment(date).format('MMMM Do, YYYY')}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'OK',
          onPress: () => {
            onToggle(date, toggleTo);
            setModalVisible(false); // Close the modal after action
          },
        },
      ],
      { cancelable: false },
    );
  };

  const getFormattedDate = (date: string) => {
    if (date === moment().format('YYYY-MM-DD')) {
      return 'Today';
    } else if (date === moment().add(1, 'days').format('YYYY-MM-DD')) {
      return 'Tomorrow';
    } else {
      return moment(date).format('dddd, MMMM Do');
    }
  };

  return (
    <View
      style={[styles.dayContainer, isDisabled && styles.disabledDayContainer]}
    >
      <View style={styles.dayHeader}>
        <Text style={[styles.dayText, isDisabled && styles.disabledDayText]}>
          {getFormattedDate(date)}
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
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            style={styles.iconButton}
            accessibilityLabel={`Options for ${moment(date).format(
              'dddd, MMMM Do',
            )}`}
            accessibilityHint="Tap to open options for marking availability"
          >
            <Ionicons name="create-outline" size={24} color="#333333" />
          </TouchableOpacity>
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

      {/* Modal for Context Menu */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContainer}>
                {/* Close Icon */}
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.closeButton}
                  accessibilityLabel="Close options"
                  accessibilityHint="Closes the options menu"
                >
                  <Icon name="close" size={24} color="#D3D3D3" />
                </TouchableOpacity>

                {/* Modal Title */}
                <Text style={styles.modalTitle}>{getFormattedDate(date)}</Text>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Option: Mark as Available */}
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => handleToggle(true)}
                  disabled={isFullyUp || isLoading}
                  accessibilityLabel={`Mark as available for ${moment(date).format('dddd, MMMM Do')}`}
                  accessibilityHint={
                    isFullyUp
                      ? `You are already marked as available for all crews on ${moment(date).format('MMMM Do, YYYY')}.`
                      : `Tap to mark yourself as available for all crews on ${moment(date).format('MMMM Do, YYYY')}.`
                  }
                >
                  <Icon
                    name="check-circle"
                    size={24}
                    color={isFullyUp ? '#A9A9A9' : '#32CD32'}
                    style={styles.modalIcon}
                  />
                  <Text
                    style={[
                      styles.modalText,
                      (isFullyUp || isLoading) && styles.disabledText,
                    ]}
                  >
                    Mark as available for all crews
                  </Text>
                </TouchableOpacity>

                {/* Option: Mark as Unavailable */}
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => handleToggle(false)}
                  disabled={isNotUp || isLoading}
                  accessibilityLabel={`Mark as unavailable for ${moment(date).format('dddd, MMMM Do')}`}
                  accessibilityHint={
                    isNotUp
                      ? `You are already marked as unavailable for any crews on ${moment(date).format('MMMM Do, YYYY')}.`
                      : `Tap to mark yourself as unavailable for any crews on ${moment(date).format('MMMM Do, YYYY')}.`
                  }
                >
                  <Icon
                    name="cancel"
                    size={24}
                    color={isNotUp ? '#A9A9A9' : '#FF6347'}
                    style={styles.modalIcon}
                  />
                  <Text
                    style={[
                      styles.modalText,
                      (isNotUp || isLoading) && styles.disabledText,
                    ]}
                  >
                    Mark as unavailable for all crews
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  dayContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 12,
    borderColor: '#E0E0E0',
    borderWidth: 1,
  },
  disabledDayContainer: {
    backgroundColor: '#E0E0E0',
  },
  dayHeader: {},
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
  iconButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    elevation: 5,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
    color: '#333333',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginBottom: 12,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  modalIcon: {
    marginRight: 12,
  },
  modalText: {
    fontSize: 16,
    color: '#333333',
  },
  disabledText: {
    color: '#A9A9A9',
  },
});

export default DateCard;
