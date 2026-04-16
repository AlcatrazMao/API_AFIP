// AFIP Types - Tipos para la integración con AFIP

export interface AfipConfig {
  CUIT: string;
  certPath: string;
  keyPath: string;
  environment: 'homologacion' | 'produccion';
}

export interface AfipAuth {
  token: string;
  sign: string;
  expiresAt: Date;
}

export interface AfipInvoiceRequest {
  /* Datos del comprobante */
  tipo_cbte: number;      // 1=Factura A, 6=Factura B, etc.
  punto_vta: number;      // Punto de venta (4 dígitos)
  cbte_nro?: number;      // Número de comprobante (opcional)
  
  /* Fechas */
  fecha_cbte: string;      // YYYYMMDD
  fecha_venc_pago?: string; // YYYYMMDD
  
  /* Cliente */
  tipo_doc: number;        // 80=CUIT, 96=DNI, etc.
  nro_doc: string;         // Número de documento
  nombre_cliente?: string; // Nombre del cliente
  
  /* Impuestos */
  imp_total: number;       // Importe total
  imp_neto: number;        // Importe neto
  imp_iva: number;         // Importe IVA
  imp_trib?: number;       // Importe tributos
  
  /* Moneda */
  moneda_id: string;       // PES=Peso, USD=Dólar
  cambio_mon?: number;     // Tipo de cambio
  
  /* Items */
  items: AfipInvoiceItem[];
}

export interface AfipInvoiceItem {
  u_mtx: number;           // Código MTX
  cod_mtx?: string;        // Código
  descripcion: string;     // Descripción
  qty: number;             // Cantidad
  umed: number;            // Unidad de medida (7=unidades)
  precio: number;          // Precio unitario
  bonif?: number;          // Bonificación
  iva_id: number;          // ID IVA (5=21%, 4=10.5%, etc.)
  imp_iva: number;         // Importe IVA
  imp_bonif?: number;      // Importe bonificación
}

export interface AfipInvoiceResponse {
  cae: string;             // Código de Autorización Electrónico
  fecha_vto: string;       // Fecha de vencimiento CAE (YYYYMMDD)
  numero: number;          // Número de comprobante
  tipo_cbte: number;
  punto_vta: number;
}

// Códigos de AFIP
export const AFIP_CODES = {
  // Tipos de documento
  DOC_TIPO: {
    CUIT: 80,
    CUIL: 86,
    DNI: 96,
    PASAPORTE: 94,
  },
  
  // Tipos de comprobante
  CBTE_TIPO: {
    'FACTURA_A': 1,
    'NOTA_DEBITO_A': 2,
    'NOTA_CREDITO_A': 3,
    'FACTURA_B': 6,
    'NOTA_DEBITO_B': 7,
    'NOTA_CREDITO_B': 8,
    'FACTURA_E': 11,
    'FACTURA_C': 81,
  },
  
  // IVA
  IVA_TIPO: {
    'EXENTO': 1,
    '0%': 2,
    '10.5%': 4,
    '21%': 5,
    '27%': 6,
  },
  
  // Monedas
  MONEDA: {
    'PES': 'PES',
    'USD': 'USD',
    'EUR': 'EUR',
  },
  
  // Puntos de venta (usan 4 dígitos)
  // Los más comunes: 0001-9999
} as const;