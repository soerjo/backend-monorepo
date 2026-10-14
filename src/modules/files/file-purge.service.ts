import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { FilesRepository } from './files.repository.js';
import { MinioService } from './minio.service.js';
import { MS_PER_DAY, PURGE_BATCH_SIZE } from './files.constants.js';

export interface PurgeSummary {
  scanned: number;
  purged: number;
  bytes: number;
}

@Injectable()
export class FilePurgeService {
  private readonly logger = new Logger(FilePurgeService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly filesRepository: FilesRepository,
    private readonly minioService: MinioService,
  ) {}

  @Cron('0 4 * * 1')
  async handleCron(): Promise<void> {
    await this.purge();
  }

  /**
   * Permanently removes soft-deleted files whose retention window has elapsed.
   * For each candidate the MinIO object is removed first; the DB row is only
   * deleted after that succeeds, so a storage failure leaves the row intact for
   * the next run. Idempotent: rows are deleted, so a second run is a no-op.
   */
  async purge(): Promise<PurgeSummary> {
    if (!this.isEnabled()) {
      this.logger.log(
        'Hard-delete purge skipped (HARD_DELETE_ENABLED is not true)',
      );
      return { scanned: 0, purged: 0, bytes: 0 };
    }

    const cutoff = this.cutoff();
    const summary: PurgeSummary = { scanned: 0, purged: 0, bytes: 0 };

    while (true) {
      const batch = await this.filesRepository.findPurgeable(
        cutoff,
        PURGE_BATCH_SIZE,
      );
      if (batch.length === 0) {
        break;
      }
      summary.scanned += batch.length;

      let purgedInBatch = 0;
      for (const file of batch) {
        try {
          await this.minioService.removeObject(file.objectKey);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Failed to remove MinIO object ${file.objectKey}: ${reason}`,
          );
          continue;
        }
        await this.filesRepository.hardDelete(file.id);
        purgedInBatch += 1;
        summary.purged += 1;
        summary.bytes += file.sizeBytes;
      }

      // A short batch means there is nothing left; a full batch with zero
      // deletions means every removal failed, so stop rather than loop.
      if (batch.length < PURGE_BATCH_SIZE || purgedInBatch === 0) {
        break;
      }
    }

    this.logger.log(
      `Hard-delete purge complete: count=${summary.purged} bytes=${summary.bytes}`,
    );
    return summary;
  }

  private isEnabled(): boolean {
    const value: unknown = this.configService.get('HARD_DELETE_ENABLED');
    return value === true || value === 'true';
  }

  private cutoff(): Date {
    const days =
      this.configService.get<number>('HARD_DELETE_RETENTION_DAYS') ?? 365;
    return new Date(Date.now() - days * MS_PER_DAY);
  }
}
