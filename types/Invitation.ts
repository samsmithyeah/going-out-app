// types/Invitation.ts

import { Timestamp } from 'firebase/firestore';
import { Crew } from '@/types/Crew';
import { User } from '@/types/User';

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
