export interface SignPosition {
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
  file_type: string; // actual file extension, e.g. "pdf", "docx", "jpg", "xlsx"
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
  file_type: string;
  sign_position: SignPosition;
}

export function getFileCategory(fileType: string): FileCategory {
  const t = fileType.toLowerCase();
  if (t === "pdf") return "pdf";
  if (t === "docx" || t === "doc") return "docx";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(t)) return "image";
  return "other";
}
