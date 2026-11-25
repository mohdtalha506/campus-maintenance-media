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

export async function registerForPushNotificationsAsync(): Promise<string | null> {
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
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }

    const projectId =
      (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ??
      Constants.easConfig?.projectId;
    if (!projectId) {
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch {
    return null;
  }
}

export async function syncAppIconBadgeCount(unreadCount: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, unreadCount));
  } catch {
    // Ignore on platforms/launchers that don't support badge API
  }
}
