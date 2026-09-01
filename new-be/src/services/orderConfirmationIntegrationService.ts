import crypto from 'crypto';
import http from 'http';
import https from 'https';

type JsonValue = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

export interface OrderConfirmationSummary {
  id: string;
  no_ok: string;
  tanggal: string;
  status: string[];
  customer: {
    kode_customer?: string;
    nama_customer?: string;
    kota?: string;
    alamat?: string;
    kontak?: string;
    no_hp?: string;
  };
  sales?: {
    user_id?: string;
    nama?: string;
  };
  total_item?: number;
  grand_total?: number;
  input_date?: string;
}

export interface OrderConfirmationSearchResult {
  data: OrderConfirmationSummary[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    request_id?: string;
  };
}

class OrderConfirmationIntegrationError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 502, code = 'ORDER_CONFIRMATION_INTEGRATION_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const getConfig = () => {
  const baseUrl = String(process.env.ORDER_CONFIRMATION_BASE_URL || '').replace(/\/$/, '');
  const clientId = String(process.env.ORDER_CONFIRMATION_INTEGRATION_CLIENT_ID || '').trim();
  const secret = String(process.env.ORDER_CONFIRMATION_INTEGRATION_SECRET || '').trim();
  const timeoutMs = Math.min(Math.max(Number(process.env.ORDER_CONFIRMATION_TIMEOUT_MS || 10000), 1000), 30000);

  if (!baseUrl || !clientId || !secret) {
    throw new OrderConfirmationIntegrationError(
      'Konfigurasi integrasi Order Confirmation belum lengkap',
      503,
      'ORDER_CONFIRMATION_NOT_CONFIGURED'
    );
  }

  return { baseUrl, clientId, secret, timeoutMs };
};

const sha256Hex = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

const buildHeaders = (params: {
  method: string;
  originalUrl: string;
  body: string;
  clientId: string;
  secret: string;
}) => {
  const timestamp = String(Date.now());
  const bodyHash = sha256Hex(params.body);
  const canonicalRequest = [
    params.method.toUpperCase(),
    params.originalUrl,
    timestamp,
    bodyHash
  ].join('\n');
  const signature = crypto
    .createHmac('sha256', params.secret)
    .update(canonicalRequest)
    .digest('hex');

  return {
    'Content-Type': 'application/json',
    'X-Integration-Client': params.clientId,
    'X-Integration-Timestamp': timestamp,
    'X-Integration-Signature': signature,
    'X-Request-Id': crypto.randomUUID()
  };
};

const requestJson = async <T extends JsonValue>(pathWithQuery: string): Promise<T> => {
  const config = getConfig();
  const targetUrl = new URL(pathWithQuery, config.baseUrl);
  const body = '';
  const headers = buildHeaders({
    method: 'GET',
    originalUrl: `${targetUrl.pathname}${targetUrl.search}`,
    body,
    clientId: config.clientId,
    secret: config.secret
  });
  const transport = targetUrl.protocol === 'https:' ? https : http;

  return new Promise<T>((resolve, reject) => {
    const request = transport.request(
      targetUrl,
      {
        method: 'GET',
        headers,
        timeout: config.timeoutMs
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let parsed: any = {};

          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch (error) {
            return reject(new OrderConfirmationIntegrationError(
              'Response Order Confirmation tidak valid',
              502,
              'ORDER_CONFIRMATION_INVALID_RESPONSE'
            ));
          }

          if (!response.statusCode || response.statusCode >= 400 || parsed?.success === false) {
            return reject(new OrderConfirmationIntegrationError(
              parsed?.message || 'Request ke Order Confirmation gagal',
              response.statusCode || 502,
              parsed?.code || 'ORDER_CONFIRMATION_REQUEST_FAILED'
            ));
          }

          resolve(parsed as T);
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new OrderConfirmationIntegrationError(
        'Request ke Order Confirmation timeout',
        504,
        'ORDER_CONFIRMATION_TIMEOUT'
      ));
    });
    request.on('error', (error: any) => {
      const nestedErrors = Array.isArray(error?.errors)
        ? error.errors.map((item: any) => `${item?.code || 'ERROR'} ${item?.address || ''}:${item?.port || ''}`.trim()).join(', ')
        : '';
      const detail = error?.message || nestedErrors || 'koneksi gagal';
      reject(new OrderConfirmationIntegrationError(
        `Tidak bisa terhubung ke Order Confirmation (${config.baseUrl}): ${detail}`,
        502,
        'ORDER_CONFIRMATION_CONNECTION_FAILED'
      ));
    });
    request.end();
  });
};

const normalizeNoOk = (value: unknown) => String(value || '').trim();

export const searchOrderConfirmationNoOk = async (params: {
  search?: string;
  page?: number;
  limit?: number;
  status?: string;
}): Promise<OrderConfirmationSearchResult> => {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set('search', params.search);
  searchParams.set('status', params.status || 'Validated');
  searchParams.set('page', String(Math.max(Number(params.page || 1), 1)));
  searchParams.set('limit', String(Math.min(Math.max(Number(params.limit || 25), 1), 100)));

  const response = await requestJson<{
    success: boolean;
    data: OrderConfirmationSummary[];
    meta: OrderConfirmationSearchResult['meta'];
  }>(`/api/v1/integrations/order-konfirmasi/search?${searchParams.toString()}`);

  return {
    data: Array.isArray(response.data) ? response.data : [],
    meta: response.meta || { page: 1, limit: 25, total: 0, total_pages: 0 }
  };
};

export const getOrderConfirmationDetail = async (noOk: string): Promise<OrderConfirmationSummary> => {
  const normalizedNoOk = normalizeNoOk(noOk);
  if (!normalizedNoOk) {
    throw new OrderConfirmationIntegrationError('No OK wajib diisi', 400, 'NO_OK_REQUIRED');
  }

  const searchParams = new URLSearchParams({ no_ok: normalizedNoOk });
  const response = await requestJson<{
    success: boolean;
    data: OrderConfirmationSummary;
  }>(`/api/v1/integrations/order-konfirmasi/detail?${searchParams.toString()}`);

  return response.data;
};

export const assertOrderConfirmationNoOkValid = async (noOk: unknown): Promise<string | null> => {
  const normalizedNoOk = normalizeNoOk(noOk);
  if (!normalizedNoOk) return null;

  const order = await getOrderConfirmationDetail(normalizedNoOk);
  if (!Array.isArray(order.status) || !order.status.includes('Validated')) {
    throw new OrderConfirmationIntegrationError(
      'No OK belum tervalidasi di Order Confirmation',
      400,
      'NO_OK_NOT_VALIDATED'
    );
  }

  return normalizedNoOk;
};
