import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { mobileApi } from '../../../src/api/mobileApi';
import { AppButton, SectionCard } from '../../../src/components/UiPrimitives';
import { COLORS } from '../../../src/theme/tokens';

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
          <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <SectionCard
        title="After-Repair Photo"
        subtitle="Required proof before supervisor verification"
        icon="camera-outline"
      >
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <AppButton
            title="Take Photo"
            icon="camera"
            variant="soft"
            onPress={() => pickPhoto(true)}
            style={{ flex: 1 }}
          />
          <AppButton
            title="Gallery"
            icon="images-outline"
            variant="secondary"
            onPress={() => pickPhoto(false)}
            style={{ flex: 1 }}
          />
        </View>
        {photoUri && <Image source={{ uri: photoUri }} style={styles.img} resizeMode="cover" />}
      </SectionCard>

      <SectionCard title="Completion Note" icon="create-outline">
        <TextInput
          style={styles.textarea}
          multiline
          value={completionNote}
          onChangeText={setCompletionNote}
          placeholder="Describe the repair performed and verification checks..."
        />
      </SectionCard>

      <AppButton
        title="Submit Repair for Verification"
        icon="shield-checkmark-outline"
        variant="success"
        onPress={handleSubmit}
        loading={busy}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.canvas },
  container: { padding: 14, gap: 12, paddingBottom: 32 },
  img: { width: '100%', height: 210, borderRadius: 10, marginTop: 12 },
  textarea: {
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 10,
    padding: 12,
    minHeight: 106,
    textAlignVertical: 'top',
    fontSize: 15,
    backgroundColor: COLORS.surfaceMuted,
    color: COLORS.text,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerSoft,
    padding: 11,
    borderRadius: 10,
  },
  errorText: { flex: 1, color: COLORS.danger, fontSize: 13 },
});
