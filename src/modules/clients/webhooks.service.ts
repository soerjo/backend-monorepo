import { Injectable } from '@nestjs/common';
import { generateClientSecret } from './client-secrets.util.js';
import { WEBHOOK_TEST_EVENT } from './clients.constants.js';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto.js';
import { UpdateWebhookEndpointDto } from './dto/update-webhook-endpoint.dto.js';
import { WebhookDispatcherService } from './webhook-dispatcher.service.js';
import { WebhookSecretService } from './webhook-secret.service.js';
import { WebhooksRepository } from './webhooks.repository.js';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly webhooksRepository: WebhooksRepository,
    private readonly webhookSecretService: WebhookSecretService,
    private readonly webhookDispatcher: WebhookDispatcherService,
  ) {}

  findAll() {
    return this.webhooksRepository.findAll();
  }

  findById(id: string) {
    return this.webhooksRepository.findById(id);
  }

  async create(dto: CreateWebhookEndpointDto) {
    const secret = generateClientSecret();
    const endpoint = await this.webhooksRepository.create({
      url: dto.url,
      events: dto.events,
      active: dto.active ?? true,
      ...this.webhookSecretService.protect(secret),
    });
    return { ...endpoint, secret };
  }

  update(id: string, dto: UpdateWebhookEndpointDto) {
    return this.webhooksRepository.update(id, dto);
  }

  remove(id: string) {
    return this.webhooksRepository.remove(id);
  }

  async sendTest(id: string) {
    await this.webhooksRepository.findById(id);
    return this.webhookDispatcher.dispatch(
      WEBHOOK_TEST_EVENT,
      { endpointId: id, testAt: new Date().toISOString() },
      { endpointIds: [id] },
    );
  }
}
