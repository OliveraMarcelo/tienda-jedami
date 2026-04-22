import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { testApp } from './helpers/app.js';

const WEBHOOK_URL = '/api/v1/payments/webhook';

// En dev/test con MP_WEBHOOK_SECRET no configurado, la firma se saltea
describe('POST /payments/webhook', () => {
  it('retorna 200 con body válido sin evento relevante', async () => {
    const body = JSON.stringify({ action: 'application.authorized', data: { id: '1' } });
    const res = await request(testApp)
      .post(WEBHOOK_URL)
      .set('Content-Type', 'application/json')
      .set('x-signature', 'ts=1,v1=abc')
      .set('x-request-id', 'req-1')
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('received', true);
  });

  it('retorna 200 con body inválido (ignorado)', async () => {
    const res = await request(testApp)
      .post(WEBHOOK_URL)
      .set('Content-Type', 'application/json')
      .set('x-signature', 'ts=1,v1=abc')
      .set('x-request-id', 'req-2')
      .send('not-json');
    expect(res.status).toBe(200);
  });

  it('retorna 200 si action no es payment.updated ni payment.created', async () => {
    const body = JSON.stringify({ action: 'other.event', data: { id: '999' } });
    const res = await request(testApp)
      .post(WEBHOOK_URL)
      .set('Content-Type', 'application/json')
      .set('x-signature', 'ts=1,v1=abc')
      .set('x-request-id', 'req-3')
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});
