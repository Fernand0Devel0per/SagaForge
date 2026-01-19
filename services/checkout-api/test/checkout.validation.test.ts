import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { buildServer } from '../src/http/server.js';

type ErrorDetail = { field?: string; reason: string };

const UUID_LIKE_RE = /^[0-9a-fA-F-]{36}$/;

function basePayload() {
  return {
    customerId: 'cust_1',
    currency: 'BRL',
    items: [
      {
        sellerId: 'seller_1',
        productId: 'prod_1',
        quantity: 1,
        unitPrice: 10.5,
      },
    ],
    payment: { method: 'PIX' },
  };
}

function buildItems(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    sellerId: `seller_${i}`,
    productId: `prod_${i}`,
    quantity: 1,
    unitPrice: 1,
  }));
}

function expectValidation(res: request.Response) {
  const errorBody = res.body as {
    error?: { code?: string; details?: ErrorDetail[]; correlationId?: string };
  };

  expect(res.status).toBe(400);
  expect(errorBody.error?.code).toBe('CHECKOUT_VALIDATION_FAILED');
  expect(Array.isArray(errorBody.error?.details)).toBe(true);

  const headerCid = res.headers['x-correlation-id'];
  expect(headerCid).toMatch(UUID_LIKE_RE);
  expect(errorBody.error?.correlationId).toBe(headerCid);

  return errorBody.error?.details ?? [];
}

describe('POST /checkout - validation', () => {
  const app = buildServer();

  it('payload sem items -> 400', async () => {
    type CheckoutPayload = ReturnType<typeof basePayload>;
    const payload: Partial<CheckoutPayload> = basePayload();
    delete payload.items;

    const res = await request(app).post('/checkout').send(payload);
    const details = expectValidation(res);

    const fields = details.map((d) => d.field).join('|');
    expect(fields).toContain('items');
  });

  it('quantity=0 -> 400', async () => {
    const payload = basePayload();
    payload.items[0]!.quantity = 0;

    const res = await request(app).post('/checkout').send(payload);
    const details = expectValidation(res);

    expect(details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'items[0].quantity' }),
      ]),
    );
  });

  it('unitPrice<=0 -> 400', async () => {
    const payload = basePayload();
    payload.items[0]!.unitPrice = 0;

    const res = await request(app).post('/checkout').send(payload);
    const details = expectValidation(res);

    expect(details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'items[0].unitPrice' }),
      ]),
    );
  });

  it('items > 50 -> 400', async () => {
    const payload = basePayload();
    payload.items = buildItems(51);

    const res = await request(app).post('/checkout').send(payload);
    const details = expectValidation(res);

    const fields = details.map((d) => d.field).join('|');
    expect(fields).toContain('items');
  });

  it('payload valido -> 202', async () => {
    const payload = basePayload();

    const res = await request(app).post('/checkout').send(payload);
    expect(res.status).toBe(202);

    const body = res.body as {
      orderId?: string;
      correlationId?: string;
      status?: string;
    };

    expect(body.orderId).toMatch(UUID_LIKE_RE);

    const headerCid = res.headers['x-correlation-id'];
    expect(headerCid).toMatch(UUID_LIKE_RE);
    expect(body.correlationId).toBe(headerCid);
  });
});
