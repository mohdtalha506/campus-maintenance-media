import { Stack } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMobile } from '../../src/context/MobileContext';
import { COLORS } from '../../src/theme/tokens';

export default function TechnicianLayout() {
  const { signOut } = useMobile();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.navy },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerRight: () => (
          <TouchableOpacity onPress={signOut} style={{ padding: 4 }} accessibilityLabel="Sign out">
            <Ionicons name="log-out-outline" size={20} color="#CBD5E1" />
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
