export interface SignPosition {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Session {
  id: string;
  file_url: string;
  file_name: string;
  file_type: "pdf" | "docx";
  sign_position: SignPosition;
  signature_image: string | null;
  status: "pending" | "signed";
  signed_file_url: string | null;
  created_at: string;
  expires_at: string;
}

export interface CreateSessionInput {
  file_url: string;
  file_name: string;
  file_type: "pdf" | "docx";
  sign_position: SignPosition;
}
