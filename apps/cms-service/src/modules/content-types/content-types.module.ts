import { Module } from '@nestjs/common';
import { ContentTypesController } from './content-types.controller.js';
import { ContentTypesService } from './content-types.service.js';
import { ContentTypesRepository } from './content-types.repository.js';

@Module({
  controllers: [ContentTypesController],
  providers: [ContentTypesService, ContentTypesRepository],
  exports: [ContentTypesService, ContentTypesRepository],
})
export class ContentTypesModule {}
