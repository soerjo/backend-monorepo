import type { FileUpload } from '@prisma/client';
import { toFileUploadDto } from './file-upload.mapper.js';

describe('toFileUploadDto', () => {
  it('maps all API fields, renaming sizeBytes to size', () => {
    const createdAt = new Date('2026-10-13T09:15:00.000Z');
    const updatedAt = new Date('2026-10-13T09:20:00.000Z');
    const row: FileUpload = {
      id: 'file-1',
      bucket: 'app-uploads',
      objectKey: 'user-1/7c1b9d0e-Invoice.pdf',
      originalName: 'Invoice.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      checksum: 'a'.repeat(64),
      status: 'ACTIVE',
      uploadedBy: 'user-1',
      createdAt,
      updatedAt,
    };

    expect(toFileUploadDto(row)).toEqual({
      id: 'file-1',
      bucket: 'app-uploads',
      objectKey: 'user-1/7c1b9d0e-Invoice.pdf',
      originalName: 'Invoice.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      checksum: 'a'.repeat(64),
      status: 'ACTIVE',
      uploadedBy: 'user-1',
      createdAt,
      updatedAt,
    });
  });
});
