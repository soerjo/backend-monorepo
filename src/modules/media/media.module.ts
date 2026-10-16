import { Module } from '@nestjs/common';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { MediaRepository } from './media.repository.js';
import { HttpFileServiceTokenProvider } from './file-service.client.js';

@Module({
  controllers: [MediaController],
  providers: [MediaService, MediaRepository, HttpFileServiceTokenProvider],
  exports: [MediaService, MediaRepository, HttpFileServiceTokenProvider],
})
export class MediaModule {}
