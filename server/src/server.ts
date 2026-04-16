/**
 * AFIP Server - Producción
 * 
 * Configuración automática:
 * - Poner certificado.crt y clave.key en server/certs/
 * - Configurar .env con CUIT
 * - Si no hay archivos, funciona en MOCK
 */

import Fastify from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { AfipConfig, AFIP_CODES } from './afip/types.js';
import { getAfipAuth } from './afip/wsaa.js';
import { createAfipInvoice } from './afip/wsfe.js';

// Cargar configuración
dotenv.config();

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || process.exit(1);
const PORT = parseInt(process.env.PORT || '3000', 10);
const SERVER_DIR = process.cwd();

// ============================================
// DETECTAR AFIP
// ============================================
function getAfipConfig(): AfipConfig | null {
  const certPath = path.join(SERVER_DIR, 'certs', 'certificado.crt');
  const keyPath = path.join(SERVER_DIR, 'certs', 'clave.key');
  const CUIT = process.env.AFIP_CUIT;
  
  if (!CUIT || !fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    return null;
  }
  
  return {
    CUIT: CUIT.replace(/-/g, ''),
    certPath,
    keyPath,
    environment: (process.env.AFIP_ENV as any) || 'produccion'
  };
}

const afipConfig = getAfipConfig();

const server = Fastify({ logger: true });

// ============================================
// AUTH MIDDLEWARE
// ============================================
const requireAuth = async (request: any, reply: any) => {
  const auth = request.headers.authorization;
  if (!auth) {
    return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Missing Authorization header' });
  }
  
  const token = auth.replace('Bearer ', '').replace('ApiKey ', '');
  if (token !== INTERNAL_API_KEY) {
    return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Invalid token' });
  }
};

// ============================================
// VALIDATION
// ============================================
const validateInvoiceRequest = (body: any) => {
  const errors: string[] = [];
  
  if (!body.client_name || typeof body.client_name !== 'string') errors.push('client_name required');
  if (!body.client_cuit) errors.push('client_cuit required');
  else {
    const cuit = body.client_cuit.replace(/-/g, '');
    if (!/^\d{11}$/.test(cuit)) errors.push('client_cuit must be 11 digits');
  }
  if (!body.invoice_type) errors.push('invoice_type required');
  if (!['A','B','C','E','M'].includes(body.invoice_letter)) errors.push('invoice_letter required (A,B,C,E,M)');
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) errors.push('items required');
  else {
    body.items.forEach((item: any, i: number) => {
      if (!item.description) errors.push(`items[${i}].description required`);
      if (!item.quantity || item.quantity <= 0) errors.push(`items[${i}].quantity must be > 0`);
      if (item.unit_price === undefined || item.unit_price < 0) errors.push(`items[${i}].unit_price required`);
      if (item.iva_rate === undefined) errors.push(`items[${i}].iva_rate required`);
    });
  }
  
  return errors;
};

const calculateTotals = (items: any[]) => {
  let subtotal = 0, iva_total = 0;
  for (const item of items) {
    const s = item.quantity * item.unit_price;
    subtotal += s;
    iva_total += s * (item.iva_rate / 100);
  }
  return { 
    subtotal: Math.round(subtotal * 100) / 100,
    iva_total: Math.round(iva_total * 100) / 100,
    total: Math.round((subtotal + iva_total) * 100) / 100
  };
};

// ============================================
// CONVERTIR A FORMATO AFIP
// ============================================
function toAfipInvoice(body: any, puntoVta: number) {
  const ivaMap: Record<number, number> = { 21: 5, 10.5: 4, 0: 2 };
  const tipoDocMap: Record<string, number> = { CUIT: 80, CUIL: 86, DNI: 96 };
  
  return {
    tipo_cbte: body.invoice_type,
    punto_vta: puntoVta,
    fecha_cbte: new Date().toISOString().split('T')[0].replace(/-/g, ''),
    tipo_doc: tipoDocMap['CUIT'] || 80,
    nro_doc: body.client_cuit.replace(/-/g, ''),
    nombre_cliente: body.client_name,
    imp_total: 0, // Se calcula
    imp_neto: 0,
    imp_iva: 0,
    moneda_id: 'PES',
    cambio_mon: 1,
    items: body.items.map((item: any) => ({
      u_mtx: 0,
      descripcion: item.description,
      qty: item.quantity,
      umed: 7,
      precio: item.unit_price,
      iva_id: ivaMap[item.iva_rate] || 5,
      imp_iva: item.quantity * item.unit_price * (item.iva_rate / 100)
    }))
  };
}

// ============================================
// ROUTES
// ============================================

server.post('/process', { preHandler: requireAuth }, async (request, reply) => {
  const body = request.body as any;
  
  // Validate
  const errors = validateInvoiceRequest(body);
  if (errors.length > 0) {
    return reply.status(400).send({ 
      error: 'VALIDATION_ERROR', 
      message: errors.join('; ')
    });
  }
  
  const totals = calculateTotals(body.items);
  
  // MODO MOCK (sin credenciales AFIP)
  if (!afipConfig) {
    return reply.send({
      id: uuidv4(),
      status: 'PENDING',
      invoice_type: body.invoice_type,
      invoice_letter: body.invoice_letter,
      subtotal: totals.subtotal,
      iva_total: totals.iva_total,
      total: totals.total,
      client_name: body.client_name,
      client_cuit: body.client_cuit.replace(/-/g, ''),
      created_at: new Date().toISOString(),
      _note: 'MOCK - Configure AFIP credentials to get real invoices'
    });
  }
  
  // MODO AFIP REAL
  try {
    const puntoVta = parseInt(process.env.AFIP_PUNTO_VTA || '1');
    const afipInvoice = toAfipInvoice(body, puntoVta);
    afipInvoice.imp_neto = totals.subtotal;
    afipInvoice.imp_iva = totals.iva_total;
    afipInvoice.imp_total = totals.total;
    
    const result = await createAfipInvoice(afipConfig, afipInvoice);
    
    return reply.send({
      id: uuidv4(),
      status: 'APPROVED',
      cae: result.cae,
      caex_vto: result.fecha_vto,
      numero: result.numero,
      invoice_type: body.invoice_type,
      invoice_letter: body.invoice_letter,
      subtotal: totals.subtotal,
      iva_total: totals.iva_total,
      total: totals.total,
      client_name: body.client_name,
      client_cuit: body.client_cuit.replace(/-/g, ''),
      created_at: new Date().toISOString()
    });
  } catch (e: any) {
    request.log.error(e);
    return reply.status(500).send({
      error: 'AFIP_ERROR',
      message: e.message
    });
  }
});

server.get('/health', async (request, reply) => {
  return reply.send({ 
    status: 'ok', 
    service: 'afip-server',
    afip: afipConfig ? 'CONNECTED' : 'MOCK',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// START
// ============================================
server.listen({ port: PORT, host: '0.0.0.0' }, (err, addr) => {
  if (err) throw err;
  console.log(`
╔═══════════════════════════════════════════════════╗
║         AFIP Server - PRODUCCIÓN              ║
╠═══════════════════════════════════════════════════╣
║  Modo: ${afipConfig ? 'AFIP REAL     ' : 'MOCK        '}              ║
║  URL: ${addr.padEnd(38)}║
║  Auth: Bearer Token ✓                         ║
╚═══════════════════════════════════════════════════╝
  `);
});