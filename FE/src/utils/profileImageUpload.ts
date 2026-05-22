import { profileImageUpload, saveProfilePhoto as saveProfilePhotoApi } from '../api/api';

type UploadDetail = { filename?: string; status?: string };

/** Parse filename from image-upload API or auth/profilePhoto responses. */
export function parseProfileImageFilenameFromUploadResponse(
  response: unknown,
  fallbackOriginalName?: string,
): string | null {
  if (!response || typeof response !== 'object') {
    return fallbackOriginalName?.trim() || null;
  }
  const root = response as Record<string, unknown>;

  if (typeof root.filename === 'string' && root.filename.trim()) {
    return root.filename.trim();
  }

  const nestedData = root.data;
  if (nestedData && typeof nestedData === 'object') {
    const data = nestedData as Record<string, unknown>;
    if (typeof data.filename === 'string' && data.filename.trim()) {
      return data.filename.trim();
    }
    const details = data.details as UploadDetail[] | undefined;
    if (Array.isArray(details)) {
      const uploaded = details.find(
        d => d?.status === 'uploaded' && d.filename?.trim(),
      );
      if (uploaded?.filename) return uploaded.filename.trim();
      const any = details.find(d => d.filename?.trim());
      if (any?.filename) return any.filename.trim();
    }
  }

  const details = root.details as UploadDetail[] | undefined;
  if (Array.isArray(details)) {
    const uploaded = details.find(
      d => d?.status === 'uploaded' && d.filename?.trim(),
    );
    if (uploaded?.filename) return uploaded.filename.trim();
    const any = details.find(d => d.filename?.trim());
    if (any?.filename) return any.filename.trim();
  }

  return fallbackOriginalName?.trim() || null;
}

/** Upload via /api/image-upload/upload and return stored filename. */
export async function uploadProfilePhotoFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  const res = await profileImageUpload(formData);
  const filename = parseProfileImageFilenameFromUploadResponse(res, file.name);
  if (!filename) {
    throw new Error('Profile photo upload did not return a filename');
  }
  return filename;
}

/** Upload + persist on user record in one request; updates Redux auth user. */
export async function saveProfilePhotoFile(file: File): Promise<string> {
  const result = await saveProfilePhotoApi(file);
  const filename =
    (typeof result?.filename === 'string' && result.filename.trim()) ||
    parseProfileImageFilenameFromUploadResponse(result, file.name);
  if (!filename) {
    throw new Error('Profile photo could not be saved');
  }
  return filename;
}

export async function dataUriToImageFile(
  dataUri: string,
  baseName: string,
): Promise<File> {
  const fileExtension = dataUri.split(';')[0].split('/')[1] || 'png';
  const base64Response = await fetch(dataUri);
  const blob = await base64Response.blob();
  return new File([blob], `${baseName}_${Date.now()}.${fileExtension}`, {
    type: blob.type || `image/${fileExtension}`,
  });
}
