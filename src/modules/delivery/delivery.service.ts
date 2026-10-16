import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CategoriesRepository } from '../categories/categories.repository.js';
import { TagsRepository } from '../tags/tags.repository.js';
import { MediaService } from '../media/media.service.js';
import { ContentStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { Response } from 'express';

@Injectable()
export class DeliveryService {
  constructor(
    private prisma: PrismaService,
    private categoriesRepo: CategoriesRepository,
    private tagsRepo: TagsRepository,
    private mediaService: MediaService,
  ) {}

  async findPublishedContent(query: {
    contentType?: string;
    locale?: string;
    page?: number;
    limit?: number;
    tag?: string;
    slug?: string;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ContentEntryWhereInput = {
      status: ContentStatus.PUBLISHED,
    };

    if (query.locale) {
      where.locale = query.locale;
    }

    if (query.slug) {
      where.slug = query.slug;
    }

    if (query.contentType) {
      const ct = await this.prisma.contentType.findUnique({
        where: { key: query.contentType },
      });
      if (ct) {
        where.contentTypeId = ct.id;
      } else {
        where.contentTypeId = 'non-existent';
      }
    }

    if (query.tag) {
      where.tags = {
        some: {
          tag: {
            OR: [{ id: query.tag }, { key: query.tag }],
          },
        },
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.contentEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: 'desc' },
        include: {
          contentType: true,
          tags: { include: { tag: true } },
        },
      }),
      this.prisma.contentEntry.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findPublishedBySlug(
    slug: string,
    contentTypeKey?: string,
    locale?: string,
  ) {
    const where: Prisma.ContentEntryWhereInput = {
      slug,
      status: ContentStatus.PUBLISHED,
      locale: locale || 'id',
    };

    if (contentTypeKey) {
      const ct = await this.prisma.contentType.findUnique({
        where: { key: contentTypeKey },
      });
      if (ct) {
        where.contentTypeId = ct.id;
      }
    }

    const entry = await this.prisma.contentEntry.findFirst({
      where,
      include: {
        contentType: true,
        tags: { include: { tag: true } },
      },
    });

    if (!entry) {
      throw new NotFoundException(
        `Published entry with slug ${slug} not found`,
      );
    }

    return entry;
  }

  async getCategories() {
    return this.categoriesRepo.findAll();
  }

  async getTags() {
    return this.tagsRepo.findAll();
  }

  async streamMedia(objectKey: string, res: Response) {
    const decodedKey = decodeURIComponent(objectKey);
    const presignedUrl =
      await this.mediaService.getPresignedUrlByObjectKey(decodedKey);
    if (!presignedUrl) {
      throw new NotFoundException(
        `Media with objectKey ${decodedKey} not found`,
      );
    }
    res.redirect(302, presignedUrl);
  }
}
