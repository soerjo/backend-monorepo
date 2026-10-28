import { Module } from '@nestjs/common';
import { DeliveryController } from './delivery.controller.js';
import { DeliveryService } from './delivery.service.js';
import { CategoriesModule } from '../categories/categories.module.js';
import { TagsModule } from '../tags/tags.module.js';
import { MediaModule } from '../media/media.module.js';

@Module({
  imports: [CategoriesModule, TagsModule, MediaModule],
  controllers: [DeliveryController],
  providers: [DeliveryService],
})
export class DeliveryModule {}
