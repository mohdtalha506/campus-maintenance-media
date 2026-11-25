import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { mobileApi } from '../../../src/api/mobileApi';
import { AppButton } from '../../../src/components/UiPrimitives';

export default function SubmitRepairScreen() {
  const { id, version } = useLocalSearchParams<{ id: string; version?: string }>();
  const router = useRouter();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoMimeType, setPhotoMimeType] = useState('image/jpeg');
  const [completionNote, setCompletionNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickPhoto(fromCamera: boolean) {
    setError(null);
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError('Camera permission is required to capture the after-repair photo.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!res.canceled && res.assets[0]) {
        setPhotoUri(res.assets[0].uri);
        setPhotoMimeType(res.assets[0].mimeType ?? 'image/jpeg');
      }
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError('Media library permission is required to select a repair photo.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!res.canceled && res.assets[0]) {
        setPhotoUri(res.assets[0].uri);
        setPhotoMimeType(res.assets[0].mimeType ?? 'image/jpeg');
      }
    }
  }

  async function handleSubmit() {
    setError(null);
    if (!photoUri) {
      setError('An after-repair photo is required.');
      return;
    }
    if (completionNote.trim().length < 3) {
      setError('Please enter a completion note (at least 3 characters).');
      return;
    }

    setBusy(true);
    try {
      const latest = version
        ? Number(version)
        : (await mobileApi.getTicket(id!)).ticket.version;

      await mobileApi.submitRepair({
        ticketId: id!,
        expectedVersion: latest,
        completionNote: completionNote.trim(),
        afterPhotoUri: photoUri,
        afterPhotoMimeType: photoMimeType,
      });
      router.replace(`/(technician)/job/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit repair.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>After-Repair Photo (Required)</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <AppButton
            title="Take Photo"
            variant="secondary"
            onPress={() => pickPhoto(true)}
            style={{ flex: 1 }}
          />
          <AppButton
            title="Choose Photo"
            variant="secondary"
            onPress={() => pickPhoto(false)}
            style={{ flex: 1 }}
          />
        </View>
        {photoUri && <Image source={{ uri: photoUri }} style={styles.img} resizeMode="cover" />}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Completion Note</Text>
        <TextInput
          style={styles.textarea}
          multiline
          value={completionNote}
          onChangeText={setCompletionNote}
          placeholder="Describe the repair performed and verification checks..."
        />
      </View>

      <AppButton
        title="Submit Repair for Verification"
        variant="success"
        onPress={handleSubmit}
        loading={busy}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f6f9' },
  container: { padding: 14, gap: 12, paddingBottom: 32 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  img: { width: '100%', height: 210, borderRadius: 8 },
  textarea: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  errorBox: { backgroundColor: '#fee2e2', padding: 10, borderRadius: 8 },
  errorText: { color: '#b91c1c', fontSize: 13 },
});
