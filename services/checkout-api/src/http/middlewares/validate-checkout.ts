import type { RequestHandler } from 'express';

import { env } from '../../config/env.js';
import { buildCheckoutSchema } from '../../contracts/checkout/checkout.schema.js';
import { sendError } from '../errors/send-error.js';

function pathToField(path: Array<string | number>) {
  return path.reduce<string>((acc, seg) => {
    if (typeof seg === 'number') return `${acc}[${seg}]`;
    if (!acc) return seg;
    return `${acc}.${seg}`;
  }, '');
}

const checkoutSchema = buildCheckoutSchema({
  maxItems: env.CHECKOUT_MAX_ITEMS,
  maxTotalAmount: env.CHECKOUT_MAX_TOTAL_AMOUNT,
  totalAmountTolerance: env.CHECKOUT_TOTAL_AMOUNT_TOLERANCE,
});

export const validateCheckoutMiddleware: RequestHandler = (req, res, next) => {
  const result = checkoutSchema.safeParse(req.body);

  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: pathToField(i.path as Array<string | number>),
      reason: i.message,
    }));

    return sendError(
      res,
      400,
      'CHECKOUT_VALIDATION_FAILED',
      'Payload inválido.',
      details,
    );
  }

  res.locals.checkoutPayload = result.data;

  return next();
};
