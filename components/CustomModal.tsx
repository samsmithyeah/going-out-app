// components/CustomModal.tsx

import React, { ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import CustomButton from './CustomButton';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant: 'primary' | 'secondary' | 'danger' | 'success' | 'secondaryDanger'; // Include all available variants
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
                <CustomButton
                  key={index}
                  title={button.label}
                  onPress={button.onPress}
                  variant={button.variant}
                  disabled={button.disabled || loading}
                  loading={loading}
                  accessibilityLabel={`${button.label} Button`}
                  accessibilityHint={`Press to ${button.label.toLowerCase()}`}
                />
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
    backgroundColor: '#f9f9f9',
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
  },
});
