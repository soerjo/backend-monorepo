import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import { parseRedisUrl } from '../../common/utils/redis-url.util.js';
import {
  MAX_ATTEMPTS,
  getBackoffDelayMs,
  getRetryOptions,
} from '../../common/utils/backoff.util.js';
import { NotificationsDispatcher } from './notifications.dispatcher.js';

export const NOTIFICATIONS_QUEUE_NAME = 'notifications';
export const NOTIFICATION_DISPATCH_JOB = 'dispatch';

interface DispatchJobData {
  notificationId: string;
}

type BullConnection = ReturnType<typeof parseRedisUrl> & {
  maxRetriesPerRequest: null;
};

@Injectable()
export class NotificationsQueueService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationsQueueService.name);
  private readonly connection: BullConnection;
  private readonly enabled: boolean;
  private readonly queue: Queue;
  private worker: Worker | null = null;

  constructor(
    configService: ConfigService,
    private readonly dispatcher: NotificationsDispatcher,
  ) {
    const redisUrl = configService.get<string>('REDIS_URL')!;
    this.connection = {
      ...parseRedisUrl(redisUrl),
      maxRetriesPerRequest: null,
    };
    this.enabled =
      configService.get<string>('NOTIFICATIONS_WORKER_ENABLED') !== 'false';
    this.queue = new Queue(NOTIFICATIONS_QUEUE_NAME, {
      connection: this.connection,
    });
  }

  async enqueue(notificationId: string): Promise<void> {
    await this.queue.add(
      NOTIFICATION_DISPATCH_JOB,
      { notificationId },
      {
        jobId: notificationId,
        ...getRetryOptions(),
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.warn('Notifications worker is disabled');
      return;
    }

    this.worker = new Worker(
      NOTIFICATIONS_QUEUE_NAME,
      (job) => this.process(job as Job<DispatchJobData>),
      {
        connection: this.connection,
        settings: { backoffStrategy: getBackoffDelayMs },
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Dispatch job ${job.id} completed`);
    });
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Dispatch job ${job?.id ?? 'unknown'} failed: ${error.message}`,
      );
    });
    this.worker.on('error', (error) => {
      this.logger.error(`Notifications worker error: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
  }

  private async process(job: Job<DispatchJobData>): Promise<void> {
    const attempt = (job.attemptsMade ?? 0) + 1;
    const maxAttempts = job.opts.attempts ?? MAX_ATTEMPTS;
    await this.dispatcher.dispatch({
      notificationId: job.data.notificationId,
      attempt,
      maxAttempts,
    });
  }
}
