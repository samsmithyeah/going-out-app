// context/CrewsContext.tsx

import React, {
  createContext,
  useState,
  useEffect,
  ReactNode,
  useContext,
  useMemo,
} from 'react';
import { Alert } from 'react-native';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  Timestamp,
  writeBatch,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase'; // Ensure this points to your Firebase initialization
import { useUser } from './UserContext'; // Custom hook to access user data
import moment from 'moment';
import { Crew } from '../types/Crew';
import { User } from '../types/User';

interface CrewsContextProps {
  crewIds: string[];
  crews: Crew[];
  dateCounts: { [key: string]: number };
  usersCache: { [key: string]: User };
  toggleStatusForDate: (date: string, toggleTo: boolean) => Promise<void>;
  setUsersCache: React.Dispatch<React.SetStateAction<{ [key: string]: User }>>;
  loadingCrews: boolean; // New loading state
  loadingStatuses: boolean; // New loading state
}

const CrewsContext = createContext<CrewsContextProps | undefined>(undefined);

export const CrewsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useUser(); // Assumes you have a UserContext that provides user data
  const [crewIds, setCrewIds] = useState<string[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [dateCounts, setDateCounts] = useState<{ [key: string]: number }>({});
  const [usersCache, setUsersCache] = useState<{ [key: string]: User }>({}); // Moved to context

  // Loading states
  const [loadingCrews, setLoadingCrews] = useState<boolean>(true);
  const [loadingStatuses, setLoadingStatuses] = useState<boolean>(true);

  // Generate the next 7 dates starting today
  const weekDates = useMemo((): string[] => {
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      dates.push(moment().add(i, 'days').format('YYYY-MM-DD'));
    }
    return dates;
  }, []);

  // Helper function to fetch user's crews
  const fetchUserCrews = async (uid: string): Promise<string[]> => {
    const crewsRef = collection(db, 'crews');
    const userCrewsQuery = query(
      crewsRef,
      where('memberIds', 'array-contains', uid),
    );
    const crewsSnapshot = await getDocs(userCrewsQuery);
    return crewsSnapshot.docs.map((doc) => doc.id);
  };

  // Helper function to fetch crew details
  const fetchCrewDetails = async (
    fetchedCrewIds: string[],
  ): Promise<Crew[]> => {
    const crewsData: Crew[] = [];
    const crewPromises = fetchedCrewIds.map(async (crewId) => {
      const crewDoc = await getDoc(doc(db, 'crews', crewId));
      if (crewDoc.exists()) {
        return {
          id: crewDoc.id,
          ...(crewDoc.data() as Omit<Crew, 'id'>),
        } as Crew;
      } else {
        // Handle case where crew document doesn't exist
        return null;
      }
    });

    const crewsResults = await Promise.all(crewPromises);
    crewsResults.forEach((crew) => {
      if (crew) {
        crewsData.push(crew);
      }
    });

    return crewsData;
  };

  // Helper function to fetch up statuses
  const fetchUpStatuses = async (fetchedCrewIds: string[]) => {
    const counts: { [key: string]: number } = {};

    // Initialize counts for each date
    weekDates.forEach((date) => {
      counts[date] = 0;
    });

    // Prepare all status document references
    const statusDocRefs = fetchedCrewIds.flatMap((crewId) =>
      weekDates.map((date) =>
        doc(db, 'crews', crewId, 'statuses', date, 'userStatuses', user!.uid),
      ),
    );

    try {
      setLoadingStatuses(true); // Start loading statuses
      // Fetch all status documents concurrently
      const statusSnapshots = await Promise.all(
        statusDocRefs.map((ref) => getDoc(ref)),
      );

      // Aggregate counts
      statusSnapshots.forEach((statusSnap) => {
        if (statusSnap.exists()) {
          const statusData = statusSnap.data();
          if (
            typeof statusData.upForGoingOutTonight === 'boolean' &&
            statusData.upForGoingOutTonight
          ) {
            const date = statusSnap.ref.parent.parent?.id;
            if (date && counts[date] !== undefined) {
              counts[date] += 1;
            }
          }
        }
      });

      setDateCounts(counts);
    } catch (error: any) {
      console.error('Error fetching up statuses:', error);
      Alert.alert('Error', 'There was an issue fetching your up statuses.');
    } finally {
      setLoadingStatuses(false); // End loading statuses
    }
  };

  // Function to toggle status for a specific date across all crews
  const toggleStatusForDate = async (date: string, toggleTo: boolean) => {
    if (!user?.uid) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      if (crewIds.length === 0) {
        Alert.alert('Info', 'You are not part of any crews.');
        return;
      }

      const selectedDateStr = date;
      const newStatus = toggleTo;

      // Split crewIds into batches of MAX_BATCH_SIZE (10)
      const MAX_BATCH_SIZE = 10;
      const batches: string[][] = [];
      for (let i = 0; i < crewIds.length; i += MAX_BATCH_SIZE) {
        batches.push(crewIds.slice(i, i + MAX_BATCH_SIZE));
      }

      // Perform each batch sequentially
      for (const batchCrewIds of batches) {
        const batch = writeBatch(db);

        batchCrewIds.forEach((crewId) => {
          const userStatusRef = doc(
            db,
            'crews',
            crewId,
            'statuses',
            selectedDateStr,
            'userStatuses',
            user.uid,
          );

          batch.set(
            userStatusRef,
            {
              upForGoingOutTonight: newStatus,
              timestamp: Timestamp.fromDate(new Date()),
            },
            { merge: true },
          );
        });

        await batch.commit();
      }

      Alert.alert(
        'Success',
        `You have been marked as ${newStatus ? 'up' : 'not up'} for it on ${moment(
          selectedDateStr,
        ).format('MMMM Do, YYYY')}.`,
      );

      // Update local state
      setDateCounts((prevCounts) => ({
        ...prevCounts,
        [selectedDateStr]: newStatus ? crewIds.length : 0,
      }));
    } catch (error: any) {
      console.error('Error toggling status:', error);
      Alert.alert('Error', 'There was an issue updating your status.');
    }
  };

  // Setup real-time listeners for crews
  useEffect(() => {
    let unsubscribeList: Unsubscribe[] = [];

    const setupCrewListeners = (fetchedCrewIds: string[]) => {
      fetchedCrewIds.forEach((crewId) => {
        const crewRef = doc(db, 'crews', crewId);
        const unsubscribe = onSnapshot(crewRef, (docSnap) => {
          if (docSnap.exists()) {
            const updatedCrew = {
              id: docSnap.id,
              ...(docSnap.data() as Omit<Crew, 'id'>),
            } as Crew;
            setCrews((prevCrews) => {
              const crewIndex = prevCrews.findIndex(
                (c) => c.id === updatedCrew.id,
              );
              if (crewIndex !== -1) {
                // Update existing crew
                const updatedCrews = [...prevCrews];
                updatedCrews[crewIndex] = updatedCrew;
                return updatedCrews;
              } else {
                // Add new crew
                return [...prevCrews, updatedCrew];
              }
            });
          } else {
            // Crew deleted
            setCrews((prevCrews) => prevCrews.filter((c) => c.id !== crewId));
            setCrewIds((prevCrewIds) =>
              prevCrewIds.filter((id) => id !== crewId),
            );
          }
        });

        unsubscribeList.push(unsubscribe);
      });
    };

    const initialize = async () => {
      if (!user?.uid) {
        setLoadingCrews(false);
        setLoadingStatuses(false);
        return;
      }

      try {
        const fetchedCrewIds = await fetchUserCrews(user.uid);
        setCrewIds(fetchedCrewIds);
        setLoadingCrews(false);

        if (fetchedCrewIds.length > 0 && weekDates.length > 0) {
          const fetchedCrews = await fetchCrewDetails(fetchedCrewIds);
          setCrews(fetchedCrews);
          await fetchUpStatuses(fetchedCrewIds);
          setupCrewListeners(fetchedCrewIds);
        } else {
          setCrews([]);
          setDateCounts({});
          setLoadingStatuses(false);
        }
      } catch (error: any) {
        console.error('Error initializing CrewsContext:', error);
        Alert.alert('Error', 'There was an issue initializing your crews.');
        setLoadingCrews(false);
        setLoadingStatuses(false);
      }
    };

    initialize();

    // Cleanup listeners on unmount or when crewIds change
    return () => {
      unsubscribeList.forEach((unsubscribe) => unsubscribe());
    };
  }, [user?.uid, weekDates]);

  return (
    <CrewsContext.Provider
      value={{
        crewIds,
        crews,
        dateCounts,
        usersCache,
        toggleStatusForDate,
        setUsersCache,
        loadingCrews,
        loadingStatuses,
      }}
    >
      {children}
    </CrewsContext.Provider>
  );
};

// Custom hook to use the CrewsContext
export const useCrews = () => {
  const context = useContext(CrewsContext);
  if (!context) {
    throw new Error('useCrews must be used within a CrewsProvider');
  }
  return context;
};
