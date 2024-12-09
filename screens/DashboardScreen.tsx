import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useCrews } from '@/context/CrewsContext';
import DateCard from '@/components/DateCard';
import moment from 'moment';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavParamList } from '@/navigation/AppNavigator';
import { useNavigation } from '@react-navigation/native';
import LoadingOverlay from '@/components/LoadingOverlay';
import Toast from 'react-native-toast-message';
import ScreenTitle from '@/components/ScreenTitle';
import CreateCrewModal from '@/components/CreateCrewModal';
import Icon from 'react-native-vector-icons/MaterialIcons';
import globalStyles from '@/styles/globalStyles';

const getDotColor = (count: number, total: number): string => {
  if (count === total && total > 0) return '#32CD32';
  if (count > 0 && count < total) return '#FFA500';
  return '#D3D3D3';
};

type DashboardScreenNavigationProp = NativeStackNavigationProp<
  NavParamList,
  'Home'
>;

const DashboardScreen: React.FC = () => {
  const {
    crewIds,
    dateCounts,
    dateMatches,
    toggleStatusForDateAllCrews,
    loadingCrews,
    loadingStatuses,
    loadingMatches,
  } = useCrews();

  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [isCreateModalVisible, setIsCreateModalVisible] =
    useState<boolean>(false);
  const [today, setToday] = useState<string>(moment().format('YYYY-MM-DD'));

  const navigation = useNavigation<DashboardScreenNavigationProp>();

  // Update "today" at midnight
  useEffect(() => {
    const now = moment();
    const midnight = moment().endOf('day').add(1, 'millisecond');
    const timeoutMs = midnight.diff(now);

    const timeoutId = setTimeout(() => {
      setToday(moment().format('YYYY-MM-DD'));
    }, timeoutMs);

    return () => clearTimeout(timeoutId);
  }, [today]);

  const weekDates = useMemo(() => {
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      dates.push(moment(today).add(i, 'days').format('YYYY-MM-DD'));
    }
    return dates;
  }, [today]);

  const isLoading = loadingCrews || loadingStatuses || isLoadingUsers;

  const handleToggle = async (date: string, toggleTo: boolean) => {
    setIsLoadingUsers(true);
    try {
      await toggleStatusForDateAllCrews(date, toggleTo);
    } catch (error) {
      console.error('Error toggling status:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update status',
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handlePressMatches = (date: string) => {
    navigation.navigate('MatchesList', { date });
  };

  const openCreateCrewModal = () => {
    setIsCreateModalVisible(true);
  };

  const closeCreateCrewModal = () => {
    setIsCreateModalVisible(false);
  };

  const handleCrewCreated = (crewId: string) => {
    closeCreateCrewModal();
    Toast.show({
      type: 'success',
      text1: 'Success',
      text2: 'Crew created successfully',
    });
    navigation.navigate('CrewsStack', {
      screen: 'AddMembers',
      params: { crewId },
      initial: false,
    });
  };

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
        isLoading={loadingMatches}
        onToggle={handleToggle}
        onPressMatches={handlePressMatches}
      />
    );
  };

  return (
    <>
      {isLoading && <LoadingOverlay />}
      <View style={globalStyles.container}>
        <ScreenTitle title="Your week" />
        {crewIds.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="group-add" size={64} color="#888" />
            <Text style={styles.emptyText}>You are not in any crews yet</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={openCreateCrewModal}
            >
              <Text style={styles.createButtonText}>Create one</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={weekDates}
            renderItem={renderDayItem}
            keyExtractor={(item) => item}
            horizontal={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.weekListContainer}
          />
        )}
      </View>
      <CreateCrewModal
        isVisible={isCreateModalVisible}
        onClose={closeCreateCrewModal}
        onCrewCreated={handleCrewCreated}
      />
    </>
  );
};

const styles = StyleSheet.create({
  weekListContainer: {},
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#555',
    marginTop: 16,
    textAlign: 'center',
  },
  createButton: {
    marginTop: 12,
    paddingHorizontal: 20,
  },
  createButtonText: {
    color: '#1e90ff',
    fontSize: 20,
  },
});

export default DashboardScreen;
