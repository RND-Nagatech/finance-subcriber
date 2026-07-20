import crypto from 'crypto';

const DOKU_CHECKOUT_PATH = '/checkout/v1/payment';

export interface DokuCheckoutRequest {
  amount: number;
  invoiceNumber: string;
  customer: {
    id?: string;
    name: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
  };
}

export interface DokuCheckoutCustomer {
  id?: string;
  name: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
}

export interface DokuCheckoutResult {
  paymentUrl: string;
  tokenId: string;
  expiredDate: string;
  requestId: string;
  customer: DokuCheckoutCustomer;
}

export interface DokuCallbackTokenPayload {
  invoiceNumber: string;
  amount: number;
  issuedAt: number;
}

export interface DokuTransactionStatus {
  invoiceNumber: string;
  amount: number;
  status: string;
  transactionDate?: string;
  originalRequestId?: string;
  channelId?: string;
}

export class DokuApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly requestId: string,
    public readonly details: string[] = []
  ) {
    super(message);
    this.name = 'DokuApiError';
  }
}

function getDokuConfig() {
  const clientId = String(process.env.DOKU_CLIENT_ID || '').trim();
  const secretKey = String(process.env.DOKU_SECRET_KEY || '').trim();
  const environment = String(process.env.DOKU_ENVIRONMENT || 'sandbox').trim().toLowerCase();
  const configuredBaseUrl = String(
    process.env.DOKU_BASE_URL || process.env.DOKU_API_BASE_URL || ''
  ).trim().replace(/\/$/, '');

  if (!clientId || !secretKey) {
    throw new Error('Konfigurasi DOKU belum lengkap. Isi DOKU_CLIENT_ID dan DOKU_SECRET_KEY.');
  }

  return {
    clientId,
    secretKey,
    baseUrl: configuredBaseUrl || (environment === 'production'
      ? 'https://api.doku.com'
      : 'https://api-sandbox.doku.com'),
  };
}

function getDokuCallbackUrl(token: string): string {
  const configuredUrl = String(process.env.CALLBACK_DOKU || '').trim().replace(/\/+$/, '');
  if (!configuredUrl) {
    throw new Error('Konfigurasi CALLBACK_DOKU belum tersedia.');
  }
  return `${configuredUrl}/tt-vps/doku/result?token=${encodeURIComponent(token)}`;
}

export function generateDokuDigest(requestBody: string): string {
  return crypto.createHash('sha256').update(requestBody, 'utf8').digest('base64');
}

export function generateDokuSignature(params: {
  clientId: string;
  requestId: string;
  requestTimestamp: string;
  requestTarget: string;
  digest?: string;
  secretKey: string;
}): string {
  const component = [
    `Client-Id:${params.clientId}`,
    `Request-Id:${params.requestId}`,
    `Request-Timestamp:${params.requestTimestamp}`,
    `Request-Target:${params.requestTarget}`,
    ...(params.digest ? [`Digest:${params.digest}`] : []),
  ].join('\n');

  const signature = crypto
    .createHmac('sha256', params.secretKey)
    .update(component, 'utf8')
    .digest('base64');

  return `HMACSHA256=${signature}`;
}

export function createDokuCallbackToken(params: { invoiceNumber: string; amount: number }): string {
  const config = getDokuConfig();
  const payload = Buffer.from(JSON.stringify({
    inv: params.invoiceNumber,
    amt: params.amount,
    iat: Date.now(),
  }), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', config.secretKey).update(payload, 'utf8').digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyDokuCallbackToken(token: string): DokuCallbackTokenPayload | null {
  const config = getDokuConfig();
  const [payload, signature, extra] = String(token || '').split('.');
  if (!payload || !signature || extra) return null;
  const expected = crypto.createHmac('sha256', config.secretKey).update(payload, 'utf8').digest('base64url');
  const actualBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const invoiceNumber = String(decoded?.inv || '').trim();
    const amount = Math.round(Number(decoded?.amt));
    const issuedAt = Number(decoded?.iat);
    const maxAgeMs = 24 * 60 * 60 * 1000;
    if (!invoiceNumber || !Number.isSafeInteger(amount) || amount <= 0 || !Number.isFinite(issuedAt)) return null;
    if (issuedAt > Date.now() + 60_000 || Date.now() - issuedAt > maxAgeMs) return null;
    return { invoiceNumber, amount, issuedAt };
  } catch {
    return null;
  }
}

export async function getDokuTransactionStatus(invoiceNumber: string): Promise<DokuTransactionStatus> {
  const config = getDokuConfig();
  const requestTarget = `/orders/v1/status/${encodeURIComponent(invoiceNumber)}`;
  const requestId = crypto.randomUUID();
  const requestTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const signature = generateDokuSignature({
    clientId: config.clientId,
    requestId,
    requestTimestamp,
    requestTarget,
    secretKey: config.secretKey,
  });

  const controller = new AbortController();
  const timeoutMs = Math.max(1000, Number(process.env.DOKU_STATUS_TIMEOUT_MS) || 8000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: globalThis.Response;
  try {
    response = await fetch(`${config.baseUrl}${requestTarget}`, {
      method: 'GET',
      headers: {
        'Client-Id': config.clientId,
        'Request-Id': requestId,
        'Request-Timestamp': requestTimestamp,
        Signature: signature,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  const body = await response.json().catch(() => ({})) as any;
  if (!response.ok) {
    const message = Array.isArray(body?.error_messages)
      ? body.error_messages.join('; ')
      : String(body?.message || `DOKU mengembalikan HTTP ${response.status}`);
    throw new DokuApiError(message, response.status, requestId);
  }

  return {
    invoiceNumber: String(body?.order?.invoice_number || ''),
    amount: Math.round(Number(body?.order?.amount)),
    status: String(body?.transaction?.status || '').toUpperCase(),
    transactionDate: body?.transaction?.date ? String(body.transaction.date) : undefined,
    originalRequestId: body?.transaction?.original_request_id
      ? String(body.transaction.original_request_id)
      : undefined,
    channelId: body?.channel?.id ? String(body.channel.id) : undefined,
  };
}

export function verifyDokuNotificationSignature(params: {
  clientId: string;
  requestId: string;
  requestTimestamp: string;
  requestTarget: string;
  requestBody: string;
  signature: string;
}): boolean {
  const config = getDokuConfig();
  if (params.clientId !== config.clientId) return false;

  const expected = generateDokuSignature({
    clientId: params.clientId,
    requestId: params.requestId,
    requestTimestamp: params.requestTimestamp,
    requestTarget: params.requestTarget,
    digest: generateDokuDigest(params.requestBody),
    secretKey: config.secretKey,
  });
  const actualBuffer = Buffer.from(params.signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return actualBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function normalizeDokuPhone(value?: string): string | undefined {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return undefined;
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;
  if (!digits.startsWith('62') || digits.length > 16) return undefined;
  return digits;
}

export function normalizeDokuCustomer(customer: DokuCheckoutRequest['customer']): DokuCheckoutCustomer {
  const name = customer.name
    .normalize('NFKD')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 255) || 'Customer';
  const id = String(customer.id || '').trim().slice(0, 50) || undefined;
  const phone = normalizeDokuPhone(customer.phone);
  const address = String(customer.address || '').trim().slice(0, 400) || undefined;
  const city = String(customer.city || '').trim().slice(0, 100) || undefined;
  const country = /^[A-Za-z]{2}$/.test(String(customer.country || ''))
    ? String(customer.country).toUpperCase()
    : undefined;

  return {
    ...(id ? { id } : {}),
    name,
    ...(phone ? { phone } : {}),
    ...(address ? { address } : {}),
    ...(city ? { city } : {}),
    ...(country ? { country } : {}),
  };
}

export async function createDokuCheckout(request: DokuCheckoutRequest): Promise<DokuCheckoutResult> {
  const config = getDokuConfig();
  const amount = Math.round(Number(request.amount));
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('Nominal pembayaran DOKU harus lebih dari 0.');
  }

  const dueMinutes = Math.max(1, Math.min(999999, Number(process.env.DOKU_PAYMENT_DUE_MINUTES) || 60));
  const callbackToken = createDokuCallbackToken({ invoiceNumber: request.invoiceNumber, amount });
  const callbackUrl = getDokuCallbackUrl(callbackToken);
  const order = {
    amount,
    invoice_number: request.invoiceNumber,
    callback_url: callbackUrl,
    auto_redirect: true,
  };

  const customer = normalizeDokuCustomer(request.customer);

  const body: Record<string, unknown> = {
    order,
    payment: { payment_due_date: dueMinutes },
    customer,
  };
  const requestBody = JSON.stringify(body);
  const requestId = crypto.randomUUID();
  const requestTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const digest = generateDokuDigest(requestBody);
  const signature = generateDokuSignature({
    clientId: config.clientId,
    requestId,
    requestTimestamp,
    requestTarget: DOKU_CHECKOUT_PATH,
    digest,
    secretKey: config.secretKey,
  });

  console.info('DOKU checkout request:', {
    invoice_number: request.invoiceNumber,
    amount,
    request_id: requestId,
    callback_url: callbackUrl.split('?')[0],
  });

  const controller = new AbortController();
  const timeoutMs = Math.max(1000, Number(process.env.DOKU_REQUEST_TIMEOUT_MS) || 15000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: globalThis.Response;
  try {
    response = await fetch(`${config.baseUrl}${DOKU_CHECKOUT_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': config.clientId,
        'Request-Id': requestId,
        'Request-Timestamp': requestTimestamp,
        Signature: signature,
      },
      body: requestBody,
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new Error('Koneksi ke DOKU timeout. Silakan coba lagi.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const responseBody = await response.json().catch(() => ({})) as any;
  console.info('DOKU checkout response:', {
    invoice_number: request.invoiceNumber,
    status: response.status,
    request_id: requestId,
    callback_url: responseBody?.response?.order?.callback_url
      ? String(responseBody.response.order.callback_url).split('?')[0]
      : null,
  });
  if (!response.ok) {
    const rawMessages = responseBody?.error_messages
      ?? responseBody?.error?.messages
      ?? responseBody?.error?.message
      ?? responseBody?.message;
    const details = (Array.isArray(rawMessages) ? rawMessages : [rawMessages])
      .filter(Boolean)
      .map((value) => String(value));
    const message = details.join('; ') || `DOKU mengembalikan HTTP ${response.status}`;
    throw new DokuApiError(message, response.status, requestId, details);
  }

  const paymentUrl = String(responseBody?.response?.payment?.url || '').trim();
  if (!paymentUrl) throw new Error('DOKU tidak mengembalikan payment URL.');

  return {
    paymentUrl,
    tokenId: String(responseBody?.response?.payment?.token_id || '').trim(),
    expiredDate: String(responseBody?.response?.payment?.expired_date || '').trim(),
    requestId,
    customer,
  };
}
