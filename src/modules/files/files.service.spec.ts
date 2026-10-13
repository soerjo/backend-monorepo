import type { FileUpload } from '@prisma/client';
import { FilesService, type UploadedFile } from './files.service.js';
import type { FilesRepository } from './files.repository.js';
import type { MinioService } from './minio.service.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { AppError } from '../../common/errors/app-error.js';
import { MAX_FILE_SIZE_BYTES, MAX_LIST_LIMIT } from './files.constants.js';

const helloSha256 =
  '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';

const user: AuthUser = {
  id: 'user-1',
  email: 'user@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  role: 'USER',
  organizationId: 'org-1',
};

const admin: AuthUser = { ...user, id: 'admin-1', role: 'ADMIN' };

const filesRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findMany: jest.fn(),
  count: jest.fn(),
  softDelete: jest.fn(),
} as unknown as jest.Mocked<FilesRepository>;

const minioService = {
  bucketName: 'app-uploads',
  putObject: jest.fn(),
  presignedGetObject: jest.fn(),
  removeObject: jest.fn(),
} as unknown as jest.Mocked<MinioService>;

async function expectAppError(
  promise: Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  const error = await promise.then(
    () => {
      throw new Error('Expected the call to reject, but it resolved');
    },
    (rejection: unknown) => rejection,
  );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(expectedCode);
}

function makeFileRow(overrides: Partial<FileUpload> = {}): FileUpload {
  return {
    id: 'file-1',
    bucket: 'app-uploads',
    objectKey: 'user-1/7c1b9d0e-2f4a-4c6e-8a0b-9c8d7e6f5a4b-Invoice-42-EU.pdf',
    originalName: 'Invoice 42 EU.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 5,
    checksum: helloSha256,
    status: 'ACTIVE',
    uploadedBy: 'user-1',
    createdAt: new Date('2026-10-13T09:15:00.000Z'),
    updatedAt: new Date('2026-10-13T09:15:00.000Z'),
    ...overrides,
  };
}

function makeUploadedFile(overrides: Partial<UploadedFile> = {}): UploadedFile {
  return {
    originalname: 'Invoice 42 EU.pdf',
    mimetype: 'application/pdf',
    size: 5,
    buffer: Buffer.from('hello'),
    ...overrides,
  };
}

describe('FilesService', () => {
  let service: FilesService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new FilesService(filesRepository, minioService);
  });

  describe('upload', () => {
    it('stores the object in MinIO first, then creates the metadata row', async () => {
      minioService.putObject.mockResolvedValue(undefined);
      filesRepository.create.mockImplementation((data) =>
        Promise.resolve(makeFileRow({ objectKey: data.objectKey })),
      );

      const result = await service.upload(makeUploadedFile(), user);

      expect(minioService.putObject).toHaveBeenCalledTimes(1);
      const objectKey = minioService.putObject.mock.calls[0][0];
      expect(objectKey).toMatch(/^user-1\/[0-9a-f-]{36}-Invoice-42-EU\.pdf$/);
      expect(minioService.putObject).toHaveBeenCalledWith(
        objectKey,
        Buffer.from('hello'),
        5,
        'application/pdf',
      );
      expect(filesRepository.create).toHaveBeenCalledTimes(1);
      expect(filesRepository.create).toHaveBeenCalledWith({
        bucket: 'app-uploads',
        objectKey,
        originalName: 'Invoice 42 EU.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 5,
        checksum: helloSha256,
        uploadedBy: 'user-1',
      });
      expect(result.size).toBe(5);
      expect(result.status).toBe('ACTIVE');
      expect(result.checksum).toBe(helloSha256);
      expect(result.objectKey).toBe(objectKey);
    });

    it('rejects a non-whitelisted extension and MIME type with 415', async () => {
      await expectAppError(
        service.upload(
          makeUploadedFile({
            originalname: 'evil.exe',
            mimetype: 'application/x-msdownload',
          }),
          user,
        ),
        'UNSUPPORTED_MEDIA_TYPE',
      );
      expect(minioService.putObject).not.toHaveBeenCalled();
      expect(filesRepository.create).not.toHaveBeenCalled();
    });

    it('rejects a whitelisted extension with a mismatched MIME type', async () => {
      await expectAppError(
        service.upload(
          makeUploadedFile({
            originalname: 'photo.png',
            mimetype: 'image/jpeg',
          }),
          user,
        ),
        'UNSUPPORTED_MEDIA_TYPE',
      );
      expect(minioService.putObject).not.toHaveBeenCalled();
    });

    it('rejects an oversized file with 413', async () => {
      await expectAppError(
        service.upload(
          makeUploadedFile({ size: MAX_FILE_SIZE_BYTES + 1 }),
          user,
        ),
        'FILE_TOO_LARGE',
      );
      expect(minioService.putObject).not.toHaveBeenCalled();
    });

    it('rejects a missing file with VALIDATION_ERROR', async () => {
      await expectAppError(service.upload(undefined, user), 'VALIDATION_ERROR');
    });

    it('maps a MinIO failure to 500 MINIO_UNAVAILABLE without touching the DB', async () => {
      minioService.putObject.mockRejectedValue(new Error('ECONNREFUSED'));

      await expectAppError(
        service.upload(makeUploadedFile(), user),
        'MINIO_UNAVAILABLE',
      );
      expect(filesRepository.create).not.toHaveBeenCalled();
      expect(minioService.removeObject).not.toHaveBeenCalled();
    });

    it('compensates with removeObject when the PG insert fails, rethrowing the original error', async () => {
      minioService.putObject.mockResolvedValue(undefined);
      filesRepository.create.mockRejectedValue(new Error('insert failed'));

      await expect(service.upload(makeUploadedFile(), user)).rejects.toThrow(
        'insert failed',
      );

      const objectKey = minioService.putObject.mock.calls[0][0];
      expect(minioService.removeObject).toHaveBeenCalledTimes(1);
      expect(minioService.removeObject).toHaveBeenCalledWith(objectKey);
    });

    it('still rethrows the insert error when the compensating removeObject also fails', async () => {
      minioService.putObject.mockResolvedValue(undefined);
      filesRepository.create.mockRejectedValue(new Error('insert failed'));
      minioService.removeObject.mockRejectedValue(new Error('remove failed'));

      await expect(service.upload(makeUploadedFile(), user)).rejects.toThrow(
        'insert failed',
      );
      expect(minioService.removeObject).toHaveBeenCalledTimes(1);
    });
  });

  describe('list', () => {
    it('scopes non-ADMIN users to their own ACTIVE and ORPHAN uploads', async () => {
      filesRepository.findMany.mockResolvedValue([makeFileRow()]);
      filesRepository.count.mockResolvedValue(1);

      const result = await service.list({ page: 1, limit: 20 }, user);

      const params = filesRepository.findMany.mock.calls[0][0];
      expect(params.where).toEqual({
        status: { in: ['ACTIVE', 'ORPHAN'] },
        uploadedBy: 'user-1',
      });
      expect(filesRepository.count).toHaveBeenCalledWith(params.where);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].size).toBe(5);
    });

    it('lists all ACTIVE and ORPHAN uploads for ADMIN users', async () => {
      filesRepository.findMany.mockResolvedValue([]);
      filesRepository.count.mockResolvedValue(0);

      await service.list({ page: 1, limit: 20 }, admin);

      const params = filesRepository.findMany.mock.calls[0][0];
      expect(params.where).toEqual({ status: { in: ['ACTIVE', 'ORPHAN'] } });
    });

    it('includes ORPHAN-status files in the list result', async () => {
      filesRepository.findMany.mockResolvedValue([
        makeFileRow({ id: 'file-orphan', status: 'ORPHAN' }),
      ]);
      filesRepository.count.mockResolvedValue(1);

      const result = await service.list({ page: 1, limit: 20 }, user);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('ORPHAN');
      expect(result.total).toBe(1);
    });

    it('does not include DELETED files in the list query', async () => {
      filesRepository.findMany.mockResolvedValue([]);
      filesRepository.count.mockResolvedValue(0);

      await service.list({ page: 1, limit: 20 }, user);

      const params = filesRepository.findMany.mock.calls[0][0];
      expect(params.where.status).toEqual({ in: ['ACTIVE', 'ORPHAN'] });
      expect(params.where.status).not.toEqual({
        in: ['ACTIVE', 'ORPHAN', 'DELETED'],
      });
    });

    it('applies an insensitive contains search on originalName', async () => {
      filesRepository.findMany.mockResolvedValue([]);
      filesRepository.count.mockResolvedValue(0);

      await service.list({ page: 1, limit: 20, search: 'invoIce' }, user);

      const params = filesRepository.findMany.mock.calls[0][0];
      expect(params.where).toEqual({
        status: { in: ['ACTIVE', 'ORPHAN'] },
        uploadedBy: 'user-1',
        originalName: { contains: 'invoIce', mode: 'insensitive' },
      });
    });

    it('clamps the limit to 100 and echoes the effective value', async () => {
      filesRepository.findMany.mockResolvedValue([]);
      filesRepository.count.mockResolvedValue(0);

      const result = await service.list({ page: 1, limit: 500 }, user);

      const params = filesRepository.findMany.mock.calls[0][0];
      expect(params.take).toBe(MAX_LIST_LIMIT);
      expect(result.limit).toBe(MAX_LIST_LIMIT);
    });

    it('computes skip and take from page and limit', async () => {
      filesRepository.findMany.mockResolvedValue([]);
      filesRepository.count.mockResolvedValue(0);

      await service.list({ page: 3, limit: 10 }, user);

      const params = filesRepository.findMany.mock.calls[0][0];
      expect(params.skip).toBe(20);
      expect(params.take).toBe(10);
    });

    it('maps every valid sort field and direction', async () => {
      filesRepository.findMany.mockResolvedValue([]);
      filesRepository.count.mockResolvedValue(0);

      await service.list({ page: 1, limit: 20, sort: 'createdAt:desc' }, user);
      expect(filesRepository.findMany.mock.calls[0][0].orderBy).toEqual({
        createdAt: 'desc',
      });

      await service.list({ page: 1, limit: 20, sort: 'createdAt:asc' }, user);
      expect(filesRepository.findMany.mock.calls[1][0].orderBy).toEqual({
        createdAt: 'asc',
      });

      await service.list(
        { page: 1, limit: 20, sort: 'originalName:asc' },
        user,
      );
      expect(filesRepository.findMany.mock.calls[2][0].orderBy).toEqual({
        originalName: 'asc',
      });

      await service.list({ page: 1, limit: 20, sort: 'size:desc' }, user);
      expect(filesRepository.findMany.mock.calls[3][0].orderBy).toEqual({
        sizeBytes: 'desc',
      });
    });

    it('defaults the sort to createdAt:desc', async () => {
      filesRepository.findMany.mockResolvedValue([]);
      filesRepository.count.mockResolvedValue(0);

      await service.list({ page: 1, limit: 20 }, user);

      expect(filesRepository.findMany.mock.calls[0][0].orderBy).toEqual({
        createdAt: 'desc',
      });
    });

    it('rejects invalid sort values with VALIDATION_ERROR', async () => {
      const invalidSorts = [
        'bogus:asc',
        'createdAt',
        'createdAt:up',
        'a:b:c',
        '',
      ];
      for (const sort of invalidSorts) {
        await expectAppError(
          service.list({ page: 1, limit: 20, sort }, user),
          'VALIDATION_ERROR',
        );
      }
      expect(filesRepository.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns the mapped file for the owner', async () => {
      filesRepository.findById.mockResolvedValue(makeFileRow());

      const result = await service.getById('file-1', user);

      expect(filesRepository.findById).toHaveBeenCalledWith('file-1');
      expect(result.id).toBe('file-1');
      expect(result.size).toBe(5);
      expect(result.status).toBe('ACTIVE');
    });

    it('returns the mapped file for an ADMIN accessing another user file', async () => {
      filesRepository.findById.mockResolvedValue(
        makeFileRow({ uploadedBy: 'someone-else' }),
      );

      const result = await service.getById('file-1', admin);

      expect(result.id).toBe('file-1');
    });

    it('rejects with FILE_NOT_FOUND when the file is missing', async () => {
      filesRepository.findById.mockResolvedValue(null);

      await expectAppError(service.getById('missing', user), 'FILE_NOT_FOUND');
    });

    it('rejects with FILE_NOT_FOUND when the file is soft-DELETED', async () => {
      filesRepository.findById.mockResolvedValue(
        makeFileRow({ status: 'DELETED' }),
      );

      await expectAppError(service.getById('file-1', user), 'FILE_NOT_FOUND');
    });

    it('rejects with FILE_NOT_FOUND for a non-owner non-ADMIN user', async () => {
      filesRepository.findById.mockResolvedValue(
        makeFileRow({ uploadedBy: 'someone-else' }),
      );

      await expectAppError(service.getById('file-1', user), 'FILE_NOT_FOUND');
    });
  });

  describe('getPresignedUrl', () => {
    it('returns the presigned URL with expiresAt exactly +15 minutes', async () => {
      filesRepository.findById.mockResolvedValue(makeFileRow());
      minioService.presignedGetObject.mockResolvedValue(
        'http://localhost:9100/app-uploads/key?X-Amz-Expires=900',
      );

      const before = Date.now();
      const result = await service.getPresignedUrl('file-1', user);
      const after = Date.now();

      expect(minioService.presignedGetObject).toHaveBeenCalledWith(
        'user-1/7c1b9d0e-2f4a-4c6e-8a0b-9c8d7e6f5a4b-Invoice-42-EU.pdf',
        900,
      );
      expect(result.url).toBe(
        'http://localhost:9100/app-uploads/key?X-Amz-Expires=900',
      );
      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + 15 * 60 * 1000,
      );
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(
        after + 15 * 60 * 1000,
      );
    });

    it('maps a presign failure to 500 MINIO_UNAVAILABLE', async () => {
      filesRepository.findById.mockResolvedValue(makeFileRow());
      minioService.presignedGetObject.mockRejectedValue(new Error('boom'));

      await expectAppError(
        service.getPresignedUrl('file-1', user),
        'MINIO_UNAVAILABLE',
      );
    });

    it('does not presign for a soft-DELETED file', async () => {
      filesRepository.findById.mockResolvedValue(
        makeFileRow({ status: 'DELETED' }),
      );

      await expectAppError(
        service.getPresignedUrl('file-1', user),
        'FILE_NOT_FOUND',
      );
      expect(minioService.presignedGetObject).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('soft-deletes and returns the updated file without touching MinIO', async () => {
      filesRepository.findById
        .mockResolvedValueOnce(makeFileRow())
        .mockResolvedValueOnce(
          makeFileRow({
            status: 'DELETED',
            updatedAt: new Date('2026-10-13T09:20:00.000Z'),
          }),
        );
      filesRepository.softDelete.mockResolvedValue(1);

      const result = await service.remove('file-1', user);

      expect(filesRepository.softDelete).toHaveBeenCalledWith('file-1');
      expect(result.status).toBe('DELETED');
      expect(minioService.removeObject).not.toHaveBeenCalled();
    });

    it('rejects a repeat delete of an already-DELETED file with FILE_NOT_FOUND', async () => {
      filesRepository.findById.mockResolvedValue(
        makeFileRow({ status: 'DELETED' }),
      );

      await expectAppError(service.remove('file-1', user), 'FILE_NOT_FOUND');
      expect(filesRepository.softDelete).not.toHaveBeenCalled();
    });

    it('rejects with FILE_NOT_FOUND when the guarded update matches nothing', async () => {
      filesRepository.findById.mockResolvedValue(makeFileRow());
      filesRepository.softDelete.mockResolvedValue(0);

      await expectAppError(service.remove('file-1', user), 'FILE_NOT_FOUND');
    });
  });
});
