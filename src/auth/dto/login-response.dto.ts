import { UserResponseDto } from '@/user/types/user.response.dto';

export class LoginResponseDto {
  access_token: string;
  user: UserResponseDto;
}
