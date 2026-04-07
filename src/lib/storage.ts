import { getSupabase } from "./supabase";

const BUCKET_NAME = "contracts";

export async function uploadFile(
  file: File,
  sessionId: string
): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `${sessionId}/original.${ext}`;

  const { error } = await getSupabase()
    .storage
    .from(BUCKET_NAME)
    .upload(path, file, { upsert: true });

  if (error) throw new Error(error.message);

  const { data } = getSupabase().storage.from(BUCKET_NAME).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadSignedPdf(
  pdfBytes: Uint8Array<ArrayBuffer>,
  sessionId: string
): Promise<string> {
  const path = `${sessionId}/signed.pdf`;
  const blob = new Blob([pdfBytes], { type: "application/pdf" });

  const { error } = await getSupabase()
    .storage
    .from(BUCKET_NAME)
    .upload(path, blob, { upsert: true, contentType: "application/pdf" });

  if (error) throw new Error(error.message);

  const { data } = getSupabase().storage.from(BUCKET_NAME).getPublicUrl(path);
  return data.publicUrl;
}

export async function downloadFile(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to download file");
  return response.arrayBuffer();
}
