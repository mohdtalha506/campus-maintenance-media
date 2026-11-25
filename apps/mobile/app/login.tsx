import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppButton, ThemeToggleButton } from '../src/components/UiPrimitives';
import { useMobile, useTheme } from '../src/context/MobileContext';
import type { ThemeColors } from '../src/theme/tokens';

export default function LoginScreen() {
  const { signIn, apiBaseUrl, updateApiBaseUrl } = useMobile();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const [email, setEmail] = useState('reporter@campus.edu');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);
  const [serverUrl, setServerUrl] = useState(apiBaseUrl);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setServerUrl(apiBaseUrl);
  }, [apiBaseUrl]);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      if (serverUrl !== apiBaseUrl) {
        await updateApiBaseUrl(serverUrl);
      }
      const user = await signIn(email.trim(), password);
      if (user.role === 'supervisor') {
        setError('Use the web dashboard for supervisor accounts, or sign in as Reporter / Technician.');
        return;
      }
      if (user.role === 'technician') {
        router.replace('/(technician)');
      } else {
        router.replace('/(reporter)');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.topActions}>
          <ThemeToggleButton />
        </View>

        <View style={styles.hero}>
          <View style={styles.logoTile}>
            <Ionicons name="shield-checkmark" size={32} color="#FFFFFF" />
            <View style={styles.sparkBadge}>
              <Ionicons name="sparkles" size={12} color={colors.heroBg} />
            </View>
          </View>
          <Text style={styles.brandTitle}>Campus Maintenance Copilot</Text>
          <Text style={styles.brandSubtitle}>
            AI Field Inspection &amp; Repair Operations
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Sign in to continue</Text>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>Campus Email</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.inputField}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="name@campus.edu"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.inputField}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="Enter your password"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
            />
            <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          <AppButton
            title="Sign In"
            icon="log-in-outline"
            onPress={handleLogin}
            loading={loading}
            style={{ marginTop: 20 }}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>DEMO ACCOUNTS</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.quickRow}>
            <TouchableOpacity
              style={[
                styles.roleCard,
                email === 'reporter@campus.edu' && styles.roleCardActive,
              ]}
              onPress={() => {
                setEmail('reporter@campus.edu');
                setPassword('Password123!');
              }}
            >
              <Ionicons
                name="camera-outline"
                size={18}
                color={email === 'reporter@campus.edu' ? colors.primaryText : colors.textSecondary}
              />
              <View>
                <Text style={styles.roleTitle}>Reporter</Text>
                <Text style={styles.roleSub}>Asha Verma</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleCard,
                email === 'tech1@campus.edu' && styles.roleCardActive,
              ]}
              onPress={() => {
                setEmail('tech1@campus.edu');
                setPassword('Password123!');
              }}
            >
              <Ionicons
                name="construct-outline"
                size={18}
                color={email === 'tech1@campus.edu' ? colors.primaryText : colors.textSecondary}
              />
              <View>
                <Text style={styles.roleTitle}>Technician</Text>
                <Text style={styles.roleSub}>Rohan Das</Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => setShowServerConfig((prev) => !prev)}
            style={styles.serverToggle}
          >
            <Ionicons name="server-outline" size={15} color={colors.primaryText} />
            <Text style={styles.linkText}>
              {showServerConfig ? 'Hide API Server Settings' : 'API Server Settings'}
            </Text>
          </TouchableOpacity>

          {showServerConfig && (
            <View style={styles.serverBox}>
              <Text style={styles.serverLabel}>API Base URL</Text>
              <TextInput
                style={styles.serverInput}
                value={serverUrl}
                onChangeText={setServerUrl}
                autoCapitalize="none"
                placeholder="https://campus-maintenance-media.onrender.com"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.primary}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.heroBg },
    container: { flexGrow: 1, justifyContent: 'center', padding: 20, paddingVertical: 36 },
    topActions: {
      position: 'absolute',
      top: 44,
      right: 20,
      zIndex: 10,
    },
    hero: { alignItems: 'center', marginBottom: 22 },
    logoTile: {
      width: 68,
      height: 68,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
      shadowColor: '#1D4ED8',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 12,
      elevation: 6,
    },
    sparkBadge: {
      position: 'absolute',
      top: -5,
      right: -5,
      width: 24,
      height: 24,
      borderRadius: 999,
      backgroundColor: '#FBBF24',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.heroBg,
    },
    brandTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: '#FFFFFF',
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    brandSubtitle: {
      fontSize: 13.5,
      color: '#94A3B8',
      marginTop: 4,
      textAlign: 'center',
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: colors.isDark ? 0.4 : 0.16,
      shadowRadius: 16,
      elevation: 6,
    },
    cardHeading: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      marginTop: 14,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 12,
      paddingHorizontal: 13,
      backgroundColor: colors.surfaceMuted,
    },
    inputField: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.dangerSoft,
      borderRadius: 10,
      padding: 12,
      marginTop: 6,
    },
    errorText: { color: colors.danger, fontSize: 13.5, flex: 1, fontWeight: '500', lineHeight: 19 },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 20,
      marginBottom: 12,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.6 },
    quickRow: { flexDirection: 'row', gap: 10 },
    roleCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    roleCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    roleTitle: { fontSize: 13.5, fontWeight: '700', color: colors.text },
    roleSub: { fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
    serverToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 18,
      paddingVertical: 4,
    },
    linkText: { fontSize: 13, color: colors.primaryText, fontWeight: '600' },
    serverBox: {
      marginTop: 10,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    serverLabel: { fontSize: 11.5, fontWeight: '700', color: colors.textSecondary, marginBottom: 6 },
    serverInput: {
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 10,
      paddingHorizontal: 11,
      paddingVertical: 9,
      fontSize: 13.5,
      backgroundColor: colors.surface,
      color: colors.text,
    },
  });
}
