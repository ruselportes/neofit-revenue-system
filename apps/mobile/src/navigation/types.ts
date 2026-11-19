import type { ReviewSession } from '@neofit/core';

export type AuthStackParams = {
  Login: undefined;
  MemberLogin: undefined;
};

export type ScanStackParams = {
  Camera: undefined;
  Review: { imageUri: string; date: string };
  Success: { date: string; count: number; total: number; outcome: 'synced' | 'queued'; savedAt: string };
};

export type OwnerHistoryParams = {
  OwnerHistory: undefined;
  UploadDetail: { uploadId: string; date: string; staffName: string | null; total: number; entries: number; savedAt: string; synced: boolean };
};

export type MemberStackParams = {
  MemberTabs: undefined;
  Receipt: { paymentId: string };
};

export type MemberTabParams = {
  Home: undefined;
  Payments: undefined;
  Rates: undefined;
};

export type { ReviewSession };
