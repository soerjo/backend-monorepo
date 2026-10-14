import type { FileUpload } from '@prisma/client';

export type FileUploadStatus = 'ACTIVE' | 'ORPHAN';

export interface FileUploadDto {
  id: string;
  bucket: string;
  objectKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  checksum: string;
  status: FileUploadStatus;
  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
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
    status: file.status as FileUploadStatus,
    isDeleted: file.isDeleted,
    deletedAt: file.deletedAt ? file.deletedAt.toISOString() : null,
    deletedBy: file.deletedBy,
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
