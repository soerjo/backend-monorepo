import * as fs from 'node:fs';
import * as path from 'node:path';

export function loadUmsPublicKey(
  publicKeyEnv?: string,
  publicKeyPathEnv?: string,
): string {
  const hasKey = Boolean(publicKeyEnv && publicKeyEnv.trim().length > 0);
  const hasPath = Boolean(
    publicKeyPathEnv && publicKeyPathEnv.trim().length > 0,
  );

  if (hasKey && hasPath) {
    throw new Error(
      'Cannot specify both UMS_JWT_PUBLIC_KEY and UMS_JWT_PUBLIC_KEY_PATH. Choose one.',
    );
  }
  if (!hasKey && !hasPath) {
    throw new Error(
      'Must specify either UMS_JWT_PUBLIC_KEY or UMS_JWT_PUBLIC_KEY_PATH for UMS JWT verification.',
    );
  }

  if (hasKey) {
    return (publicKeyEnv as string).replace(/\\n/g, '\n');
  }

  const resolvedPath = path.isAbsolute(publicKeyPathEnv as string)
    ? (publicKeyPathEnv as string)
    : path.resolve(process.cwd(), publicKeyPathEnv as string);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `UMS public key file does not exist at: ${resolvedPath}`,
    );
  }

  return fs.readFileSync(resolvedPath, 'utf8');
}
