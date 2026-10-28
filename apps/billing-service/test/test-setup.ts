import { config } from 'dotenv';

config({ path: '.env' });

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://user:pass@localhost:5432/billing_db';
process.env.UMS_JWT_PUBLIC_KEY =
  process.env.UMS_JWT_PUBLIC_KEY ||
  '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Y8+test\n-----END PUBLIC KEY-----';
process.env.MIDTRANS_SERVER_KEY =
  process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-testkey12345';
process.env.MIDTRANS_CLIENT_KEY =
  process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-testkey12345';
process.env.THROTTLE_TTL = '60';
process.env.THROTTLE_LIMIT = '100';
