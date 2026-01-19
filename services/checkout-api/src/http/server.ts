import { randomUUID } from 'crypto';
import express from 'express';

import { env } from '../config/env.js';
import { sendError } from './errors/send-error.js';
import { requestContextMiddleware } from './middlewares/request-context.js';
import { validateCheckoutMiddleware } from './middlewares/validate-checkout.js';

export function buildServer() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(requestContextMiddleware);

  app.get('/health/live', (_req, res) => res.status(200).json({ status: 'ok' }));
  app.get('/health/ready', (_req, res) =>
    res.status(200).json({
      status: 'ok',
      service: env.SERVICE_NAME,
      env: env.ENV,
    }),
  );

  app.get('/', (_req, res) =>
    res.status(200).json({
      service: env.SERVICE_NAME,
      env: env.ENV,
      status: 'up',
    }),
  );

  app.post('/checkout', validateCheckoutMiddleware, (_req, res) => {
    return res.status(202).json({
      orderId: randomUUID(),
      status: 'PENDING',
      correlationId: res.locals.correlationId,
    });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next;
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('UnhandledError', {
      message,
      correlationId: res.locals.correlationId,
      traceId: res.locals.traceId,
    });

    return sendError(res, 500, 'CHECKOUT_INTERNAL_ERROR', 'Unexpected error.', []);
  });

  return app;
}
