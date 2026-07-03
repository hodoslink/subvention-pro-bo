import { getSupabaseServer } from './supabase';

export const BUCKET = 'subvention-docs';

async function ensureBucket(): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
  // "already exists" n'est pas une vraie erreur
  if (error && !error.message.includes('already exists') && !error.message.includes('duplicate')) {
    throw new Error(`Impossible de créer le bucket : ${error.message}`);
  }
}

export async function uploadToStorage(
  path: string,
  file: File
): Promise<string> {
  await ensureBucket();
  const supabase = getSupabaseServer();
  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    });
  if (error) throw new Error(error.message);
  return path;
}

export async function deleteFromStorage(path: string): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}

export async function getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw new Error(error?.message ?? 'Erreur signed URL');
  return data.signedUrl;
}

export async function downloadFile(path: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(error?.message ?? 'Téléchargement impossible');
  const arrayBuffer = await data.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: data.type || 'application/octet-stream',
  };
}
