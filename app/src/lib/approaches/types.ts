export type ApproachStatus = "sent" | "accepted" | "declined";

export type ApproachResponse = Extract<ApproachStatus, "accepted" | "declined">;

export interface ApproachContact {
  email: string | null;
  lineId: string | null;
  lineUrl: string | null;
}

export interface ApproachParticipant {
  id: string;
  name: string;
  region: string;
  bio: string | null;
  interests: string[];
  preferredLocation: string | null;
  diagnosisType: string | null;
}

export interface ApproachableParticipant extends ApproachParticipant {
  sentApproachCount: number;
}

export interface ApproachOpportunityOption {
  id: string;
  title: string;
  alreadyApproached: boolean;
}

export interface ApproachListItem {
  id: string;
  status: ApproachStatus;
  message: string;
  matchScore: number | null;
  createdAt: string;
  respondedAt: string | null;
  participantProfileId?: string;
  participantName?: string;
  opportunityId: string;
  opportunityTitle: string;
  organizationName?: string;
  contact: ApproachContact | null;
}

export interface ApproachDetail extends ApproachListItem {
  participant?: ApproachParticipant;
}

export interface ApproachMutationResult {
  success: boolean;
  approachId?: string;
  error?: string;
}

export interface ApproachSendDataResult {
  participant: ApproachParticipant | null;
  opportunities: ApproachOpportunityOption[];
  error?: string;
}

export interface ApproachableParticipantsResult {
  participants: ApproachableParticipant[];
  error?: string;
}

export interface DashboardApproachesResult {
  approaches: ApproachListItem[];
  error?: string;
}

export interface MyApproachesResult {
  approaches: ApproachListItem[];
  error?: string;
}

export interface MyApproachDetailResult {
  approach: ApproachDetail | null;
  error?: string;
}
