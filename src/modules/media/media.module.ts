import { Module } from '@nestjs/common';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { MediaRepository } from './media.repository.js';
import { MinioService } from './minio.service.js';

@Module({
  controllers: [MediaController],
  providers: [MediaService, MediaRepository, MinioService],
  exports: [MediaService, MinioService, MediaRepository],
})
export class MediaModule {}
