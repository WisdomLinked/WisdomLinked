import { describe, expect, it } from 'vitest';
import { parseProfileImageFilenameFromUploadResponse } from './profileImageUpload';

describe('parseProfileImageFilenameFromUploadResponse', () => {
  it('reads top-level filename from image-upload route', () => {
    expect(
      parseProfileImageFilenameFromUploadResponse(
        { message: 'ok', filename: 'user_99.jpg', data: { details: [] } },
        'fallback.jpg',
      ),
    ).toBe('user_99.jpg');
  });

  it('reads nested data.details uploaded row', () => {
    expect(
      parseProfileImageFilenameFromUploadResponse(
        {
          data: {
            details: [
              { filename: 'skip.png', status: 'failed' },
              { filename: 'stored.jpg', status: 'uploaded' },
            ],
          },
        },
        'fallback.jpg',
      ),
    ).toBe('stored.jpg');
  });

  it('falls back to original file name', () => {
    expect(parseProfileImageFilenameFromUploadResponse({}, 'upload.png')).toBe(
      'upload.png',
    );
  });
});
