import { PrismaClient } from '@/database/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

import { users } from './seeds/user.seed';
import { awsAccounts } from './seeds/aws.seed';
import { projects } from './seeds/projects.seed';
import { projectMembers } from './seeds/project-members.seed';
import { projectAwsAccounts } from './seeds/project-aws.seed';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // ลบตารางลูกก่อน เพราะมี Foreign Key
  await prisma.projectMember.deleteMany();
  await prisma.projectAwsAccount.deleteMany();

  await prisma.project.deleteMany();
  await prisma.awsAccount.deleteMany();
  await prisma.user.deleteMany();

  // Users
  const hashedUsers = await Promise.all(
    users.map(async ({ password, ...user }) => ({
      ...user,
      passwordHash: await bcrypt.hash(password, 10)
    }))
  );

  await prisma.user.createMany({
    data: hashedUsers
  });

  const admin = await prisma.user.findUnique({
    where: {
      email: 'admin@crgp.com'
    },
    select: {
      id: true
    }
  });

  if (!admin) {
    throw new Error('Seed admin user not found');
  }

  // AWS Accounts
  await prisma.awsAccount.createMany({
    data: awsAccounts
  });

  // Projects (เอาเฉพาะ Adminสร้าง Project ไปก่อน)

  await prisma.project.createMany({
    data: projects.map((project) => ({
      ...project,
      createdById: admin.id
    }))
  });

  // Project Members

  for (const member of projectMembers) {
    const project = await prisma.project.findUnique({
      where: {
        projectCode: member.projectCode
      },
      select: {
        id: true
      }
    });

    const user = await prisma.user.findUnique({
      where: {
        email: member.userEmail
      },
      select: {
        id: true
      }
    });

    if (!project) {
      throw new Error(`Project not found: ${member.projectCode}`);
    }

    if (!user) {
      throw new Error(`User not found: ${member.userEmail}`);
    }

    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: user.id,
        memberRole: member.memberRole
      }
    });
  }

  // Project AWS Accounts (ให้ linkedById เป็น Admin ไปก่อน)

  for (const relation of projectAwsAccounts) {
    const project = await prisma.project.findUnique({
      where: {
        projectCode: relation.projectCode
      },
      select: {
        id: true
      }
    });

    const awsAccount = await prisma.awsAccount.findUnique({
      where: {
        awsAccountId: relation.awsAccountNumber
      },
      select: {
        id: true
      }
    });

    const linkedBy = await prisma.user.findUnique({
      where: {
        email: relation.linkedByEmail
      },
      select: {
        id: true
      }
    });

    if (!project) {
      throw new Error(`Project not found: ${relation.projectCode}`);
    }

    if (!awsAccount) {
      throw new Error(`AWS account not found: ${relation.awsAccountNumber}`);
    }

    if (!linkedBy) {
      throw new Error(`Linked user not found: ${relation.linkedByEmail}`);
    }

    await prisma.projectAwsAccount.create({
      data: {
        projectId: project.id,
        awsAccountId: awsAccount.id,
        linkedById: linkedBy.id
      }
    });
  }
}

main()
  .then(async () => {
    console.log('🌱 Seed completed');
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
