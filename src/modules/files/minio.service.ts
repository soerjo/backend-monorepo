import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly client: Minio.Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT')!,
      port: Number(this.configService.get<string>('MINIO_PORT')!),
      useSSL: this.configService.get<string>('MINIO_USE_SSL') === 'true',
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY')!,
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY')!,
    });
    this.bucket = this.configService.get<string>('MINIO_BUCKET')!;
  }

  get bucketName(): string {
    return this.bucket;
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucket();
  }

  async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (exists) {
      this.logger.log(`MinIO bucket "${this.bucket}" is available`);
      return;
    }
    await this.client.makeBucket(this.bucket);
    this.logger.log(`MinIO bucket "${this.bucket}" created`);
  }

  async putObject(
    objectKey: string,
    body: Buffer,
    size: number,
    contentType: string,
  ): Promise<void> {
    await this.client.putObject(this.bucket, objectKey, body, size, {
      'Content-Type': contentType,
    });
  }

  async presignedGetObject(
    objectKey: string,
    expirySeconds: number,
  ): Promise<string> {
    return this.client.presignedGetObject(
      this.bucket,
      objectKey,
      expirySeconds,
    );
  }

  async removeObject(objectKey: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectKey);
  }
}
