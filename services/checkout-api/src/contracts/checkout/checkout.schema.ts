import { z } from 'zod';

const toCents = (value: number) => Math.round(value * 100);

export const CurrencySchema = z.enum(['BRL', 'USD']);
export type Currency = z.infer<typeof CurrencySchema>;

export const ItemRequestSchema = z
  .object({
    sellerId: z.string().trim().min(1, 'required'),
    productId: z.string().trim().min(1, 'required'),
    quantity: z.number().int().min(1, 'must be >= 1'),
    unitPrice: z.number().positive('must be > 0'),
  })
  .strict();
export type ItemRequest = z.infer<typeof ItemRequestSchema>;

export const CardRequestSchema = z
  .object({
    token: z.string().trim().min(1, 'required'),
  })
  .strict();
export type CardRequest = z.infer<typeof CardRequestSchema>;

export const PaymentRequestSchema = z
  .object({
    method: z.enum(['CARD', 'PIX'], { message: 'must be CARD or PIX' }),
    card: CardRequestSchema.optional(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.method === 'CARD' && !p.card?.token) {
      ctx.addIssue({
        code: 'custom',
        path: ['card', 'token'],
        message: 'required',
      });
    }
  });
export type PaymentRequest = z.infer<typeof PaymentRequestSchema>;

export const ContextRequestSchema = z
  .object({
    deviceId: z.string().trim().min(1, 'required').optional(),
    ip: z.string().trim().min(1, 'required').optional(),
  })
  .strict();
export type ContextRequest = z.infer<typeof ContextRequestSchema>;

const CheckoutRequestBaseSchema = z
  .object({
    customerId: z.string().trim().min(1, 'required'),
    currency: CurrencySchema,
    items: z.array(ItemRequestSchema).min(1, 'must have at least 1 item'),
    payment: PaymentRequestSchema,
    totalAmount: z.number().positive('must be > 0').optional(),
    context: ContextRequestSchema.optional(),
  })
  .strict();

export function buildCheckoutSchema(opts: {
  maxItems: number;
  maxTotalAmount: number;
  totalAmountTolerance: number;
}) {
  const schema = CheckoutRequestBaseSchema.extend({
    items: CheckoutRequestBaseSchema.shape.items.max(
      opts.maxItems,
      `must have at most ${opts.maxItems} items`,
    ),
  }).superRefine((payload, ctx) => {
    const computedTotalCents = payload.items.reduce((acc, it) => {
      return acc + toCents(it.unitPrice) * it.quantity;
    }, 0);

    const maxTotalCents = toCents(opts.maxTotalAmount);

    if (computedTotalCents > maxTotalCents) {
      ctx.addIssue({
        code: 'custom',
        path: ['totalAmount'],
        message: `must be <= ${opts.maxTotalAmount}`,
      });
    }

    if (payload.totalAmount !== undefined) {
      const sentCents = toCents(payload.totalAmount);
      const toleranceCents = toCents(opts.totalAmountTolerance);

      const diff = Math.abs(sentCents - computedTotalCents);
      if (diff > toleranceCents) {
        ctx.addIssue({
          code: 'custom',
          path: ['totalAmount'],
          message: `must match sum(items.unitPrice * items.quantity) within tolerance ${opts.totalAmountTolerance}`,
        });
      }

      if (sentCents > maxTotalCents) {
        ctx.addIssue({
          code: 'custom',
          path: ['totalAmount'],
          message: `must be <= ${opts.maxTotalAmount}`,
        });
      }
    }
  });

  return schema;
}


export type CheckoutRequest = z.infer<ReturnType<typeof buildCheckoutSchema>>;
