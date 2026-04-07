import { getSupabase } from "./supabase";
import { CreateSessionInput, Session } from "@/types/contract";

export async function createSession(input: CreateSessionInput): Promise<Session> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const { data, error } = await getSupabase()
    .from("sessions")
    .insert({
      file_url: input.file_url,
      file_name: input.file_name,
      file_type: input.file_type,
      sign_position: input.sign_position,
      signature_image: null,
      status: "pending",
      signed_file_url: null,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Session;
}

export async function getSession(id: string): Promise<Session | null> {
  const { data, error } = await getSupabase()
    .from("sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as Session;
}

export async function updateSessionSignature(
  id: string,
  signatureImage: string,
  signedFileUrl: string
): Promise<void> {
  const { error } = await getSupabase()
    .from("sessions")
    .update({
      signature_image: signatureImage,
      signed_file_url: signedFileUrl,
      status: "signed",
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export function isSessionExpired(session: Session): boolean {
  return new Date() > new Date(session.expires_at);
}
