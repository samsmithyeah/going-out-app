// components/CustomModal.tsx

import React, { ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from 'react-native';

type ButtonProps = {
  label: string;
  onPress: () => void;
  style?: object;
  disabled?: boolean;
};

type CustomModalProps = {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  buttons: ButtonProps[];
  loading?: boolean;
};

const CustomModal: React.FC<CustomModalProps> = ({
  isVisible,
  onClose,
  title,
  children,
  buttons,
  loading = false,
}) => {
  return (
    <Modal visible={isVisible} animationType="fade" transparent>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Title */}
            <Text style={styles.modalTitle}>{title}</Text>
            {/* Content */}
            {children}
            {/* Buttons */}
            <View style={styles.buttonContainer}>
              {buttons.map((button, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.button, button.style]}
                  onPress={button.onPress}
                  disabled={button.disabled || loading}
                  accessibilityLabel={`${button.label} Button`}
                  accessibilityHint={`Press to ${button.label.toLowerCase()}`}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>{button.label}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default CustomModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', // Semi-transparent background
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 25,
    alignItems: 'center',
    width: '85%',
    shadowColor: '#000',
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    marginBottom: 15,
    textAlign: 'center',
    fontWeight: '600',
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 15,
  },
  button: {
    backgroundColor: '#1e90ff',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});
