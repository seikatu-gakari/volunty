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
  /** 活動スタイルの参考タイプ名（未診断の場合は null。生スコアは開示しない） */
  styleTypeLabel: string | null;
}

export interface ApproachableParticipant extends ApproachParticipant {
  sentApproachCount: number;
}

export interface ApproachOpportunityOption {
  id: string;
  title: string;
  alreadyApproached: boolean;
}

export interface ApproachMessageTemplate {
  id: string;
  name: string;
  body: string;
}

export interface ApproachListItem {
  id: string;
  status: ApproachStatus;
  message: string;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
  isExpired: boolean;
  participantProfileId?: string;
  participantName?: string;
  opportunityId: string;
  opportunityTitle: string;
  organizationName?: string;
  contact: ApproachContact | null;
  hasContact: boolean;
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
  templates: ApproachMessageTemplate[];
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
