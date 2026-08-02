import { Department } from '@/database/generated/prisma/enums';

export const awsAccounts = [
  {
    awsAccountId: '111111111111',
    accountName: 'IT Development',
    ownerDepartment: Department.IT,
    defaultRegion: 'ap-southeast-1'
  },
  {
    awsAccountId: '121212121212',
    accountName: 'IT Production',
    ownerDepartment: Department.IT,
    defaultRegion: 'ap-southeast-1'
  },
  {
    awsAccountId: '333333333333',
    accountName: 'Engineering Production',
    ownerDepartment: Department.ENGINEERING,
    defaultRegion: 'ap-southeast-1'
  },
  {
    awsAccountId: '444444444444',
    accountName: 'Finance Analytics',
    ownerDepartment: Department.FINANCE,
    defaultRegion: 'ap-southeast-1'
  },
  {
    awsAccountId: '555555555555',
    accountName: 'Security Operations',
    ownerDepartment: Department.SECURITY,
    defaultRegion: 'ap-southeast-1'
  }
];
