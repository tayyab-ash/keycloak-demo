import { IsEmail, IsIn } from 'class-validator';
import { UserRole } from '../../../generated/prisma/client';

export class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @IsIn([UserRole.ADMIN, UserRole.USER])
  role!: UserRole;
}
