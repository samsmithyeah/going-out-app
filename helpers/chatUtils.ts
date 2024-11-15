export const generateChatId = (crewId: string, date: string): string => {
  return `${crewId}_${date}`; // e.g., 'crew123_2024-04-27'
};

export const generateDMConversationId = (
  userId1: string,
  userId2: string,
): string => {
  return userId1 < userId2 ? `${userId1}_${userId2}` : `${userId2}_${userId1}`;
};
