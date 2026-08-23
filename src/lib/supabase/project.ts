export function getSupabaseProjectRef(supabaseUrl: string): string | null {
  try {
    const host = new URL(supabaseUrl).hostname;
    const match = /^([a-z0-9]+)\.supabase\.co$/i.exec(host);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function getSupabaseStorageS3Endpoint(projectRef: string): string {
  return `https://${projectRef}.storage.supabase.co/storage/v1/s3`;
}
