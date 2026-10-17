import { PrismaClient, $Enums } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const ARGON2_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

const ADMIN_ROLE = 'ums:admin';
const DEFAULT_ORG = 'pesanggrahan';

async function main() {
  const email = process.env.UMS_ADMIN_EMAIL;
  const password = process.env.UMS_ADMIN_PASSWORD;
  const name = process.env.UMS_ADMIN_NAME ?? 'UMS Admin';

  if (!email || !password) {
    throw new Error(
      'UMS_ADMIN_EMAIL and UMS_ADMIN_PASSWORD must be set to seed the initial admin.',
    );
  }

  // Hash before any write so re-runs stay idempotent yet always honour the
  // current env password.
  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

  const adminRole = await prisma.role.upsert({
    where: { name: ADMIN_ROLE },
    create: { name: ADMIN_ROLE, description: 'UMS administrator' },
    update: {},
  });

  const organization = await prisma.organization.upsert({
    where: { name: DEFAULT_ORG },
    create: { name: DEFAULT_ORG, description: 'Default organization' },
    update: {},
  });

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      name,
      status: $Enums.UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
    update: { passwordHash, name },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
    create: { userId: user.id, roleId: adminRole.id },
    update: {},
  });

  await prisma.orgMember.upsert({
    where: { orgId_userId: { orgId: organization.id, userId: user.id } },
    create: { orgId: organization.id, userId: user.id, role: 'admin' },
    update: { role: 'admin' },
  });

  console.log(
    `Seeded admin ${email} (role ${ADMIN_ROLE}, organization ${DEFAULT_ORG}).`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error('Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
