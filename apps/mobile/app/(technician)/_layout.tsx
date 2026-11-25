import { Stack } from 'expo-router';
import { Text, TouchableOpacity } from 'react-native';
import { useMobile } from '../../src/context/MobileContext';

export default function TechnicianLayout() {
  const { signOut } = useMobile();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#ffffff',
        headerRight: () => (
          <TouchableOpacity onPress={signOut}>
            <Text style={{ color: '#cbd5e1', fontSize: 13, fontWeight: '600' }}>Sign Out</Text>
          </TouchableOpacity>
        ),
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Assigned Jobs' }} />
      <Stack.Screen name="job/[id]" options={{ title: 'Job Details' }} />
      <Stack.Screen name="repair/[id]" options={{ title: 'Submit Repair' }} />
    </Stack>
  );
}
