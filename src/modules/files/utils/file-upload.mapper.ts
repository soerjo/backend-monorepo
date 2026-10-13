import type { FileUpload } from '@prisma/client';

export interface FileUploadDto {
  id: string;
  bucket: string;
  objectKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  checksum: string;
  status: string;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toFileUploadDto(file: FileUpload): FileUploadDto {
  return {
    id: file.id,
    bucket: file.bucket,
    objectKey: file.objectKey,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.sizeBytes,
    checksum: file.checksum,
    status: file.status,
    uploadedBy: file.uploadedBy,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}

export interface FileUploadListDto {
  items: FileUploadDto[];
  total: number;
  page: number;
  limit: number;
}
