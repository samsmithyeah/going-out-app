// screens/CrewDateChatsListScreen.tsx

import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useCrewDateChat } from '../context/CrewDateChatContext';
import { useCrews } from '../context/CrewsContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavParamList } from '../navigation/AppNavigator';
import ScreenTitle from '../components/ScreenTitle';
import LoadingOverlay from '../components/LoadingOverlay';
import moment from 'moment';

type CrewDateChatsListScreenProps = NativeStackScreenProps<
  NavParamList,
  'CrewDateChatsList'
>;

const CrewDateChatsListScreen: React.FC<CrewDateChatsListScreenProps> = ({
  navigation,
}) => {
  const { chats, listenToChats } = useCrewDateChat();
  const { crews } = useCrews();
  const [loading, setLoading] = React.useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = listenToChats();
    setLoading(false);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const getCrewName = (crewId: string) => {
    const crew = crews.find((c) => c.id === crewId);
    return crew ? crew.name : 'Unknown Crew';
  };

  const renderItem = ({ item }: { item: any }) => {
    const [crewId, date] = item.id.split('_');
    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() =>
          navigation.navigate('CrewsStack', {
            screen: 'CrewDateChat',
            params: { crewId, date },
            initial: false,
          })
        }
      >
        <Text style={styles.crewName}>{getCrewName(crewId)}</Text>
        <Text style={styles.chatDate}>
          {moment(date).format('MMMM Do, YYYY')}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <View style={styles.container}>
      <ScreenTitle title="Crew Date Chats" />
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text>No crew date chats available.</Text>}
      />
    </View>
  );
};

export default CrewDateChatsListScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  chatItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  crewName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  chatDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});
