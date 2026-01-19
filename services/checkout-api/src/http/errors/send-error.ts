import type { Response } from 'express';

export type ErrorDetail = { field?: string; reason: string };

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details: ErrorDetail[] = [],
) {
  return res.status(statusCode).json({
    error: {
      code,
      message,
      details,
      traceId: res.locals.traceId,
      correlationId: res.locals.correlationId,
    },
  });
}
