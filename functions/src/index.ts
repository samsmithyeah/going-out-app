import * as admin from 'firebase-admin';
import { notifyCrewMembersOnCrewDeletion } from './notifications/notifyCrewMembersOnCrewDeletion';
import { notifyCrewMembersOnNewJoin } from './notifications/notifyCrewMembersOnNewJoin';
import { notifyCrewOnStatusChange } from './notifications/notifyCrewOnStatusChange';
import { notifyUserOnCrewInvitation } from './notifications/notifyUserOnCrewInvitation';
import { notifyCrewMembersOnMemberLeave } from './notifications/notifyCrewMembersOnMemberLeave';
import { notifyCrewOnThreeUp } from './notifications/notifyCrewOnThreeUp';
import { deleteCrew } from './utils/deleteCrew';
import { notifyUserOnNewDMMessage } from './notifications/notifyUserOnNewDMMessage';
import { notifyUsersOnNewGroupMessage } from './notifications/notifyUsersOnNewGroupMessage';
import { pokeCrew } from './notifications/pokeCrew';

export {
  notifyCrewMembersOnCrewDeletion,
  notifyCrewMembersOnNewJoin,
  notifyCrewMembersOnMemberLeave,
  notifyCrewOnStatusChange,
  notifyUserOnCrewInvitation,
  notifyCrewOnThreeUp,
  deleteCrew,
  notifyUserOnNewDMMessage,
  notifyUsersOnNewGroupMessage,
  pokeCrew,
};

// Initialize Firebase Admin SDK
admin.initializeApp();
