/**
 * AFIP API - Cloudflare Worker
 * 
 * API Gateway para facturación electrónica AFIP.
 * Este worker actúa como capa de seguridad y validación
 * antes de reenviar requests al servidor local.
 * 
 * ARQUITECTURA:
 * Cliente → Worker → (Cloudflare Tunnel) → Server Local → AFIP
 */

import { Context } from './types';

// ==================== CONSTANTS ====================

const INTERNAL_ENDPOINT = '/process';

// Rate limiting: requests por ventana de tiempo
const RATE_LIMIT = {
  requests: 100,
  windowMs: 60 * 1000, // 1 minuto
};

// ==================== ENVIRONMENT ====================

interface Env {
  // Secrets configuradas via wrangler secret
  PUBLIC_API_KEY: string;
  INTERNAL_API_KEY: string;
  AFIP_SERVICE_URL: string;
  
  // Variables normales
  ENV?: string;
  VERSION?: string;
}

type WorkerEnv = {
  PUBLIC_API_KEY: string;
  INTERNAL_API_KEY: string;
  AFIP_SERVICE_URL: string;
  ENV?: string;
  VERSION?: string;
};

// ==================== VALIDATION ====================

interface InvoiceRequest {
  tenant_id?: string;
  client_name: string;
  client_cuit: string;
  client_address?: string;
  client_email?: string;
  invoice_type: number;
  invoice_letter: 'A' | 'B' | 'C' | 'E' | 'M';
  items: InvoiceItem[];
  fecha?: string;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  iva_rate: number;
}

/**
 * Valida el request de factura
 */
function validateInvoiceRequest(body: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!body) {
    errors.push('Request body is required');
    return { valid: false, errors };
  }
  
  // Client name
  if (!body.client_name || typeof body.client_name !== 'string' || body.client_name.length < 1) {
    errors.push('client_name is required and must be a non-empty string');
  }
  
  // Client CUIT
  if (!body.client_cuit || typeof body.client_cuit !== 'string') {
    errors.push('client_cuit is required');
  } else {
    const cuit = body.client_cuit.replace(/-/g, '');
    if (!/^\d{11}$/.test(cuit)) {
      errors.push('client_cuit must be 11 digits (without dashes)');
    }
  }
  
  // Invoice type
  if (body.invoice_type === undefined) {
    errors.push('invoice_type is required');
  } else if (typeof body.invoice_type !== 'number') {
    errors.push('invoice_type must be a number');
  } else if (body.invoice_type < 1 || body.invoice_type > 200) {
    errors.push('invoice_type must be between 1 and 200');
  }
  
  // Invoice letter
  if (!body.invoice_letter) {
    errors.push('invoice_letter is required');
  } else if (!['A', 'B', 'C', 'E', 'M'].includes(body.invoice_letter)) {
    errors.push('invoice_letter must be A, B, C, E, or M');
  }
  
  // Items
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    errors.push('items is required and must not be empty');
  } else {
    body.items.forEach((item: any, index: number) => {
      if (!item.description || typeof item.description !== 'string') {
        errors.push(`items[${index}].description is required`);
      }
      if (!item.quantity || typeof item.quantity !== 'number' || item.quantity <= 0) {
        errors.push(`items[${index}].quantity must be greater than 0`);
      }
      if (!item.unit_price || typeof item.unit_price !== 'number' || item.unit_price < 0) {
        errors.push(`items[${index}].unit_price must be greater than or equal to 0`);
      }
      if (item.iva_rate === undefined || typeof item.iva_rate !== 'number') {
        errors.push(`items[${index}].iva_rate is required`);
      }
    });
  }
  
  return { valid: errors.length === 0, errors };
}

// ==================== RATE LIMITING ====================

/**
 * Simple rate limiter usando KV o en memoria
 * Nota: En producción, usar Durable Objects o KV para persistencia
 */
async function checkRateLimit(
  ctx: Context,
  apiKey: string
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const key = `rate_limit:${apiKey}`;
  
  // Intentar usar KV si está disponible
  const kv = ctx.env.AFIP_SERVICE_KV as KVNamespace | undefined;
  
  if (kv) {
    try {
      const stored = await kv.get(key, 'json') as {
        count: number;
        resetAt: number;
      } | null;
      
      if (!stored || now > stored.resetAt) {
        // Nueva ventana
        await kv.put(key, JSON.stringify({
          count: 1,
          resetAt: now + RATE_LIMIT.windowMs
        }), { expirationTtl: 120 });
        
        return { allowed: true, remaining: RATE_LIMIT.requests - 1, resetAt: now + RATE_LIMIT.windowMs };
      }
      
      if (stored.count >= RATE_LIMIT.requests) {
        return { allowed: false, remaining: 0, resetAt: stored.resetAt };
      }
      
      await kv.put(key, JSON.stringify({
        count: stored.count + 1,
        resetAt: stored.resetAt
      }), { expirationTtl: 120 });
      
      return { 
        allowed: true, 
        remaining: RATE_LIMIT.requests - stored.count - 1, 
        resetAt: stored.resetAt 
      };
    } catch {
      // Si falla KV, permitir request
      return { allowed: true, remaining: RATE_LIMIT.requests, resetAt: now + RATE_LIMIT.windowMs };
    }
  }
  
  // Sin KV, permitir todo (development)
  return { allowed: true, remaining: RATE_LIMIT.requests, resetAt: now + RATE_LIMIT.windowMs };
}

// ==================== AUTHENTICATION ====================

/**
 * Autentica el request del cliente
 */
function authenticate(
  headers: Headers,
  env: WorkerEnv
): { valid: boolean; error: string; apiKey?: string } {
  const authHeader = headers.get('x-api-key') || headers.get('authorization');
  
  if (!authHeader) {
    return { valid: false, error: 'Missing API key (x-api-key or Authorization header)' };
  }
  
  // Soportar varios formatos:
  // x-api-key: <key>
  // authorization: ApiKey <key>
  // authorization: Bearer <key>
  let apiKey = authHeader;
  if (authHeader.startsWith('ApiKey ') || authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.substring(authHeader.indexOf(' ') + 1);
  }
  
  if (apiKey !== env.PUBLIC_API_KEY) {
    return { valid: false, error: 'Invalid API key' };
  }
  
  return { valid: true, apiKey };
}

// ==================== PROXY TO SERVER ====================

/**
 * Reenvía request al servidor local
 */
async function proxyToServer(
  ctx: Context,
  invoiceData: InvoiceRequest,
  env: WorkerEnv
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
  status?: number;
}> {
  const serviceUrl = env.AFIP_SERVICE_URL;
  
  if (!serviceUrl) {
    return { 
      success: false, 
      error: 'Backend not configured. Please set AFIP_SERVICE_URL.' 
    };
  }
  
  try {
    const response = await fetch(`${serviceUrl}${INTERNAL_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.INTERNAL_API_KEY}`,
        'X-Forwarded-By': 'cloudflare-worker',
        'X-Request-Id': ctx.request.id,
      },
      body: JSON.stringify(invoiceData),
    });
    
    const data = await response.json();
    
    return {
      success: response.ok,
      data,
      status: response.status,
    };
  } catch (error) {
    ctx.waitUntil(
      fetch(serviceUrl + '/health').catch(() => {})
    );
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect to backend',
    };
  }
}

// ==================== HANDLERS ====================

/**
 * POST /invoices - Crear factura
 */
async function handleCreateInvoice(
  ctx: Context,
  env: WorkerEnv
): Promise<Response> {
  // 1. Autenticar
  const auth = authenticate(ctx.request.headers, env);
  if (!auth.valid) {
    return new Response(JSON.stringify({
      error: 'UNAUTHORIZED',
      message: auth.error
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // 2. Rate limiting
  const rateLimit = await checkRateLimit(ctx, auth.apiKey!);
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({
      error: 'RATE_LIMITED',
      message: 'Too many requests',
      retry_after: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': rateLimit.resetAt.toString()
      }
    });
  }
  
  // 3. Parsear body
  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return new Response(JSON.stringify({
      error: 'INVALID_REQUEST',
      message: 'Invalid JSON body'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // 4. Validar request
  const validation = validateInvoiceRequest(body);
  if (!validation.valid) {
    return new Response(JSON.stringify({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: validation.errors
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // 5. Reenviar al servidor
  const result = await proxyToServer(ctx, body as InvoiceRequest, env);
  
  if (!result.success) {
    return new Response(JSON.stringify({
      error: 'BACKEND_ERROR',
      message: result.error || 'Failed to process invoice',
      ...(result.status ? { status: result.status } : {})
    }), {
      status: result.status || 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // 6. Responder
  return new Response(JSON.stringify({
    success: true,
    data: result.data
  }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': rateLimit.remaining.toString()
      }
    });
  }
}

/**
 * GET /health - Health check
 */
async function handleHealth(ctx: Context): Promise<Response> {
  return new Response(JSON.stringify({
    status: 'ok',
    service: 'afip-api',
    timestamp: new Date().toISOString(),
    version: ctx.env.VERSION || '1.0.0'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ==================== MAIN HANDLER ====================

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: Context): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    // Logging
    console.log(`${method} ${path} - ${request.headers.get('cf-ray')?.substring(0, 8)}`);
    
    // Rutas
    if (path === '/invoices' && method === 'POST') {
      return handleCreateInvoice({ request, env, ctx }, env);
    }
    
    if (path === '/health' && method === 'GET') {
      return handleHealth({ request, env, ctx });
    }
    
    // 404
    return new Response(JSON.stringify({
      error: 'NOT_FOUND',
      message: `Endpoint ${path} not found`
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} satisfies ExportedHandler<WorkerEnv, Context>;