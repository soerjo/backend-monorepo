import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface FileServiceTokenProvider {
  getToken(): Promise<string>;
}

@Injectable()
export class HttpFileServiceTokenProvider implements FileServiceTokenProvider {
  private readonly logger = new Logger(HttpFileServiceTokenProvider.name);
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private configService: ConfigService) {}

  async getToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && now < this.tokenExpiresAt - 30000) {
      return this.cachedToken;
    }
    await this.login();
    return this.cachedToken as string;
  }

  async login(forceRefresh = false): Promise<string> {
    void forceRefresh;
    const fileServiceUrl = this.configService.get<string>('FILE_SERVICE_URL');
    const email = this.configService.get<string>('FILE_SERVICE_EMAIL');
    const password = this.configService.get<string>('FILE_SERVICE_PASSWORD');
    const timeoutMs = Number(
      this.configService.get<string>('FILE_SERVICE_TIMEOUT_MS', '10000'),
    );

    const loginEndpoint = `${fileServiceUrl?.replace(/\/$/, '')}/auth/login`;

    try {
      const response = await fetch(loginEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        throw new Error(
          `File service login failed with status ${response.status}`,
        );
      }

      const json = (await response.json()) as Record<string, unknown>;
      const accessToken =
        (json['accessToken'] as string) ||
        ((json['data'] as Record<string, unknown>)?.[
          'accessToken'
        ] as string) ||
        (json['token'] as string) ||
        ((json['data'] as Record<string, unknown>)?.['token'] as string);

      if (!accessToken) {
        throw new Error('No access token returned from file service login');
      }

      this.cachedToken = accessToken;
      this.tokenExpiresAt = Date.now() + 3600 * 1000;
      return this.cachedToken;
    } catch (err) {
      this.logger.error(`Failed to login to file service: ${err}`);
      throw err;
    }
  }

  async fetchWithAuth(url: string, init: RequestInit = {}): Promise<Response> {
    const timeoutMs = Number(
      this.configService.get<string>('FILE_SERVICE_TIMEOUT_MS', '10000'),
    );
    let token = await this.getToken();

    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${token}`);

    let response = await fetch(url, {
      ...init,
      headers,
      signal: init.signal || AbortSignal.timeout(timeoutMs),
    });

    if (response.status === 401) {
      this.logger.warn(
        'Received 401 from file service, attempting re-login and retry...',
      );
      token = await this.login(true);
      headers.set('Authorization', `Bearer ${token}`);
      response = await fetch(url, {
        ...init,
        headers,
        signal: init.signal || AbortSignal.timeout(timeoutMs),
      });
    }

    return response;
  }
}
