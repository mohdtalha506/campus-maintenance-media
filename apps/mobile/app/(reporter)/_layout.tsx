import { Tabs } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { useMobile } from '../../src/context/MobileContext';

export default function ReporterLayout() {
  const { isOnline, signOut, drafts } = useMobile();
  const pendingCount = drafts.filter((d) => d.syncStatus !== 'synced').length;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#ffffff',
        tabBarActiveTintColor: '#1d4ed8',
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 12 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: isOnline ? '#dcfce7' : '#fee2e2',
                color: isOnline ? '#15803d' : '#b91c1c',
              }}
            >
              {isOnline ? 'Online' : 'Offline'}
            </Text>
            <TouchableOpacity onPress={signOut}>
              <Text style={{ color: '#cbd5e1', fontSize: 13, fontWeight: '600' }}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'My Reports',
          tabBarLabel: 'My Reports',
        }}
      />
      <Tabs.Screen
        name="new"
        options={{
          title: 'New Report',
          tabBarLabel: 'New Report',
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: 'Drafts & Queue',
          tabBarLabel: pendingCount > 0 ? `Queue (${pendingCount})` : 'Queue',
        }}
      />
      <Tabs.Screen
        name="draft/[localId]"
        options={{
          href: null,
          title: 'Review Draft',
        }}
      />
      <Tabs.Screen
        name="ticket/[id]"
        options={{
          href: null,
          title: 'Ticket Details',
        }}
      />
    </Tabs>
  );
}
