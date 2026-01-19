import { randomUUID } from 'node:crypto';

import type { RequestHandler } from 'express';

const UUID_LIKE_RE = /^[0-9a-fA-F-]{36}$/;

const isUuidLike = (value: string) => UUID_LIKE_RE.test(value);

export const requestContextMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-correlation-id');
  const correlationId =
    incoming && isUuidLike(incoming) ? incoming : randomUUID();

  res.locals.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  const traceparent = req.header('traceparent');
  if (traceparent) res.locals.traceId = traceparent;

  next();
};