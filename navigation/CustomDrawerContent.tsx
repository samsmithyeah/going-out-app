// navigation/CustomDrawerContent.tsx

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  DrawerContentScrollView,
  DrawerItemList,
  DrawerItem,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import { auth } from '../firebase'; // Import Firebase auth
import { useUser } from '../context/UserContext'; // Assuming you have UserContext

const CustomDrawerContent: React.FC<DrawerContentComponentProps> = (props) => {
  const { logout } = useUser(); // Destructure logout from UserContext
  const { navigation, state } = props;

  // Handler for Logout button
  const handleLogout = async () => {
    try {
      await logout(); // Call the logout function from UserContext
      // Reset the navigation stack to 'Login' to prevent back navigation
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' }], // Ensure 'Login' is defined in your RootStackParamList
        })
      );
    } catch (error) {
      console.error('Error logging out: ', error);
      // Optionally, show an alert to the user
    }
  };

  // Handler for CrewsStack press to reset navigation to CrewsListScreen
  const handleCrewsPress = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'CrewsStack' }],
      })
    );
  };

  return (
    <DrawerContentScrollView {...props}>
      {/* Iterate through each route and render DrawerItem with custom onPress for 'CrewsStack' */}
      {state.routes.map((route, index) => {
        const { name, key } = route;
        // Skip rendering FriendsList if it's not defined in DrawerNavigator
        if (name === 'FriendsList') {
          return null; // or render if needed
        }

        // Custom handling for 'CrewsStack'
        if (name === 'CrewsStack') {
          return (
            <DrawerItem
              key={key}
              label="Crews"
              icon={({ color, size }) => (
                <Ionicons name="people-outline" size={size} color={color} />
              )}
              onPress={handleCrewsPress}
            />
          );
        }

        // Render other DrawerItems normally
        return (
          <DrawerItem
            key={key}
            label={props.descriptors[key].options.title || name}
            icon={({ color, size }) => {
              const { drawerIcon } = props.descriptors[key].options;
              if (drawerIcon) {
                return drawerIcon({ color, size, focused: false });
              }
              return null;
            }}
            onPress={() => navigation.navigate(name as string)}
          />
        );
      })}

      {/* Logout Button */}
      <View style={styles.logoutContainer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="exit-outline" size={24} color="white" />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
};

export default CustomDrawerContent;

const styles = StyleSheet.create({
  logoutContainer: {
    marginTop: 20,
    paddingHorizontal: 10,
    paddingBottom: 20, // add padding to the bottom
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#ff3b30',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  logoutText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 10,
  },
});
