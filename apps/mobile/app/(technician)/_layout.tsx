import { Stack } from 'expo-router';
import { TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeToggleButton } from '../../src/components/UiPrimitives';
import { useMobile, useTheme } from '../../src/context/MobileContext';

export default function TechnicianLayout() {
  const { signOut } = useMobile();
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.heroBg },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ThemeToggleButton />
            <TouchableOpacity onPress={signOut} style={{ padding: 4 }} accessibilityLabel="Sign out">
              <Ionicons name="log-out-outline" size={20} color="#CBD5E1" />
            </TouchableOpacity>
          </View>
        ),
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Assigned Jobs' }} />
      <Stack.Screen name="job/[id]" options={{ title: 'Job Details' }} />
      <Stack.Screen name="repair/[id]" options={{ title: 'Submit Repair' }} />
    </Stack>
  );
}
