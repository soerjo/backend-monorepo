import { Module } from '@nestjs/common';
import { TagsController } from './tags.controller.js';
import { TagsService } from './tags.service.js';
import { TagsRepository } from './tags.repository.js';

@Module({
  controllers: [TagsController],
  providers: [TagsService, TagsRepository],
  exports: [TagsService, TagsRepository],
})
export class TagsModule {}
