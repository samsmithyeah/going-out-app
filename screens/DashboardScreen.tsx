// screens/DashboardScreen.tsx

import React from 'react';
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native';
import { useCrews } from '../context/CrewsContext';
import { useUser } from '../context/UserContext';
import DateCard from '../components/DateCard';
import moment from 'moment';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavParamList } from '../navigation/AppNavigator'; // Adjust the path as necessary
import { useNavigation } from '@react-navigation/native'; // Hook for navigation
import LoadingOverlay from '../components/LoadingOverlay';

const getDotColor = (count: number, total: number): string => {
  if (count === total && total > 0) return '#32CD32'; // Green
  if (count > 0 && count < total) return '#FFA500'; // Orange
  return '#D3D3D3'; // Grey
};

type DashboardScreenNavigationProp = NativeStackNavigationProp<
  NavParamList,
  'Home'
>;

const DashboardScreen: React.FC = () => {
  const { user } = useUser();
  const {
    crewIds,
    dateCounts,
    dateMatches,
    toggleStatusForDateAllCrews,
    loadingCrews,
    loadingStatuses,
    loadingMatches,
  } = useCrews();
  const [isLoadingUsers, setIsLoadingUsers] = React.useState<boolean>(false);

  const navigation = useNavigation<DashboardScreenNavigationProp>();

  // Generate week dates
  const weekDates = React.useMemo(() => {
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      dates.push(moment().add(i, 'days').format('YYYY-MM-DD'));
    }
    return dates;
  }, []);

  // Determine if overall loading is needed
  const isLoading = loadingCrews || loadingStatuses || isLoadingUsers;

  // Handle toggle actions with loading state
  const handleToggle = async (date: string, toggleTo: boolean) => {
    setIsLoadingUsers(true); // Start loading
    try {
      await toggleStatusForDateAllCrews(date, toggleTo);
    } catch (error) {
      console.error('Error toggling status:', error);
      Alert.alert('Error', 'Failed to update status. Please try again.');
    } finally {
      setIsLoadingUsers(false); // End loading
    }
  };

  // Handle pressing the matches chip
  const handlePressMatches = (date: string) => {
    navigation.navigate('MatchesList', { date });
  };

  // Render a single day item using DateCard component
  const renderDayItem = ({ item }: { item: string }) => {
    const count = dateCounts[item] || 0;
    const matches = dateMatches[item] || 0;
    const total = crewIds.length;
    const isDisabled = moment(item).isBefore(moment(), 'day');
    const statusColor = getDotColor(count, total);

    return (
      <DateCard
        date={item}
        count={count}
        matches={matches}
        total={total}
        isDisabled={isDisabled}
        statusColor={statusColor}
        isLoading={loadingMatches} // Pass loadingMatches to DateCard
        onToggle={handleToggle}
        onPressMatches={handlePressMatches} // Pass the handler
      />
    );
  };

  return (
    <>
      {isLoading && <LoadingOverlay />}
      <View style={styles.container}>
        {/* Profile Section */}
        <View style={styles.profileContainer}>
          <Text style={styles.greeting}>Hi {user?.displayName}! 👋</Text>
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
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 16,
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
});

export default DashboardScreen;
