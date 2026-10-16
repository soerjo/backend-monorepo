import { Injectable } from '@nestjs/common';
import { MediaRepository } from './media.repository.js';
import { MinioService } from './minio.service.js';

@Injectable()
export class MediaService {
  constructor(
    private repo: MediaRepository,
    private minioService: MinioService,
  ) {}

  async upload(file: Express.Multer.File, uploadedById: string) {
    const meta = await this.minioService.uploadFile(file, uploadedById);
    return this.repo.create(meta);
  }

  findAll(skip?: number, take?: number) {
    return this.repo.findAll(skip, take);
  }

  findById(id: string) {
    return this.repo.findById(id);
  }

  async delete(id: string) {
    const asset = await this.repo.delete(id);
    try {
      await this.minioService.deleteFile(asset.storageKey);
    } catch {
      // ignore if object already removed from storage
    }
    return asset;
  }

  async getObjectStream(storageKey: string) {
    return this.minioService.getObjectStream(storageKey);
  }
}
