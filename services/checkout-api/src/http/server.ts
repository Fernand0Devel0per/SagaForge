import express from 'express';

import { env } from '../config/env.js';

export function buildServer() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  
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

  return app;
}