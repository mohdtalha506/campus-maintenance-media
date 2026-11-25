import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Stack,
  useRootNavigationState,
  useRouter,
  useSegments,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { MobileProvider, useMobile, useTheme } from '../src/context/MobileContext';
import { COLORS } from '../src/theme/tokens';

function OtaUpdateBanner() {
  const { colors } = useTheme();
  const [otaStatus, setOtaStatus] = useState<'idle' | 'downloading' | 'ready'>('idle');

  useEffect(() => {
    let active = true;
    async function checkOta() {
      if (typeof __DEV__ !== 'undefined' && __DEV__) return;
      if (!Updates.isEnabled) return;
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable || !active) return;
        setOtaStatus('downloading');
        await Updates.fetchUpdateAsync();
        if (active) {
          setOtaStatus('ready');
        }
      } catch {
        if (active) setOtaStatus('idle');
      }
    }
    void checkOta();
    return () => {
      active = false;
    };
  }, []);

  if (otaStatus === 'idle') return null;

  return (
    <View style={[styles.otaBanner, { backgroundColor: colors.primary }]}>
      <Ionicons
        name={otaStatus === 'ready' ? 'cloud-done' : 'cloud-download-outline'}
        size={16}
        color="#FFFFFF"
      />
      <Text style={styles.otaText}>
        {otaStatus === 'downloading'
          ? 'Downloading app update in background...'
          : 'New update ready to apply'}
      </Text>
      {otaStatus === 'ready' && (
        <TouchableOpacity
          style={styles.otaBtn}
          onPress={() => {
            void Updates.reloadAsync();
          }}
        >
          <Text style={[styles.otaBtnText, { color: colors.primary }]}>Restart Now</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function RootNavigator() {
  const { user, authLoading } = useMobile();
  const { colors } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (authLoading || !navigationState?.key) return;
    const inLogin = segments[0] === 'login';

    if (!user && !inLogin) {
      router.replace('/login');
      return;
    }

    if (user && inLogin) {
      if (user.role === 'technician') {
        router.replace('/(technician)');
      } else {
        router.replace('/(reporter)');
      }
    }
  }, [authLoading, navigationState?.key, router, segments, user]);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <OtaUpdateBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(reporter)" />
        <Stack.Screen name="(technician)" />
      </Stack>
      {authLoading && (
        <View style={[styles.loadingOverlay, { backgroundColor: colors.canvas }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <MobileProvider>
      <RootNavigator />
    </MobileProvider>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.canvas,
  },
  otaBanner: {
    backgroundColor: COLORS.primary,
    paddingTop: 36,
    paddingBottom: 9,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  otaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  otaBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  otaBtnText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
  },
});
