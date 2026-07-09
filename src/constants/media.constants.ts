export const MAX_VOICE_DURATION_SECONDS = 120;

/**
 * Document formats allowed in order chat — the office file types staff,
 * karigars, and admins exchange (invoices, specs, rate sheets, notes).
 * Executables and scripts stay blocked.
 */
export const CHAT_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'text/comma-separated-values',
  'text/plain',
]);

export const CHAT_DOCUMENT_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'csv',
  'txt',
]);

/**
 * Some pickers report generic mimetypes (e.g. `application/octet-stream`),
 * so accept when EITHER the mimetype or the file extension is on the list.
 */
export function isAllowedChatDocument(mimetype: string, filename: string): boolean {
  if (CHAT_DOCUMENT_MIME_TYPES.has((mimetype || '').toLowerCase())) return true;
  const name = filename || '';
  const dot = name.lastIndexOf('.');
  if (dot < 0) return false;
  return CHAT_DOCUMENT_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}
