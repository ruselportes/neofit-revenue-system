import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { LogbookSaver, OfflineQueue } from '@neofit/core';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { AppConfig } from '../config';
import { MemberRepository, ProfileRepository, UploadRepository } from '../cloud/repositories';
import { AsyncStorageStore, NetInfoConnectivity } from '../platform/adapters';
import { ChunkedSecureStorage } from '../platform/ChunkedStorage';
import { AuthService } from './AuthService';
import { DocumentService } from './DocumentService';
import { NotificationService } from './NotificationService';
import { ScanService } from './ScanService';

export const LAST_SYNC_KEY = 'neofit_last_sync_at';

/** Composition root of the app: builds every service once and wires them together. */
export class Services {
  readonly client: SupabaseClient;
  readonly uploads: UploadRepository;
  readonly profiles: ProfileRepository;
  readonly members: MemberRepository;
  readonly auth: AuthService;
  readonly scan: ScanService;
  readonly queue: OfflineQueue;
  readonly saver: LogbookSaver;
  readonly documents: DocumentService;
  readonly notifications: NotificationService;

  constructor(config: AppConfig, redirectUrl?: string) {
    // The session is kept in Secure Store on the phone; the browser has no such store.
    const storage = Platform.OS === 'web' ? AsyncStorage : new ChunkedSecureStorage(SecureStore);
    this.client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: Platform.OS === 'web' },
    });

    this.uploads = new UploadRepository(this.client);
    this.profiles = new ProfileRepository(this.client);
    this.members = new MemberRepository(this.client);
    this.auth = new AuthService(this.client, this.profiles, this.members, redirectUrl);

    this.scan = new ScanService(config);
    this.queue = new OfflineQueue(new AsyncStorageStore(), this.uploads);
    // Remember when a page last reached the cloud, for the Sync Status line in Settings.
    this.queue.events.on('synced', () => {
      AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString()).catch(() => undefined);
    });
    this.saver = new LogbookSaver(this.uploads, this.queue, new NetInfoConnectivity());
    this.documents = new DocumentService();
    this.notifications = new NotificationService(this.members);
  }
}
