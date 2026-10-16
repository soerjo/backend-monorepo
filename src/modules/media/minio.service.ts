import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { imageSize } from 'image-size';
import { randomUUID } from 'crypto';

@Injectable()
export class MinioService implements OnModuleInit {
  private client: Minio.Client;
  private bucket: string;
  private publicUrlBase?: string;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>(
      'MINIO_ENDPOINT',
      'localhost',
    );
    const port = Number(this.configService.get<string>('MINIO_PORT', '9000'));
    const useSsl =
      this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true';
    const accessKey = this.configService.get<string>(
      'MINIO_ACCESS_KEY',
      'minioadmin',
    );
    const secretKey = this.configService.get<string>(
      'MINIO_SECRET_KEY',
      'minioadmin',
    );
    this.bucket = this.configService.get<string>('MINIO_BUCKET', 'cms-media');
    this.publicUrlBase = this.configService.get<string>(
      'MEDIA_PUBLIC_URL_BASE',
    );

    this.client = new Minio.Client({
      endPoint: endpoint,
      port: port,
      useSSL: useSsl,
      accessKey: accessKey,
      secretKey: secretKey,
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, '');
      }
    } catch (err) {
      console.error('Failed to initialize MinIO bucket:', err);
    }
  }

  async uploadFile(file: Express.Multer.File, uploadedById: string) {
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
    ];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(`Invalid mime type: ${file.mimetype}`);
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const fileId = randomUUID();
    const ext = file.originalname.split('.').pop() || 'bin';
    const storageKey = `cms/${yyyy}/${mm}/${fileId}.${ext}`;

    let width: number | undefined;
    let height: number | undefined;

    if (file.mimetype.startsWith('image/')) {
      try {
        const dimensions = imageSize(file.buffer);
        width = dimensions.width;
        height = dimensions.height;
      } catch {
        // ignore dimension extraction errors
      }
    }

    await this.client.putObject(
      this.bucket,
      storageKey,
      file.buffer,
      file.size,
      {
        'Content-Type': file.mimetype,
      },
    );

    const url = this.publicUrlBase
      ? `${this.publicUrlBase}/${storageKey}`
      : `http${this.configService.get('MINIO_USE_SSL') === 'true' ? 's' : ''}://${this.configService.get('MINIO_ENDPOINT')}:${this.configService.get('MINIO_PORT')}/${this.bucket}/${storageKey}`;

    return {
      fileName: `${fileId}.${ext}`,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storageKey,
      url,
      width,
      height,
      uploadedById,
    };
  }

  async deleteFile(storageKey: string) {
    await this.client.removeObject(this.bucket, storageKey);
  }

  async getObjectStream(storageKey: string) {
    return this.client.getObject(this.bucket, storageKey);
  }
}
