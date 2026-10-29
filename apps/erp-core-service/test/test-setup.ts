process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.UMS_JWKS_URL = 'http://localhost:3001/.well-known/jwks.json';
process.env.UMS_JWT_PUBLIC_KEY =
  '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE+\n-----END PUBLIC KEY-----';
process.env.FRONTEND_URL = 'http://localhost:5173';
