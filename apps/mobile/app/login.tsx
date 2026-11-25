import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { AppButton } from '../src/components/UiPrimitives';
import { useMobile } from '../src/context/MobileContext';

export default function LoginScreen() {
  const { signIn, apiBaseUrl, updateApiBaseUrl } = useMobile();
  const router = useRouter();

  const [email, setEmail] = useState('reporter@campus.edu');
  const [password, setPassword] = useState('Password123!');
  const [serverUrl, setServerUrl] = useState(apiBaseUrl);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Campus Maintenance Copilot</Text>
          <Text style={styles.subtitle}>Field Reporter &amp; Technician Mobile App</Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <AppButton
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            style={{ marginTop: 14 }}
          />

          <View style={styles.quickRow}>
            <TouchableOpacity
              style={styles.chip}
              onPress={() => {
                setEmail('reporter@campus.edu');
                setPassword('Password123!');
              }}
            >
              <Text style={styles.chipText}>Demo Reporter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.chip}
              onPress={() => {
                setEmail('tech1@campus.edu');
                setPassword('Password123!');
              }}
            >
              <Text style={styles.chipText}>Demo Technician 1</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => setShowServerConfig((prev) => !prev)}
            style={{ marginTop: 16 }}
          >
            <Text style={styles.linkText}>
              {showServerConfig ? 'Hide API Server URL' : 'Configure API Server URL'}
            </Text>
          </TouchableOpacity>

          {showServerConfig && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.label}>API Base URL (Android Emulator: 10.0.2.2)</Text>
              <TextInput
                style={styles.input}
                value={serverUrl}
                onChangeText={setServerUrl}
                autoCapitalize="none"
                placeholder="http://10.0.2.2:4000"
              />
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  container: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 22,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#475569', marginTop: 4, marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginTop: 10, marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#ffffff',
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  errorText: { color: '#b91c1c', fontSize: 13 },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: '#eef2f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: '#1e293b' },
  linkText: { fontSize: 13, color: '#1d4ed8', fontWeight: '600' },
});
