import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';

@Injectable({})
export class BcryptService {
  private readonly saltRounds = 10;
  hash(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, this.saltRounds);
  }

  compare(plaintext: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hashed);
  }
}
