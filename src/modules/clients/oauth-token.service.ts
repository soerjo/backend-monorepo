import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClientRateLimiterService } from './client-rate-limiter.service.js';
import { verifySecretHash } from './client-secrets.util.js';
import { M2M_TOKEN_TTL_SECONDS } from './clients.constants.js';
import { ClientsRepository } from './clients.repository.js';
import { ClientCredentialsDto } from './dto/client-credentials.dto.js';

export interface ClientCredentialsTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
}

@Injectable()
export class OauthTokenService {
  constructor(
    private readonly clientsRepository: ClientsRepository,
    private readonly clientRateLimiter: ClientRateLimiterService,
    private readonly jwtService: JwtService,
  ) {}

  async issueClientCredentialsToken(
    dto: ClientCredentialsDto,
  ): Promise<ClientCredentialsTokenResponse> {
    const client = await this.clientsRepository.findByClientId(dto.client_id);
    if (!client || !client.active) {
      throw new UnauthorizedException('invalid_client');
    }

    if (!verifySecretHash(dto.client_secret, client.clientSecretHash)) {
      throw new UnauthorizedException('invalid_client');
    }

    const rateLimit = this.clientRateLimiter.consume(
      client.clientId,
      client.rateLimitPerMinute,
    );
    if (!rateLimit.allowed) {
      throw new HttpException(
        { error: 'too_many_requests', retry_after_ms: rateLimit.retryAfterMs },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.clientsRepository.touchLastUsed(client.id, new Date());

    const accessToken = this.jwtService.sign({
      sub: client.clientId,
      azp: client.clientId,
      scopes: client.scopes,
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: M2M_TOKEN_TTL_SECONDS,
      scope: client.scopes.join(' '),
    };
  }
}
