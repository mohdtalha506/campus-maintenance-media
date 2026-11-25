import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MobileProvider, useMobile } from '../src/context/MobileContext';

function RootNavigator() {
  const { user, authLoading } = useMobile();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
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
  }, [authLoading, router, segments, user]);

  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f4f6f9' }}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(reporter)" />
        <Stack.Screen name="(technician)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <MobileProvider>
      <RootNavigator />
    </MobileProvider>
  );
}
