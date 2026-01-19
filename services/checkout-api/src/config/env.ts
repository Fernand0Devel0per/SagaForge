import 'dotenv/config';

import { z } from 'zod';

const envSchema = z.object({
  ENV: z.string().default('local'),
  SERVICE_NAME: z.string().default('checkout-api'),
  PORT: z.coerce.number().int().positive().default(3000),

  CHECKOUT_MAX_ITEMS: z.coerce.number().int().positive().default(50),
  CHECKOUT_MAX_TOTAL_AMOUNT: z.coerce.number().positive().default(1000000),

  CHECKOUT_TOTAL_AMOUNT_TOLERANCE: z.coerce.number().min(0).default(0.01),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;
