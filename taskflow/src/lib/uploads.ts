import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";

export const UPLOAD_DIR = path.join(process.cwd(), "uploads");
export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".docx",
  ".doc",
  ".xlsx",
  ".xls",
  ".csv",
  ".txt",
]);

export const MIME_BY_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".csv": "text/csv",
  ".txt": "text/plain",
};

export function isAllowedFile(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

export async function saveTaskAttachment(taskId: string, file: File) {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name).toLowerCase();
  const storedName = `${taskId}-${Date.now()}-${crypto
    .randomBytes(4)
    .toString("hex")}${ext}`;
  const fullPath = path.join(UPLOAD_DIR, storedName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);
  return { storedName, originalName: file.name };
}

export async function deleteTaskAttachment(storedName: string | null) {
  if (!storedName) return;
  try {
    await unlink(path.join(UPLOAD_DIR, storedName));
  } catch {
    // File may already be gone; ignore.
  }
}

export function resolveUploadPath(storedName: string) {
  const resolved = path.join(UPLOAD_DIR, storedName);
  if (!resolved.startsWith(UPLOAD_DIR)) {
    throw new Error("Caminho de arquivo invalido.");
  }
  return resolved;
}
