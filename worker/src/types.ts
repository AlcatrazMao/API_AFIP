/**
 * Tipos para el Cloudflare Worker
 */

export interface Context {
  request: Request;
  env: WorkerEnv;
  ctx: WaitUntilExecutor;
  waitUntil(promise: Promise<any>): void;
}

export interface WaitUntilExecutor {
  (promise: Promise<any>): void;
}

export interface WorkerEnv {
  PUBLIC_API_KEY: string;
  INTERNAL_API_KEY: string;
  AFIP_SERVICE_URL: string;
  ENV?: string;
  VERSION?: string;
  AFIP_SERVICE_KV?: KVNamespace;
}

export interface InvoiceRequest {
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

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  iva_rate: number;
}

export interface InvoiceResponse {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ERROR';
  tenant_id?: string;
  invoice_type: number;
  invoice_letter: string;
  subtotal: number;
  iva_total: number;
  total: number;
  client_name: string;
  client_cuit: string;
  created_at: string;
  updated_at?: string;
  error?: {
    code: string;
    message: string;
  };
}