import { ProjectMemberRole } from '@/database/generated/prisma/enums';

export const projectMembers = [
  {
    projectCode: '11111111-1111-4111-8111-111111111111',
    userEmail: 'emma@crgp.com',
    memberRole: ProjectMemberRole.BUSINESS_OWNER
  },
  {
    projectCode: '11111111-1111-4111-8111-111111111111',
    userEmail: 'alice@crgp.com',
    memberRole: ProjectMemberRole.TECHNICAL_OWNER
  },
  {
    projectCode: '11111111-1111-4111-8111-111111111111',
    userEmail: 'charlie@crgp.com',
    memberRole: ProjectMemberRole.MEMBER
  },

  {
    projectCode: '22222222-2222-4222-8222-222222222222',
    userEmail: 'david@crgp.com',
    memberRole: ProjectMemberRole.BUSINESS_OWNER
  },
  {
    projectCode: '22222222-2222-4222-8222-222222222222',
    userEmail: 'bob@crgp.com',
    memberRole: ProjectMemberRole.TECHNICAL_OWNER
  },

  {
    projectCode: '33333333-3333-4333-8333-333333333333',
    userEmail: 'emma@crgp.com',
    memberRole: ProjectMemberRole.BUSINESS_OWNER
  },
  {
    projectCode: '33333333-3333-4333-8333-333333333333',
    userEmail: 'alice@crgp.com',
    memberRole: ProjectMemberRole.TECHNICAL_OWNER
  }
];
