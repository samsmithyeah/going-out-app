// types/Invitation.ts

import { Timestamp } from 'firebase/firestore';
import { Crew } from '../screens/CrewScreen';
import { User } from './User';

export interface Invitation {
  id: string;
  crewId: string;
  fromUserId: string;
  toUserId: string;
  status: string;
  timestamp: Timestamp;
}

export interface InvitationWithDetails extends Invitation {
  crew?: Crew;
  inviter?: User;
}
