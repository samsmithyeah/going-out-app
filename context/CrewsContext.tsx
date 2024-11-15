// context/CrewsContext.tsx

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  Unsubscribe,
  updateDoc,
  setDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import moment from 'moment';
import { db } from '../firebase'; // Adjust the path as necessary
import { useUser } from './UserContext'; // Assuming there's a UserContext
import { Crew } from '../types/Crew';
import { User } from '../types/User';
import Toast from 'react-native-toast-message';

interface CrewsContextProps {
  crewIds: string[];
  crews: Crew[];
  dateCounts: { [key: string]: number };
  dateMatches: { [key: string]: number };
  dateMatchingCrews: { [key: string]: string[] };
  usersCache: { [key: string]: User };
  toggleStatusForCrew: (
    crewId: string,
    date: string,
    toggleTo: boolean,
  ) => Promise<void>;
  toggleStatusForDateAllCrews: (
    date: string,
    toggleTo: boolean,
  ) => Promise<void>;
  setUsersCache: React.Dispatch<React.SetStateAction<{ [key: string]: User }>>;
  loadingCrews: boolean;
  loadingStatuses: boolean;
  loadingMatches: boolean;
}

const CrewsContext = createContext<CrewsContextProps | undefined>(undefined);

export const CrewsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useUser();
  const [crewIds, setCrewIds] = useState<string[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [dateCounts, setDateCounts] = useState<{ [key: string]: number }>({});
  const [dateMatches, setDateMatches] = useState<{ [key: string]: number }>({});
  const [dateMatchingCrews, setDateMatchingCrews] = useState<{
    [key: string]: string[];
  }>({});
  const [usersCache, setUsersCache] = useState<{ [key: string]: User }>({});

  // Loading states
  const [loadingCrews, setLoadingCrews] = useState<boolean>(true);
  const [loadingStatuses, setLoadingStatuses] = useState<boolean>(true);
  const [loadingMatches, setLoadingMatches] = useState<boolean>(true);

  // Generate the next 7 dates starting today
  const weekDates = useMemo((): string[] => {
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      dates.push(moment().add(i, 'days').format('YYYY-MM-DD'));
    }
    return dates;
  }, []);

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

      // Aggregate counts and matching crews
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
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not fetch member statuses',
      });
    } finally {
      setLoadingStatuses(false); // End loading statuses
    }
  };

  // New function to fetch matches
  const fetchMatches = async (fetchedCrewIds: string[]) => {
    const matches: { [key: string]: number } = {};
    const matchingCrews: { [key: string]: string[] } = {}; // Initialize matching crews

    // Initialize matches and matching crews for each date
    weekDates.forEach((date) => {
      matches[date] = 0;
      matchingCrews[date] = [];
    });

    try {
      setLoadingMatches(true);

      // Prepare all userStatuses for all crews and dates
      const allStatusPromises = fetchedCrewIds.flatMap((crewId) =>
        weekDates.map(async (date) => {
          const statusesRef = collection(
            db,
            'crews',
            crewId,
            'statuses',
            date,
            'userStatuses',
          );
          const statusesQuery = query(
            statusesRef,
            where('upForGoingOutTonight', '==', true),
          );
          const statusesSnapshot = await getDocs(statusesQuery);
          return { crewId, date, snapshot: statusesSnapshot };
        }),
      );

      const allStatusResults = await Promise.all(allStatusPromises);

      allStatusResults.forEach(({ crewId, date, snapshot }) => {
        const userStatus = snapshot.docs.find(
          (docSnap) => docSnap.id === user?.uid,
        );
        if (userStatus) {
          const otherMembersUp = snapshot.docs.some(
            (docSnap) => docSnap.id !== user?.uid,
          );
          if (otherMembersUp) {
            matches[date] += 1;
            matchingCrews[date].push(crewId);
          }
        }
      });

      setDateMatches(matches);
      setDateMatchingCrews(matchingCrews);
    } catch (error: any) {
      console.error('Error fetching matches:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not fetch matching crews',
      });
    } finally {
      setLoadingMatches(false);
    }
  };

  // Function to toggle status for a specific crew and date
  const toggleStatusForCrew = async (
    crewId: string,
    selectedDate: string,
    toggleTo: boolean,
  ) => {
    try {
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }
      const userStatusRef = doc(
        db,
        'crews',
        crewId,
        'statuses',
        selectedDate,
        'userStatuses',
        user.uid,
      );
      const statusSnap = await getDoc(userStatusRef);
      if (statusSnap.exists()) {
        const currentStatus = statusSnap.data().upForGoingOutTonight || false;
        await updateDoc(userStatusRef, {
          upForGoingOutTonight: !currentStatus,
          timestamp: Timestamp.fromDate(new Date()),
        });
        console.log(
          `Updated Status for User ${user.uid} on ${selectedDate}: ${!currentStatus}`,
        );
      } else {
        // If no status exists for the selected date, create it with true
        await setDoc(userStatusRef, {
          date: selectedDate,
          upForGoingOutTonight: true,
          timestamp: Timestamp.fromDate(new Date()),
        });
        console.log(
          `Created Status for User ${user.uid} on ${selectedDate}: true`,
        );
      }

      // Update local dateCounts
      setDateCounts((prevCounts) => ({
        ...prevCounts,
        [selectedDate]: toggleTo
          ? prevCounts[selectedDate] + 1
          : prevCounts[selectedDate] - 1,
      }));

      setDateMatchingCrews((prevMatchingCrews) => {
        const updatedMatchingCrews = { ...prevMatchingCrews };
        if (toggleTo) {
          if (!updatedMatchingCrews[selectedDate]) {
            updatedMatchingCrews[selectedDate] = [];
          }
          if (!updatedMatchingCrews[selectedDate].includes(crewId)) {
            updatedMatchingCrews[selectedDate].push(crewId);
          }
        } else {
          if (updatedMatchingCrews[selectedDate]) {
            updatedMatchingCrews[selectedDate] = updatedMatchingCrews[
              selectedDate
            ].filter((id) => id !== crewId);
          }
        }
        return updatedMatchingCrews;
      });

      // After toggling, re-fetch matches
      await fetchMatches(crewIds);
    } catch (error) {
      console.error('Error toggling status:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not update your status',
      });
    }
  };

  // Function to toggle status for a specific date across all crews
  const toggleStatusForDateAllCrews = async (
    date: string,
    toggleTo: boolean,
  ) => {
    if (!user?.uid) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'User not authenticated',
      });
      return;
    }

    try {
      if (crewIds.length === 0) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'You are not part of any crews',
        });
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

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: `You have been marked as ${newStatus ? 'up' : 'not up'} for it on ${moment(
          selectedDateStr,
        ).format('MMMM Do, YYYY')}.`,
      });

      // Update local state
      setDateCounts((prevCounts) => ({
        ...prevCounts,
        [selectedDateStr]: newStatus ? crewIds.length : 0,
      }));

      setDateMatchingCrews((prevMatchingCrews) => ({
        ...prevMatchingCrews,
        [selectedDateStr]: newStatus ? [...crewIds] : [],
      }));

      // After toggling, re-fetch matches
      await fetchMatches(crewIds);
    } catch (error: any) {
      console.error('Error toggling status:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not update your status',
      });
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
            const updatedCrew: Crew = {
              id: docSnap.id,
              ...(docSnap.data() as Omit<Crew, 'id'>),
            };
            setCrews((prevCrews) => {
              const crewIndex = prevCrews.findIndex((c) => c.id === crewId);
              if (crewIndex !== -1) {
                const updatedCrews = [...prevCrews];
                updatedCrews[crewIndex] = updatedCrew;
                return updatedCrews;
              } else {
                return [...prevCrews, updatedCrew];
              }
            });
          } else {
            // If crew is deleted, remove it from state
            setCrews((prevCrews) => prevCrews.filter((c) => c.id !== crewId));
            setCrewIds((prevIds) => prevIds.filter((id) => id !== crewId));
          }
        });

        unsubscribeList.push(unsubscribe);

        // Additionally, set up listeners for matches
        weekDates.forEach((date) => {
          const userStatusesRef = collection(
            db,
            'crews',
            crewId,
            'statuses',
            date,
            'userStatuses',
          );
          const unsubscribeStatus = onSnapshot(userStatusesRef, (snapshot) => {
            // Handle real-time updates for user statuses if needed
            // This can trigger re-fetching matches or updating counts
            // For simplicity, you might choose to re-fetch matches here
            fetchMatches(crewIds);
          });

          unsubscribeList.push(unsubscribeStatus);
        });
      });
    };

    const initialize = async () => {
      if (!user?.uid) {
        setLoadingCrews(false);
        setLoadingStatuses(false);
        setLoadingMatches(false);
        return;
      }

      try {
        // Set up a real-time listener instead of fetching crew IDs manually
        const crewsQuery = query(
          collection(db, 'crews'),
          where('memberIds', 'array-contains', user.uid),
        );

        const unsubscribeCrews = onSnapshot(
          crewsQuery,
          async (querySnapshot) => {
            const fetchedCrewIds: string[] = [];
            const fetchedCrews: Crew[] = [];

            querySnapshot.forEach((docSnap) => {
              fetchedCrewIds.push(docSnap.id);
              fetchedCrews.push({
                id: docSnap.id,
                ...(docSnap.data() as Omit<Crew, 'id'>),
              });
            });

            setCrewIds(fetchedCrewIds);
            setCrews(fetchedCrews);
            setLoadingCrews(false);

            if (fetchedCrewIds.length > 0 && weekDates.length > 0) {
              await fetchUpStatuses(fetchedCrewIds);
              await fetchMatches(fetchedCrewIds);
              setupCrewListeners(fetchedCrewIds);
            } else {
              setCrews([]);
              setDateCounts({});
              setDateMatches({});
              setDateMatchingCrews({});
              setLoadingStatuses(false);
              setLoadingMatches(false);
            }
          },
          (error) => {
            console.error('Error listening to crews:', error);
            Toast.show({
              type: 'error',
              text1: 'Error',
              text2: 'Could not fetch your crews',
            });
            setLoadingCrews(false);
            setLoadingStatuses(false);
            setLoadingMatches(false);
          },
        );

        unsubscribeList.push(unsubscribeCrews);
      } catch (error: any) {
        console.error('Error initializing CrewsContext:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Could not initialize crews',
        });
        setLoadingCrews(false);
        setLoadingStatuses(false);
        setLoadingMatches(false);
      }
    };

    initialize();

    // Cleanup listeners on unmount
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
        dateMatches,
        dateMatchingCrews,
        usersCache,
        toggleStatusForCrew,
        toggleStatusForDateAllCrews,
        setUsersCache,
        loadingCrews,
        loadingStatuses,
        loadingMatches,
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
