import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { LogbookSaver, OfflineQueue } from '@neofit/core';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AppState, Platform } from 'react-native';
import type { AppConfig } from '../config';
import { MemberRepository, ProfileRepository, UploadRepository } from '../cloud/repositories';
import { AsyncStorageStore, NetInfoConnectivity } from '../platform/adapters';
import { ChunkedSecureStorage } from '../platform/ChunkedStorage';
import { AuthService } from './AuthService';
import { DocumentService } from './DocumentService';
import { NotificationService } from './NotificationService';
import { ScanService } from './ScanService';

export const LAST_SYNC_KEY = 'neofit_last_sync_at';

/**
 * A page saved while online goes straight to the cloud and never passes the offline queue, which is the only place that
 * used to record "last synced". This records it for the direct save too.
 */
class TimestampingSaver extends LogbookSaver {
  override async save(upload: Parameters<LogbookSaver['save']>[0]): ReturnType<LogbookSaver['save']> {
    const outcome = await super.save(upload);
    if (outcome === 'synced') AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString()).catch(() => undefined);
    return outcome;
  }
}

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
    // The same store also remembers who was last signed in, so a launch without signal does not look like a sign-out.
    this.auth = new AuthService(this.client, this.profiles, this.members, redirectUrl, storage);
    this.keepSignedIn();

    this.scan = new ScanService(config);
    this.queue = new OfflineQueue(new AsyncStorageStore(), this.uploads);
    // Remember when a page last reached the cloud, for the Sync Status line in Settings.
    this.queue.events.on('synced', () => {
      AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString()).catch(() => undefined);
    });
    this.saver = new TimestampingSaver(this.uploads, this.queue, new NetInfoConnectivity());
    this.documents = new DocumentService();
    this.notifications = new NotificationService(this.members);
  }

  /**
   * Keeps the sign-in alive on the phone: the Supabase client renews the login only while the app is in front (as its
   * React Native guide says), and the sign-in is checked again when the app returns and when the connection comes back.
   */
  private keepSignedIn(): void {
    if (Platform.OS === 'web') return;
    AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        this.client.auth.startAutoRefresh().catch(() => undefined);
        this.auth.revalidate().catch(() => undefined);
      } else {
        this.client.auth.stopAutoRefresh().catch(() => undefined);
      }
    });
    NetInfo.addEventListener((net) => {
      if (net.isConnected === true && this.auth.isOffline()) this.auth.revalidate().catch(() => undefined);
    });
  }
}
