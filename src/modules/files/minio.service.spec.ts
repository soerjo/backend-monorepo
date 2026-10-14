import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { MinioService } from './minio.service.js';

interface ClientAddress {
  host: string;
  port: number;
}

type EnvValues = Record<string, string | undefined>;

function makeConfigService(values: EnvValues): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

const internalValues: EnvValues = {
  MINIO_ENDPOINT: '172.19.0.250',
  MINIO_PORT: '9000',
  MINIO_USE_SSL: 'false',
  MINIO_ACCESS_KEY: 'access-key',
  MINIO_SECRET_KEY: 'secret-key',
  MINIO_BUCKET: 'app-uploads',
};

function getAddress(client: Minio.Client): ClientAddress {
  return client as unknown as ClientAddress;
}

describe('MinioService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('presignedGetObject', () => {
    it('signs the URL with the public endpoint when it differs from the internal one', async () => {
      const service = new MinioService(
        makeConfigService({
          ...internalValues,
          MINIO_PUBLIC_ENDPOINT: '100.92.245.124',
          MINIO_PUBLIC_PORT: '9100',
        }),
      );
      jest
        .spyOn(Minio.Client.prototype, 'presignedGetObject')
        .mockImplementation(function (this: Minio.Client) {
          const { host, port } = getAddress(this);
          return Promise.resolve(`http://${host}:${port}/app-uploads/key`);
        });

      const url = await service.presignedGetObject('key', 900);

      expect(url).toBe('http://100.92.245.124:9100/app-uploads/key');
    });

    it('falls back to the internal endpoint when the public vars are unset', async () => {
      const service = new MinioService(makeConfigService(internalValues));
      jest
        .spyOn(Minio.Client.prototype, 'presignedGetObject')
        .mockImplementation(function (this: Minio.Client) {
          const { host, port } = getAddress(this);
          return Promise.resolve(`http://${host}:${port}/app-uploads/key`);
        });

      const url = await service.presignedGetObject('key', 900);

      expect(url).toBe('http://172.19.0.250:9000/app-uploads/key');
    });

    it('falls back to the internal port when only the public endpoint is set', async () => {
      const service = new MinioService(
        makeConfigService({
          ...internalValues,
          MINIO_PUBLIC_ENDPOINT: '100.92.245.124',
        }),
      );
      jest
        .spyOn(Minio.Client.prototype, 'presignedGetObject')
        .mockImplementation(function (this: Minio.Client) {
          const { host, port } = getAddress(this);
          return Promise.resolve(`http://${host}:${port}/app-uploads/key`);
        });

      const url = await service.presignedGetObject('key', 900);

      expect(url).toBe('http://100.92.245.124:9000/app-uploads/key');
    });

    it('lazily builds the signing client on first use and reuses it', async () => {
      const service = new MinioService(
        makeConfigService({
          ...internalValues,
          MINIO_PUBLIC_ENDPOINT: '100.92.245.124',
          MINIO_PUBLIC_PORT: '9100',
        }),
      );
      const seenHosts: string[] = [];
      jest
        .spyOn(Minio.Client.prototype, 'presignedGetObject')
        .mockImplementation(function (this: Minio.Client) {
          seenHosts.push(getAddress(this).host);
          return Promise.resolve('http://signed/key');
        });

      await service.presignedGetObject('key-1', 900);
      await service.presignedGetObject('key-2', 900);

      expect(seenHosts).toEqual(['100.92.245.124', '100.92.245.124']);
    });

    it('signs against the provided bucket instead of the configured default', async () => {
      const service = new MinioService(makeConfigService(internalValues));
      const seenBuckets: string[] = [];
      jest
        .spyOn(Minio.Client.prototype, 'presignedGetObject')
        .mockImplementation(function (this: Minio.Client, bucket: string) {
          seenBuckets.push(bucket);
          return Promise.resolve(`http://signed/${bucket}/key`);
        });

      const url = await service.presignedGetObject('key', 900, 'test');

      expect(seenBuckets).toEqual(['test']);
      expect(url).toBe('http://signed/test/key');
    });

    it('defaults to the configured bucket when no bucket is provided', async () => {
      const service = new MinioService(makeConfigService(internalValues));
      const seenBuckets: string[] = [];
      jest
        .spyOn(Minio.Client.prototype, 'presignedGetObject')
        .mockImplementation(function (this: Minio.Client, bucket: string) {
          seenBuckets.push(bucket);
          return Promise.resolve(`http://signed/${bucket}/key`);
        });

      await service.presignedGetObject('key', 900);

      expect(seenBuckets).toEqual(['app-uploads']);
    });
  });

  describe('data operations', () => {
    it('keeps put/remove/bucket checks on the internal client when a public endpoint is set', async () => {
      const service = new MinioService(
        makeConfigService({
          ...internalValues,
          MINIO_PUBLIC_ENDPOINT: '100.92.245.124',
          MINIO_PUBLIC_PORT: '9100',
        }),
      );
      const seenHosts: string[] = [];
      jest
        .spyOn(Minio.Client.prototype, 'removeObject')
        .mockImplementation(function (this: Minio.Client) {
          seenHosts.push(getAddress(this).host);
          return Promise.resolve();
        });

      await service.removeObject('key');

      expect(seenHosts).toEqual(['172.19.0.250']);
    });

    it('reuses the internal client for signing when the public endpoint matches it', async () => {
      const service = new MinioService(
        makeConfigService({
          ...internalValues,
          MINIO_PUBLIC_ENDPOINT: '172.19.0.250',
          MINIO_PUBLIC_PORT: '9000',
        }),
      );
      jest
        .spyOn(Minio.Client.prototype, 'presignedGetObject')
        .mockImplementation(function (this: Minio.Client) {
          const { host, port } = getAddress(this);
          return Promise.resolve(`http://${host}:${port}/app-uploads/key`);
        });

      const url = await service.presignedGetObject('key', 900);

      expect(url).toBe('http://172.19.0.250:9000/app-uploads/key');
    });

    it('does not throw at construction when the public vars are unset', () => {
      expect(
        () => new MinioService(makeConfigService(internalValues)),
      ).not.toThrow();
    });
  });
});
