import { $Enums, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_USERS = [
  {
    email: 'admin@minio.local',
    password: 'Admin#12345',
    firstName: 'Admin',
    lastName: 'Minio',
    role: $Enums.RoleName.ADMIN,
    organizationSlug: 'admin',
  },
  {
    email: 'soerjo@minio.local',
    password: 'Soerjo#12345',
    firstName: 'Soerjo',
    lastName: null,
    role: $Enums.RoleName.USER,
    organizationSlug: 'soerjo',
  },
];

async function main(): Promise<void> {
  for (const defaultUser of DEFAULT_USERS) {
    const hashedPassword = await bcrypt.hash(defaultUser.password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.upsert({
        where: { slug: defaultUser.organizationSlug },
        create: {
          name: `Organization of ${defaultUser.email}`,
          slug: defaultUser.organizationSlug,
        },
        update: {},
      });

      return tx.user.upsert({
        where: { email: defaultUser.email },
        create: {
          email: defaultUser.email,
          password: hashedPassword,
          firstName: defaultUser.firstName,
          lastName: defaultUser.lastName,
          role: defaultUser.role,
          organizationId: organization.id,
        },
        update: {
          password: hashedPassword,
          firstName: defaultUser.firstName,
          lastName: defaultUser.lastName,
          role: defaultUser.role,
        },
      });
    });

    console.log(
      `Seeded ${user.email} (role=${user.role}) into organization "${defaultUser.organizationSlug}"`,
    );
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
