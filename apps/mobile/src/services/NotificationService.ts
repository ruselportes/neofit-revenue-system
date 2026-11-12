import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { MemberRepository } from '../cloud/repositories';

/** Renewal reminders (SDD Section 4.13): asks permission, saves the push token, opens Home on a tap. */
export class NotificationService {
  constructor(private readonly members: MemberRepository) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
  }

  /**
   * Asks for permission and saves the phone's push token on the member's row.
   * Returns false when reminders cannot be turned on (web, an emulator, permission refused, or no EAS project yet);
   * the Home screen's renewal notice still works.
   */
  async enable(accountId: string): Promise<boolean> {
    if (Platform.OS === 'web' || !Device.isDevice) return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('reminders', { name: 'Renewal reminders', importance: Notifications.AndroidImportance.DEFAULT });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return false;

    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!projectId) return false;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await this.members.savePushToken(accountId, token);
    return true;
  }

  /** Runs `onOpen` when the member taps a reminder. Returns a function that stops listening. */
  onTap(onOpen: () => void): () => void {
    const subscription = Notifications.addNotificationResponseReceivedListener(() => onOpen());
    return () => subscription.remove();
  }
}
