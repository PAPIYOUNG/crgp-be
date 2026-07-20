import { Logger } from '@nestjs/common';
import z from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().max(65535).positive(),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRE_IN: z.coerce.number().int().positive()
});

export function validate(config: Record<string, any>) {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const logger = new Logger('ENV Validation');
    logger.error('ENV validation fail', z.prettifyError(parsed.error));
    throw new Error('ENV Validation failed');
  }
  return parsed.data;
}

export type EnvVariableType = z.infer<typeof envSchema>;
