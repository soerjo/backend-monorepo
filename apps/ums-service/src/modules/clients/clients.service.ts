import { Injectable } from '@nestjs/common';
import { ClientsRepository } from './clients.repository.js';
import {
  generateClientId,
  generateClientSecret,
  hashSecret,
} from './client-secrets.util.js';
import { DEFAULT_CLIENT_RATE_LIMIT_PER_MINUTE } from './clients.constants.js';
import { CreateApiClientDto } from './dto/create-api-client.dto.js';
import { UpdateApiClientDto } from './dto/update-api-client.dto.js';

@Injectable()
export class ClientsService {
  constructor(private readonly clientsRepository: ClientsRepository) {}

  findAll() {
    return this.clientsRepository.findAll();
  }

  findById(id: string) {
    return this.clientsRepository.findById(id);
  }

  async create(dto: CreateApiClientDto) {
    const clientSecret = generateClientSecret();
    const client = await this.clientsRepository.create({
      name: dto.name,
      clientId: generateClientId(),
      clientSecretHash: hashSecret(clientSecret),
      scopes: dto.scopes ?? [],
      rateLimitPerMinute:
        dto.rateLimitPerMinute ?? DEFAULT_CLIENT_RATE_LIMIT_PER_MINUTE,
    });
    return { ...client, clientSecret };
  }

  update(id: string, dto: UpdateApiClientDto) {
    return this.clientsRepository.update(id, dto);
  }

  revoke(id: string) {
    return this.clientsRepository.revoke(id);
  }
}
