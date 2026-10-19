import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import type { WebhookEndpoint } from '@prisma/client';
import {
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_REQUEST_TIMEOUT_MS,
  WEBHOOK_RETRY_DELAY_MS,
} from './clients.constants.js';
import { WebhookSecretService } from './webhook-secret.service.js';
import { WebhooksRepository } from './webhooks.repository.js';

export type WebhookDeliveryStatusValue = 'SUCCESS' | 'FAILED';

export interface DispatchOptions {
  endpointIds?: string[];
  retryDelayMs?: number;
}

export interface WebhookDeliveryResult {
  endpointId: string;
  event: string;
  attempt: number;
  status: WebhookDeliveryStatusValue;
  responseCode: number | null;
  latencyMs: number;
}

@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);

  constructor(
    private readonly webhooksRepository: WebhooksRepository,
    private readonly webhookSecretService: WebhookSecretService,
  ) {}

  async dispatch(
    event: string,
    payload: Record<string, unknown>,
    options: DispatchOptions = {},
  ): Promise<WebhookDeliveryResult[]> {
    const endpoints = options.endpointIds?.length
      ? await this.webhooksRepository.findActiveByIds(options.endpointIds)
      : await this.webhooksRepository.findActiveByEvent(event);

    const retryDelayMs = options.retryDelayMs ?? WEBHOOK_RETRY_DELAY_MS;
    const results: WebhookDeliveryResult[] = [];
    for (const endpoint of endpoints) {
      results.push(
        ...(await this.deliver(endpoint, event, payload, retryDelayMs)),
      );
    }
    return results;
  }

  buildSignature(secret: string, rawBody: string): string {
    return createHmac('sha256', secret).update(rawBody).digest('hex');
  }

  private async deliver(
    endpoint: WebhookEndpoint,
    event: string,
    payload: Record<string, unknown>,
    retryDelayMs: number,
  ): Promise<WebhookDeliveryResult[]> {
    const body = JSON.stringify({
      id: randomUUID(),
      event,
      occurredAt: new Date().toISOString(),
      data: payload,
    });
    const signature = this.buildSignature(
      this.webhookSecretService.reveal(endpoint.secretEnc),
      body,
    );

    const attempts: WebhookDeliveryResult[] = [];
    for (let attempt = 1; attempt <= WEBHOOK_MAX_ATTEMPTS; attempt += 1) {
      const startedAt = Date.now();
      let responseCode: number | null = null;
      let status: WebhookDeliveryStatusValue = 'FAILED';

      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-signature': signature,
          },
          body,
          signal: AbortSignal.timeout(WEBHOOK_REQUEST_TIMEOUT_MS),
        });
        responseCode = response.status;
        status = response.ok ? 'SUCCESS' : 'FAILED';
      } catch (error) {
        this.logger.warn(
          `Webhook delivery to ${endpoint.id} attempt ${attempt} failed: ${
            (error as Error).message
          }`,
        );
      }

      const latencyMs = Date.now() - startedAt;
      await this.webhooksRepository.createDelivery({
        endpointId: endpoint.id,
        event,
        status,
        attempt,
        responseCode,
        latencyMs,
      });
      attempts.push({
        endpointId: endpoint.id,
        event,
        attempt,
        status,
        responseCode,
        latencyMs,
      });

      if (status === 'SUCCESS') {
        break;
      }
      if (attempt < WEBHOOK_MAX_ATTEMPTS) {
        await this.sleep(retryDelayMs);
      }
    }

    return attempts;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
