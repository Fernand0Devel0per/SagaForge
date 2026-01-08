import 'dotenv/config';

import { z } from 'zod';

const envSchema = z.object({
  ENV: z.string().default('local'),
  SERVICE_NAME: z.string().default('checkout-api'),
  PORT: z.coerce.number().int().positive().default(3000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;