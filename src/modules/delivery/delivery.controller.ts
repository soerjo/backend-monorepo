import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DeliveryService } from './delivery.service.js';
import { Public } from '../../common/decorators/public.decorator.js';
import type { Response } from 'express';

@ApiTags('delivery')
@Public()
@Controller('delivery/v1')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get('content')
  @ApiOperation({ summary: 'Public list of published content entries' })
  @ApiQuery({ name: 'contentType', required: false })
  @ApiQuery({ name: 'locale', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'tag', required: false })
  @ApiQuery({ name: 'slug', required: false })
  getPublishedContent(
    @Query('contentType') contentType?: string,
    @Query('locale') locale?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tag') tag?: string,
    @Query('slug') slug?: string,
  ) {
    return this.deliveryService.findPublishedContent({
      contentType,
      locale,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      tag,
      slug,
    });
  }

  @Get('content/:slug')
  @ApiOperation({ summary: 'Get published content entry by slug' })
  @ApiQuery({ name: 'contentType', required: false })
  @ApiQuery({ name: 'locale', required: false })
  getPublishedBySlug(
    @Param('slug') slug: string,
    @Query('contentType') contentType?: string,
    @Query('locale') locale?: string,
  ) {
    return this.deliveryService.findPublishedBySlug(slug, contentType, locale);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List all categories' })
  getCategories() {
    return this.deliveryService.getCategories();
  }

  @Get('tags')
  @ApiOperation({ summary: 'List all tags' })
  getTags() {
    return this.deliveryService.getTags();
  }

  @Get('media/:storageKey(*)')
  @ApiOperation({ summary: 'Stream media file by storageKey' })
  async getMedia(
    @Param('storageKey') storageKey: string,
    @Res() res: Response,
  ) {
    return this.deliveryService.streamMedia(storageKey, res);
  }
}
