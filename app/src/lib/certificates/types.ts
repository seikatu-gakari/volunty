export type CertificateStatus = "pending" | "issued" | "rejected";

export interface CertificateReference {
  id: string;
  status: CertificateStatus;
}

export interface CertificateListItem {
  id: string;
  applicationId: string;
  status: CertificateStatus;
  certificateNumber: string | null;
  requestedAt: string;
  approvedAt: string | null;
  issuedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  participantName: string;
  organizationName: string;
  opportunityTitle: string;
  completedAt: string;
  activityDateLabel: string;
}

export interface CertificateRequestTarget {
  applicationId: string;
  participantName: string;
  organizationName: string;
  opportunityTitle: string;
  completedAt: string;
  activityDateLabel: string;
  existingCertificate: CertificateReference | null;
}

export interface CertificateMutationResult {
  success: boolean;
  certificateId?: string;
  error?: string;
}

export interface CertificateRequestTargetResult {
  target: CertificateRequestTarget | null;
  error?: string;
}

export interface CertificatesResult {
  certificates: CertificateListItem[];
  error?: string;
}

export interface CertificateDetailResult {
  certificate: CertificateListItem | null;
  error?: string;
}

export interface CertificatePdfData {
  certificateNumber: string;
  participantName: string;
  organizationName: string;
  opportunityTitle: string;
  activityDateLabel: string;
  issuedAtLabel: string;
}

export interface CertificatePdfDataResult {
  certificate: (CertificateListItem & CertificatePdfData) | null;
  error?: string;
}
