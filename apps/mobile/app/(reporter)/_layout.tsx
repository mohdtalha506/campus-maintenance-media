import { Tabs } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMobile } from '../../src/context/MobileContext';
import { COLORS } from '../../src/theme/tokens';

export default function ReporterLayout() {
  const { isOnline, signOut, drafts } = useMobile();
  const pendingCount = drafts.filter((d) => d.syncStatus !== 'synced').length;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.navy },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
          borderTopColor: COLORS.border,
          backgroundColor: COLORS.surface,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        headerRight: () => (
          <View style={styles.headerRight}>
            <View
              style={[
                styles.connPill,
                { backgroundColor: isOnline ? COLORS.successSoft : COLORS.dangerSoft },
              ]}
            >
              <Ionicons
                name={isOnline ? 'wifi' : 'cloud-offline'}
                size={12}
                color={isOnline ? COLORS.success : COLORS.danger}
              />
              <Text
                style={[
                  styles.connText,
                  { color: isOnline ? COLORS.success : COLORS.danger },
                ]}
              >
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
            <TouchableOpacity onPress={signOut} style={styles.logoutBtn} accessibilityLabel="Sign out">
              <Ionicons name="log-out-outline" size={20} color="#CBD5E1" />
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
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'document-text' : 'document-text-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="new"
        options={{
          title: 'New Inspection',
          tabBarLabel: 'Report Issue',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'add-circle' : 'add-circle-outline'}
              size={size + 2}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: 'Drafts & Sync Queue',
          tabBarLabel: 'Queue',
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'cloud-upload' : 'cloud-upload-outline'}
              size={size}
              color={color}
            />
          ),
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

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 12,
  },
  connPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  connText: {
    fontSize: 11,
    fontWeight: '700',
  },
  logoutBtn: {
    padding: 4,
  },
});
