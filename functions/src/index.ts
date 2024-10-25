import * as admin from 'firebase-admin';
import { notifyCrewMembersOnNewJoin } from './notifications/notifyCrewMembersOnNewJoin';
import { notifyCrewOnStatusChange } from './notifications/notifyCrewOnStatusChange';
import { notifyUserOnCrewInvitation } from './notifications/notifyUserOnCrewInvitiation';

export {
  notifyCrewMembersOnNewJoin,
  notifyCrewOnStatusChange,
  notifyUserOnCrewInvitation,
};

// Initialize Firebase Admin SDK
admin.initializeApp();
