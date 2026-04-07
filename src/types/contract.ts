export interface SignPosition {
  id: string;   // client-side unique id for list management
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Width of the displayed image at the time the position was dragged (px) */
  renderWidth: number;
  /** Height of the displayed image at the time the position was dragged (px) */
  renderHeight: number;
}

export type FileCategory = "pdf" | "docx" | "image" | "other";

export interface Session {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  sign_positions: SignPosition[];  // array of sign areas
  signature_images: string[];      // base64 per position (index-aligned)
  status: "pending" | "signed";
  signed_file_url: string | null;
  created_at: string;
  expires_at: string;
}

export interface CreateSessionInput {
  file_url: string;
  file_name: string;
  file_type: string;
  sign_positions: SignPosition[];
}

export function getFileCategory(fileType: string): FileCategory {
  const t = fileType.toLowerCase();
  if (t === "pdf") return "pdf";
  if (t === "docx" || t === "doc") return "docx";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(t)) return "image";
  return "other";
}
