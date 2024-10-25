import * as admin from 'firebase-admin';
import { notifyCrewMembersOnNewJoin } from './notifications/notifyCrewMembersOnNewJoin';
import { notifyCrewOnStatusChange } from './notifications/notifyCrewOnStatusChange';
import { notifyUserOnCrewInvitation } from './notifications/notifyUserOnCrewInvitation';
import { deleteCrew } from './utils/deleteCrew';

export {
  notifyCrewMembersOnNewJoin,
  notifyCrewOnStatusChange,
  notifyUserOnCrewInvitation,
  deleteCrew,
};

// Initialize Firebase Admin SDK
admin.initializeApp();
