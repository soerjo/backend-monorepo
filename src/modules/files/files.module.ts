import { Module } from '@nestjs/common';
import { FilesController } from './files.controller.js';
import { FilesService } from './files.service.js';
import { FilesRepository } from './files.repository.js';
import { MinioService } from './minio.service.js';

@Module({
  controllers: [FilesController],
  providers: [FilesService, FilesRepository, MinioService],
})
export class FilesModule {}
