// context/BadgeCountContext.tsx

import React, { useEffect, createContext, useContext } from 'react';
import { useCrewDateChat } from './CrewDateChatContext';
import { useDirectMessages } from './DirectMessagesContext';
import { useUser } from './UserContext';
import Toast from 'react-native-toast-message';

// Create a context (though it's not providing any value)
const BadgeCountContext = createContext(null);

export const BadgeCountProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { totalUnread: crewTotalUnread } = useCrewDateChat();
  const { totalUnread: dmTotalUnread } = useDirectMessages();
  const { user, setBadgeCount } = useUser();

  useEffect(() => {
    const updateBadgeCount = async () => {
      if (!user?.uid) return;

      const totalUnread = crewTotalUnread + dmTotalUnread;

      try {
        await setBadgeCount(totalUnread);
      } catch (error) {
        console.error('Error updating badge count:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Could not update badge count',
        });
      }
    };

    updateBadgeCount();
  }, [crewTotalUnread, dmTotalUnread, user, setBadgeCount]);

  return (
    <BadgeCountContext.Provider value={null}>
      {children}
    </BadgeCountContext.Provider>
  );
};

export const useBadgeCount = () => {
  const context = useContext(BadgeCountContext);
  if (context === undefined) {
    throw new Error('useBadgeCount must be used within a BadgeCountProvider');
  }
  return context;
};
