import { Request, Response, NextFunction } from 'express';
import { pool } from '../../config/database.js';
import { uploadBrandingMiddleware } from '../../config/upload.js';
import { FIND_CONFIG } from './queries/find-config.js';
import { FIND_BRANDING } from './queries/find-branding.js';
import { INSERT_PURCHASE_TYPE } from './queries/insert-purchase-type.js';
import { UPDATE_PURCHASE_TYPE } from './queries/update-purchase-type.js';
import { INSERT_CUSTOMER_TYPE } from './queries/insert-customer-type.js';
import { UPDATE_CUSTOMER_TYPE } from './queries/update-customer-type.js';
import { UPDATE_BRANDING } from './queries/update-branding.js';
import { FIND_PAYMENT_GATEWAY_RULES } from './queries/find-payment-gateway-rules.js';
import { UPSERT_PAYMENT_GATEWAY_RULE } from './queries/update-payment-gateway-rule.js';
import { cacheGet, cacheSet, cacheDel } from '../../config/redis.js';
import { getActiveDevice } from '../pos/pos.service.js';

const CONFIG_CACHE_KEY = 'config:all';

export async function getConfig(_req: Request, res: Response, next: NextFunction) {
  try {
    const cached = await cacheGet(CONFIG_CACHE_KEY);
    if (cached) { res.status(200).json(JSON.parse(cached)); return; }

    const [configResult, rulesResult, activeDevice] = await Promise.all([
      pool.query(FIND_CONFIG),
      pool.query(FIND_PAYMENT_GATEWAY_RULES),
      getActiveDevice(),
    ]);
    const row = configResult.rows[0];

    // Agrupar reglas por customer_type
    const paymentGatewayRules: Record<string, { gateway: string; active: boolean }[]> = {};
    for (const r of rulesResult.rows) {
      if (!paymentGatewayRules[r.customer_type]) paymentGatewayRules[r.customer_type] = [];
      paymentGatewayRules[r.customer_type].push({ gateway: r.gateway, active: r.active });
    }

    const body = {
      data: {
        roles: row.roles ?? [],
        priceModes: row.price_modes ?? [],
        purchaseTypes: row.purchase_types ?? [],
        customerTypes: row.customer_types ?? [],
        paymentGateway: row.payment_gateway ?? 'checkout_pro',
        paymentGatewayRules,
        pointDevice: activeDevice ? { id: activeDevice.id, name: activeDevice.name } : null,
      },
    };
    await cacheSet(CONFIG_CACHE_KEY, JSON.stringify(body), 300);
    res.status(200).json(body);
  } catch (err) { next(err); }
}

function mapBranding(row: Record<string, unknown>) {
  return {
    storeName:              row.store_name,
    primaryColor:           row.primary_color,
    secondaryColor:         row.secondary_color,
    logoUrl:                row.logo_url ?? null,
    bankTransferCvu:        row.bank_transfer_cvu ?? null,
    bankTransferAlias:      row.bank_transfer_alias ?? null,
    bankTransferHolderName: row.bank_transfer_holder_name ?? null,
    bankTransferBankName:   row.bank_transfer_bank_name ?? null,
    bankTransferNotes:      row.bank_transfer_notes ?? null,
    whatsappNumber:         row.whatsapp_number ?? null,
  };
}

export async function getBranding(_req: Request, res: Response) {
  const result = await pool.query(FIND_BRANDING);
  res.status(200).json({ data: mapBranding(result.rows[0]) });
}

export async function updateBranding(req: Request, res: Response) {
  const {
    storeName, primaryColor, secondaryColor, logoUrl,
    bankTransferCvu, bankTransferAlias, bankTransferHolderName,
    bankTransferBankName, bankTransferNotes, whatsappNumber,
  } = req.body;

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (storeName !== undefined)              { fields.push(`store_name = $${idx++}`);               values.push(storeName ?? null); }
  if (primaryColor !== undefined)           { fields.push(`primary_color = $${idx++}`);             values.push(primaryColor ?? null); }
  if (secondaryColor !== undefined)         { fields.push(`secondary_color = $${idx++}`);           values.push(secondaryColor ?? null); }
  if (logoUrl !== undefined)                { fields.push(`logo_url = $${idx++}`);                  values.push(logoUrl ?? null); }
  if (bankTransferCvu !== undefined)        { fields.push(`bank_transfer_cvu = $${idx++}`);         values.push(bankTransferCvu ?? null); }
  if (bankTransferAlias !== undefined)      { fields.push(`bank_transfer_alias = $${idx++}`);       values.push(bankTransferAlias ?? null); }
  if (bankTransferHolderName !== undefined) { fields.push(`bank_transfer_holder_name = $${idx++}`); values.push(bankTransferHolderName ?? null); }
  if (bankTransferBankName !== undefined)   { fields.push(`bank_transfer_bank_name = $${idx++}`);   values.push(bankTransferBankName ?? null); }
  if (bankTransferNotes !== undefined)      { fields.push(`bank_transfer_notes = $${idx++}`);       values.push(bankTransferNotes ?? null); }
  if (whatsappNumber !== undefined)         { fields.push(`whatsapp_number = $${idx}`);              values.push(whatsappNumber ?? null); }

  if (fields.length === 0) {
    res.status(400).json({ detail: 'Debe enviar al menos un campo para actualizar' });
    return;
  }

  fields.push(`updated_at = NOW()`);
  const result = await pool.query(
    `UPDATE branding SET ${fields.join(', ')} WHERE id = 1
     RETURNING store_name, primary_color, secondary_color, logo_url,
               bank_transfer_cvu, bank_transfer_alias, bank_transfer_holder_name,
               bank_transfer_bank_name, bank_transfer_notes, whatsapp_number`,
    values,
  );
  res.status(200).json({ data: mapBranding(result.rows[0]) });
}

export async function listPurchaseTypes(_req: Request, res: Response) {
  const result = await pool.query('SELECT id, code, label, active FROM purchase_types ORDER BY id');
  res.status(200).json({ data: result.rows });
}

export async function listCustomerTypes(_req: Request, res: Response) {
  const result = await pool.query('SELECT id, code, label, active FROM customer_types ORDER BY id');
  res.status(200).json({ data: result.rows });
}

export async function createPurchaseType(req: Request, res: Response) {
  const { code, label } = req.body;
  if (!code || typeof code !== 'string' || !label || typeof label !== 'string') {
    res.status(400).json({ detail: 'code y label son requeridos y deben ser strings' });
    return;
  }
  const result = await pool.query(INSERT_PURCHASE_TYPE, [code, label]);
  await cacheDel(CONFIG_CACHE_KEY);
  res.status(201).json({ data: result.rows[0] });
}

export async function updatePurchaseType(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { label, active } = req.body;
  const result = await pool.query(UPDATE_PURCHASE_TYPE, [id, label ?? null, active ?? null]);
  if (!result.rows[0]) { res.status(404).json({ detail: 'Tipo de compra no encontrado' }); return; }
  await cacheDel(CONFIG_CACHE_KEY);
  res.status(200).json({ data: result.rows[0] });
}

export async function createCustomerType(req: Request, res: Response) {
  const { code, label } = req.body;
  if (!code || typeof code !== 'string' || !label || typeof label !== 'string') {
    res.status(400).json({ detail: 'code y label son requeridos y deben ser strings' });
    return;
  }
  const result = await pool.query(INSERT_CUSTOMER_TYPE, [code, label]);
  await cacheDel(CONFIG_CACHE_KEY);
  res.status(201).json({ data: result.rows[0] });
}

export function uploadBrandingLogoHandler(req: Request, res: Response, next: NextFunction): void {
  uploadBrandingMiddleware(req, res, async (err) => {
    if (err) { res.status(400).json({ detail: err.message }); return; }
    if (!req.file) { res.status(400).json({ detail: 'Debe enviar un archivo de imagen (campo "image")' }); return; }
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const logoUrl = `${baseUrl}/uploads/branding/${req.file.filename}`;
      const result = await pool.query(UPDATE_BRANDING, [null, null, null, logoUrl]);
      res.status(200).json({ data: mapBranding(result.rows[0]) });
    } catch (e) { next(e); }
  });
}

export async function updatePaymentGateway(req: Request, res: Response): Promise<void> {
  const { gateway } = req.body;
  if (gateway !== 'checkout_pro' && gateway !== 'checkout_api' && gateway !== 'bank_transfer') {
    res.status(400).json({ detail: 'gateway debe ser checkout_pro, checkout_api o bank_transfer' });
    return;
  }
  await pool.query('UPDATE branding SET payment_gateway = $1 WHERE id = 1', [gateway]);
  await cacheDel(CONFIG_CACHE_KEY);
  res.status(200).json({ data: { paymentGateway: gateway } });
}

export async function updateCustomerType(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { label, active } = req.body;
  const result = await pool.query(UPDATE_CUSTOMER_TYPE, [id, label ?? null, active ?? null]);
  if (!result.rows[0]) { res.status(404).json({ detail: 'Tipo de cliente no encontrado' }); return; }
  await cacheDel(CONFIG_CACHE_KEY);
  res.status(200).json({ data: result.rows[0] });
}

// ─── Payment Gateway Rules ─────────────────────────────────────────────────────

const VALID_GATEWAYS   = ['checkout_pro', 'checkout_api', 'bank_transfer', 'mp_point'] as const;
const VALID_CUST_TYPES = ['retail', 'wholesale'] as const;

export async function getPaymentGatewayRules(_req: Request, res: Response): Promise<void> {
  const result = await pool.query(FIND_PAYMENT_GATEWAY_RULES);
  const grouped: Record<string, { gateway: string; active: boolean }[]> = {};
  for (const r of result.rows) {
    if (!grouped[r.customer_type]) grouped[r.customer_type] = [];
    grouped[r.customer_type].push({ gateway: r.gateway, active: r.active });
  }
  res.status(200).json({ data: grouped });
}

export async function updatePaymentGatewayRule(req: Request, res: Response): Promise<void> {
  const { customer_type, gateway, active } = req.body;

  if (!VALID_CUST_TYPES.includes(customer_type)) {
    res.status(400).json({
      detail: `customer_type inválido. Valores permitidos: ${VALID_CUST_TYPES.join(', ')}`,
    });
    return;
  }
  if (!VALID_GATEWAYS.includes(gateway)) {
    res.status(400).json({
      detail: `gateway inválido. Valores permitidos: ${VALID_GATEWAYS.join(', ')}`,
    });
    return;
  }
  if (typeof active !== 'boolean') {
    res.status(400).json({ detail: 'active debe ser un booleano' });
    return;
  }

  const result = await pool.query(UPSERT_PAYMENT_GATEWAY_RULE, [customer_type, gateway, active]);
  await cacheDel(CONFIG_CACHE_KEY);
  res.status(200).json({ data: result.rows[0] });
}
