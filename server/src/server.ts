/**
 * AFIP Server - Servidor de Facturación Electrónica
 * 
 * Este servidor recibe requests del Cloudflare Worker,
 * valida la autenticación interna y procesa las facturas.
 * 
 * En FASE 1: Funciona sin AFIP real (mock)
 * En FASE 2+3: Se conecta a AFIP (WSAA + WSFEv1)
 */

import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// ==================== CONFIGURACIÓN ====================

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key-change-me';
const PORT = parseInt(process.env.PORT || '3000', 10);

// ==================== TIPOS ====================

/**
 * Estructura de una solicitud de factura
 */
interface InvoiceRequest {
  tenant_id?: string;        // ID del tenant (para multi-tenant)
  client_name: string;     // Nombre del cliente
  client_cuit: string;     // CUIT del cliente (sin guiones)
  client_address?: string;  // Dirección del cliente
  client_email?: string;    // Email para enviar factura
  
  invoice_type: number;    // 1=Factura A, 2=Nota Débito A, 3=Nota Crédito A, etc.
  invoice_letter: 'A' | 'B' | 'C' | 'E' | 'M';  // Letra del comprobante
  
  items: InvoiceItem[];    // Items del comprobante
  fecha?: string;         // Fecha emision (YYYY-MM-DD)
  
  // Para multi-tenant (FUTURO)
  // puntos_venta?: number;
}

interface InvoiceItem {
  description: string;    // Descripción del producto/servicio
  quantity: number;      // Cantidad
  unit_price: number;     // Precio unitario (sin IVA)
  iva_rate: number;     // Tasa de IVA (21=21%, 10.5=10.5%, 0=0%)
}

/**
 * Estructura de respuesta de invoice
 */
interface InvoiceResponse {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ERROR';
  tenant_id?: string;
  
  // Datos AFIP (cuando esté implementado)
  // cae?: string;
  // fecha_vto_cae?: string;
  // numero?: number;
  
  // Datos del comprobante
  invoice_type: number;
  invoice_letter: string;
  
  // Totales
  subtotal: number;
  iva_total: number;
  total: number;
  
  // Cliente
  client_name: string;
  client_cuit: string;
  
  // Timestamps
  created_at: string;
  updated_at?: string;
  
  // Error (si aplica)
  error?: {
    code: string;
    message: string;
  };
}

// ==================== INSTANCIA FASTIFY ====================

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    }
  }
});

// ==================== MIDDLEWARE DE AUTH ====================

/**
 * Middleware de autenticación interna
 * Verifica que el request venga del Worker (no de usuarios directo)
 */
async function authenticateInternal(
  request: FastifyRequest, 
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;
  
  if (!authHeader) {
    reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Missing Authorization header'
    });
    return;
  }
  
  // Formato esperado: "Bearer <INTERNAL_API_KEY>"
  const token = authHeader.replace('Bearer ', '');
  
  if (token !== INTERNAL_API_KEY) {
    request.log.warn({ token: token.substring(0, 8) + '...' }, 'Invalid token attempted');
    reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Invalid authorization token'
    });
    return;
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Valida una solicitud de factura
 */
function validateInvoiceRequest(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!body) {
    errors.push('Request body is required');
    return { valid: false, errors };
  }
  
  // Validar cliente
  if (!body.client_name || typeof body.client_name !== 'string') {
    errors.push('client_name is required');
  }
  
  if (!body.client_cuit || typeof body.client_cuit !== 'string') {
    errors.push('client_cuit is required');
  } else {
    // Validar formato CUIT (sin guiones, 11 dígitos)
    const cuitClean = body.client_cuit.replace(/-/g, '');
    if (!/^\d{11}$/.test(cuitClean)) {
      errors.push('client_cuit must be 11 digits (without dashes)');
    }
  }
  
  // Validar tipo de comprobante
  if (body.invoice_type === undefined) {
    errors.push('invoice_type is required');
  } else if (![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200].includes(body.invoice_type)) {
      errors.push('invoice_type must be a valid AFIP code (1-200)');
    }
  }
  
  // Validar letra
  if (!['A', 'B', 'C', 'E', 'M'].includes(body.invoice_letter)) {
    errors.push('invoice_letter must be A, B, C, E, or M');
  }
  
  // Validar items
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    errors.push('items is required and must not be empty');
  } else {
    body.items.forEach((item: any, index: number) => {
      if (!item.description) {
        errors.push(`items[${index}].description is required`);
      }
      if (!item.quantity || item.quantity <= 0) {
        errors.push(`items[${index}].quantity must be greater than 0`);
      }
      if (!item.unit_price || item.unit_price < 0) {
        errors.push(`items[${index}].unit_price must be greater than or equal to 0`);
      }
      if (item.iva_rate === undefined) {
        errors.push(`items[${index}].iva_rate is required`);
      }
    });
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Calcula los totales de una factura
 */
function calculateTotals(items: InvoiceItem[]): {
  subtotal: number;
  iva_total: number;
  total: number;
} {
  let subtotal = 0;
  let iva_total = 0;
  
  for (const item of items) {
    const itemSubtotal = item.quantity * item.unit_price;
    const itemIva = itemSubtotal * (item.iva_rate / 100);
    
    subtotal += itemSubtotal;
    iva_total += itemIva;
  }
  
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    iva_total: Math.round(iva_total * 100) / 100,
    total: Math.round((subtotal + iva_total) * 100) / 100
  };
}

// ==================== PROCESAMIENTO AFIP ====================

/**
 * Procesa una factura
 * 
 * En FASE 1 (mock): Simula el proceso sin llamar a AFIP
 * En FASE 2+: Implementa la conexión real con AFIP (WSAA + WSFEv1)
 */
async function processInvoice(requestData: InvoiceRequest): Promise<InvoiceResponse> {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  // Validar request
  const validation = validateInvoiceRequest(requestData);
  if (!validation.valid) {
    return {
      id,
      status: 'REJECTED',
      tenant_id: requestData.tenant_id,
      invoice_type: requestData.invoice_type,
      invoice_letter: requestData.invoice_letter,
      subtotal: 0,
      iva_total: 0,
      total: 0,
      client_name: requestData.client_name,
      client_cuit: requestData.client_cuit,
      created_at: now,
      error: {
        code: 'VALIDATION_ERROR',
        message: validation.errors.join('; ')
      }
    };
  }
  
  // Calcular totales
  const totals = calculateTotals(requestData.items);
  
  // =====================================================
  // FASE 1: MOCK - Simular proceso AFIP
  // =====================================================
  // En esta fase, simulamos que la factura fue autorizada
  // sin llamar realmente a AFIP
  
  // TODO: FASE 2+ - Implementar llamada real a AFIP
  // - Obtener token AFIP (WSAA)
  // - Crear comprobante (WSFEv1)
  // - Obtener CAE
  // - Obtener número de comprobante
  
  // Simular éxito (en FASE 1)
  return {
    id,
    status: 'PENDING', // 'PENDING' porque AFIP real no está implementado
    tenant_id: requestData.tenant_id,
    invoice_type: requestData.invoice_type,
    invoice_letter: requestData.invoice_letter,
    subtotal: totals.subtotal,
    iva_total: totals.iva_total,
    total: totals.total,
    client_name: requestData.client_name,
    client_cuit: requestData.client_cuit,
    created_at: now
  };
}

// ==================== RUTAS ====================

/**
 * POST /process
 * Procesa una factura (recibe datos del Worker)
 */
server.post<{ Body: InvoiceRequest }>('/process', async (request, reply) => {
  // Aplicar autenticación interna
  await authenticateInternal(request, reply);
  if (reply.statusCode === 401) {
    return;
  }
  
  const requestData = request.body as InvoiceRequest;
  
  request.log.info({ 
    tenant_id: requestData.tenant_id,
    client_name: requestData.client_name 
  }, 'Processing invoice request');
  
  try {
    // Procesar la factura
    const result = await processInvoice(requestData);
    
    request.log.info({ 
      id: result.id, 
      status: result.status 
    }, 'Invoice processed');
    
    return reply.status(200).send(result);
  } catch (error) {
    request.log.error({ error }, 'Error processing invoice');
    
    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'Error processing invoice'
    });
  }
});

/**
 * GET /health
 * Health check del servidor
 */
server.get('/health', async (request, reply) => {
  return reply.status(200).send({
    status: 'ok',
    service: 'afip-server',
    timestamp: new Date().toISOString()
  });
});

// ==================== INICIAR SERVIDOR ====================

const start = async () => {
  try {
    await server.listen({ port: PORT, host: '0.0.0.0' });
    
    server.log.info(`
╔═══════════════════════════════════════════════════════╗
║           AFIP Server - ONLINE                     ║
╠═══════════════════════════════════════════════════════╣
║  Puerto: ${PORT}                                        ║
║  Ambiente: ${process.env.NODE_ENV || 'development'}         ║
║  Auth: Bearer Token (configurado)                ║
╚═══════════════════════════════════════════════════════╝
    `);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();