import { Department, ProjectStatus } from '@/database/generated/prisma/enums';

export const projects = [
  {
    projectCode: '11111111-1111-4111-8111-111111111111',
    projectName: 'CRGP Platform',
    description: 'Cloud Resource Governance Platform',
    businessDepartment: Department.FINANCE,
    technicalDepartment: Department.IT,
    monthlyBudget: 5000,
    budgetCurrency: 'USD',
    status: ProjectStatus.ACTIVE,
    startDate: new Date('2026-01-01'),
    endDate: null
  },
  {
    projectCode: '22222222-2222-4222-8222-222222222222',
    projectName: 'E-Commerce Platform',
    description: 'Customer-facing e-commerce and order management platform',
    businessDepartment: Department.OPERATIONS,
    technicalDepartment: Department.ENGINEERING,
    monthlyBudget: 10000,
    budgetCurrency: 'USD',
    status: ProjectStatus.ACTIVE,
    startDate: new Date('2026-02-01'),
    endDate: null
  },
  {
    projectCode: '33333333-3333-4333-8333-333333333333',
    projectName: 'Finance Analytics',
    description: 'Financial reporting and cloud cost analytics platform',
    businessDepartment: Department.FINANCE,
    technicalDepartment: Department.IT,
    monthlyBudget: 3500,
    budgetCurrency: 'USD',
    status: ProjectStatus.ACTIVE,
    startDate: new Date('2026-03-01'),
    endDate: null
  }
];
