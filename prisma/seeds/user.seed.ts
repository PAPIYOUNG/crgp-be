import { Department, SystemRole } from '@/database/generated/prisma/enums';

export const users = [
  {
    firstName: 'System',
    lastName: 'Admin',
    email: 'admin@crgp.com',
    password: 'papi4567',
    role: SystemRole.ADMIN,
    department: Department.IT
  },
  {
    firstName: 'Alice',
    lastName: 'Johnson',
    email: 'alice@crgp.com',
    password: 'papi4567',
    role: SystemRole.USER,
    department: Department.IT
  },
  {
    firstName: 'Bob',
    lastName: 'Smith',
    email: 'bob@crgp.com',
    password: 'papi4567',
    role: SystemRole.USER,
    department: Department.ENGINEERING
  },
  {
    firstName: 'Charlie',
    lastName: 'Brown',
    email: 'charlie@crgp.com',
    password: 'papi4567',
    role: SystemRole.USER,
    department: Department.SECURITY
  },
  {
    firstName: 'David',
    lastName: 'Lee',
    email: 'david@crgp.com',
    password: 'papi4567',
    role: SystemRole.USER,
    department: Department.OPERATIONS
  },
  {
    firstName: 'Emma',
    lastName: 'Wilson',
    email: 'emma@crgp.com',
    password: 'papi4567',
    role: SystemRole.USER,
    department: Department.FINANCE
  }
];
