// components/CustomButton.tsx

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  GestureResponderEvent,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons'; // Change based on your preferred icon library
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import FontAwesome from 'react-native-vector-icons/FontAwesome'; // If needed

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  library?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome' | 'Entypo'; // Extend as needed
}

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'success'
  | 'disabled'
  | 'secondaryDanger';

interface CustomButtonProps {
  title: string;
  onPress: (event: GestureResponderEvent) => void;
  loading?: boolean;
  icon?: IconProps; // Optional icon
  variant?: ButtonVariant; // Variant prop
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const CustomButton: React.FC<CustomButtonProps> = ({
  title,
  onPress,
  loading = false,
  icon,
  variant = 'primary', // Default variant
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}) => {
  // Determine if the button should be disabled
  const isDisabled = disabled || variant === 'disabled';

  // Function to render the icon based on the library
  const renderIcon = () => {
    if (!icon) return null;

    const { name, size = 20, color, library = 'Ionicons' } = icon;

    switch (library) {
      case 'MaterialIcons':
        return (
          <MaterialIcons
            name={name}
            size={size}
            color={color || getColor()}
            style={styles.icon}
          />
        );
      case 'FontAwesome':
        return (
          <FontAwesome
            name={name}
            size={size}
            color={color || getColor()}
            style={styles.icon}
          />
        );
      case 'Ionicons':
      default:
        return (
          <Ionicons
            name={name}
            size={size}
            color={color || getColor()}
            style={styles.icon}
          />
        );
    }
  };

  // Helper function to determine color based on variant
  const getColor = () => {
    if (variant === 'secondary') {
      return '#1E90FF'; // DodgerBlue
    } else if (variant === 'disabled') {
      return '#D3D3D3'; // LightGray for better contrast
    } else if (variant === 'secondaryDanger') {
      return '#DC3545'; // Red
    } else {
      return '#FFFFFF'; // Default to White
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[variant], // Apply variant styles
        isDisabled ? styles.buttonDisabled : {},
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={isDisabled || loading}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === 'secondary' || 'secondaryDanger' ? '#0056b3' : '#FFFFFF'
          }
        />
      ) : (
        <View style={styles.content}>
          {renderIcon()}
          <Text style={[styles.text, { color: getColor() }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // Additional common styles can be added here
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 10, // Space between icon and text
  },
  text: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Variant Styles
  primary: {
    backgroundColor: '#1E90FF', // DodgerBlue
  },
  secondary: {
    backgroundColor: '#FFFFFF', // White
    borderWidth: 1,
    borderColor: '#1E90FF', // DodgerBlue
  },
  danger: {
    backgroundColor: '#DC3545', // Red
  },
  secondaryDanger: {
    backgroundColor: '#FFFFFF', // White
    borderWidth: 1,
    borderColor: '#DC3545', // Red
  },
  success: {
    backgroundColor: '#28A745', // Green
  },
  disabled: {
    backgroundColor: '#A9A9A9', // DarkGray
  },
  // Disabled State
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default CustomButton;
