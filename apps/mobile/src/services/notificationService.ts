import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushRegistrationResult {
  token: string | null;
  status: 'active' | 'denied' | 'unsupported' | 'error';
  message: string;
}

export async function registerForPushNotificationsAsync(): Promise<PushRegistrationResult> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Campus Maintenance Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1D4ED8',
      });
    }

    if (!Device.isDevice) {
      return {
        token: null,
        status: 'unsupported',
        message: 'Physical device required for push notifications.',
      };
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return {
        token: null,
        status: 'denied',
        message: 'Notification permission denied. Enable it in phone Settings.',
      };
    }

    const projectId =
      (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ??
      Constants.easConfig?.projectId;
    if (!projectId) {
      return {
        token: null,
        status: 'error',
        message: 'Missing EAS projectId in app config.',
      };
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return {
      token: tokenData.data,
      status: 'active',
      message: 'Push notifications active',
    };
  } catch (err) {
    return {
      token: null,
      status: 'error',
      message: err instanceof Error ? err.message : 'Could not register push token.',
    };
  }
}

export async function syncAppIconBadgeCount(unreadCount: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, unreadCount));
  } catch {
    // Ignore on platforms/launchers that don't support badge API
  }
}
