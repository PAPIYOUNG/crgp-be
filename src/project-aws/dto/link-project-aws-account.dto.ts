import { IsUUID } from 'class-validator';

export class LinkProjectAwsAccountDto {
  @IsUUID()
  awsAccountId: string;
}
