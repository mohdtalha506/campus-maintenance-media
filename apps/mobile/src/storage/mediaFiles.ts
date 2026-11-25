import * as FileSystem from 'expo-file-system';

const MEDIA_DIR = `${FileSystem.documentDirectory ?? ''}campus-media/`;

async function ensureMediaDir(): Promise<void> {
  if (!FileSystem.documentDirectory) return;
  const info = await FileSystem.getInfoAsync(MEDIA_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MEDIA_DIR, { intermediates: true });
  }
}

export async function persistDraftMedia(
  sourceUri: string,
  localId: string,
  kind: 'photo' | 'audio',
  extHint?: string
): Promise<string> {
  await ensureMediaDir();
  if (sourceUri.startsWith(MEDIA_DIR)) {
    return sourceUri;
  }
  const extFromUri = sourceUri.split('?')[0]?.split('.').pop();
  const ext = (extHint ?? extFromUri ?? (kind === 'photo' ? 'jpg' : 'm4a')).replace(
    /[^a-zA-Z0-9]/g,
    ''
  );
  const destUri = `${MEDIA_DIR}${localId}-${kind}-${Date.now()}.${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destUri });
  return destUri;
}

export async function deleteDurableMedia(uri: string | null): Promise<void> {
  if (!uri || !uri.startsWith(MEDIA_DIR)) return;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    // Best-effort cleanup after server upload confirmation
  }
}
