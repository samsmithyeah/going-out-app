// screens/HomeScreen.tsx

import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useCrews } from '../context/CrewsContext';
import { useUser } from '../context/UserContext';
import SpinLoader from '../components/SpinLoader';
import DateCard from '../components/DateCard';
import moment from 'moment';

const getDotColor = (count: number, total: number): string => {
  if (count === total && total > 0) return '#32CD32'; // Green
  if (count > 0 && count < total) return '#FFA500'; // Orange
  return '#D3D3D3'; // Grey
};

const HomeScreen: React.FC = () => {
  const { user } = useUser();
  const {
    crewIds,
    dateCounts,
    toggleStatusForDateAllCrews,
    loadingCrews,
    loadingStatuses,
  } = useCrews();
  const [isLoadingUsers, setIsLoadingUsers] = React.useState<boolean>(false);

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
    await toggleStatusForDateAllCrews(date, toggleTo);
    setIsLoadingUsers(false); // End loading
  };

  // Render a single day item using DateCard component
  const renderDayItem = ({ item }: { item: string }) => {
    const count = dateCounts[item] || 0;
    const total = crewIds.length;
    const isDisabled = moment(item).isBefore(moment(), 'day');
    const statusColor = getDotColor(count, total);

    return (
      <DateCard
        date={item}
        count={count}
        total={total}
        isDisabled={isDisabled}
        statusColor={statusColor}
        isLoading={isLoading}
        onToggle={handleToggle}
      />
    );
  };

  // Render loading indicator while fetching data
  if (isLoading) {
    return <SpinLoader />;
  }

  return (
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
  );
};

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
});

export default HomeScreen;
