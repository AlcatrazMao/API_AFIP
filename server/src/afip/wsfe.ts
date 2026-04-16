/**
 * WSFEv1 - Webservice de Facturación Electrónica AFIP
 * Este módulo maneja la creación de comprobantes electrónicos
 */

import * as https from 'https';
import { AfipConfig, AfipAuth, AfipInvoiceRequest, AfipInvoiceResponse } from './types.js';
import { getAfipAuth } from './wsaa.js';

/**
 * Genera el XML para crear un comprobante
 */
function generateInvoiceXml(
  auth: AfipAuth,
  invoice: AfipInvoiceRequest,
  config: AfipConfig
): string {
  const itemsXml = invoice.items.map(item => `
    <item>
      <codMtx>${item.cod_mtx || ''}</codMtx>
      <desc>${item.descripcion.substring(0, 300)}</desc>
      <qty>${item.qty}</qty>
      <umed>${item.umed}</umed>
      <precio>${item.precio.toFixed(2)}</precio>
      <bonif>${item.bonif || 0}</bonif>
      <ivaId>${item.iva_id}</ivaId>
      <ivaImp>${item.imp_iva.toFixed(2)}</ivaImp>
    </item>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <auth xmlns="http://ar.gov.afip.dif.factura.v1">
      <token>${auth.token}</token>
      <sign>${auth.sign}</sign>
      <cuit>${config.CUIT}</cuit>
      <service>wsfe</service>
    </auth>
  </soap:Header>
  <soap:Body>
    <FECAESolicitar xmlns="http://ar.gov.afip.dif.factura.v1">
      <FeCAEReq>
        <concepto>1</concepto>
        <docTipo>${invoice.tipo_doc}</docTipo>
        <docNro>${invoice.nro_doc}</docNro>
        <cbteTipo>${invoice.tipo_cbte}</cbteTipo>
        <puntoVta>${invoice.punto_vta}</puntoVta>
        <cbteNro>${invoice.cbte_nro || 0}</cbteNro>
        <fechaCbte>${invoice.fecha_cbte}</fechaCbte>
        <impTotal>${invoice.imp_total.toFixed(2)}</impTotal>
        <impNeto>${invoice.imp_neto.toFixed(2)}</impNeto>
        <impIVA>${invoice.imp_iva.toFixed(2)}</impIVA>
        <impTrib>${invoice.imp_trib || 0}</impTrib>
        <monId>${invoice.moneda_id}</monId>
        <monCotiz>${invoice.cambio_mon || 1}</monCotiz>
        <iva>
          <Iva>
            <Id>${invoice.items[0]?.iva_id || 5}</Id>
            <BaseImp>${invoice.imp_neto.toFixed(2)}</BaseImp>
            <Importe>${invoice.imp_iva.toFixed(2)}</Importe>
          </Iva>
        </iva>
        <CbteAsoc>
        </CbteAsoc>
      </FeCAEReq>
    </FECAESolicitar>
  </soap:Body>
</soap:Envelope>`;
}

/**
 * Envía el comprobante a AFIP
 */
async function callWsfe(
  xml: string,
  config: AfipConfig
): Promise<any> {
  return new Promise((resolve, reject) => {
    const isProd = config.environment === 'produccion';
    const hostname = isProd ? 'servicios1.afip.gov.ar' : 'wsfehomo.afip.gov.ar';
    const path = isProd ? '/wsfev1/service' : '/wsfe/service';
    
    const options = {
      hostname,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'Content-Length': Buffer.byteLength(xml)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          // Parsear respuesta básica
          const caeMatch = data.match(/<CAE>([^<]+)<\/CAE>/);
          const numeroMatch = data.match(/<CbteNro>([^<]+)<\/CbteNro>/);
          const vtoMatch = data.match(/<CAEFchVto>([^<]+)<\/CAEFchVto>/);
          const errorMatch = data.match(/<Msg>([^<]+)<\/Msg>/);
          
          if (caeMatch) {
            resolve({
              cae: caeMatch[1],
              numero: parseInt(numeroMatch?.[1] || '0'),
              fecha_vto: vtoMatch?.[1] || '',
              tipo_cbte: 0,
              punto_vta: 0
            });
          } else if (errorMatch) {
            reject(new Error(`AFIP Error: ${errorMatch[1]}`));
          } else {
            reject(new Error(`Error desconocido: ${data.substring(0, 500)}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(xml);
    req.end();
  });
}

/**
 * Crea un comprobante en AFIP
 */
export async function createAfipInvoice(
  config: AfipConfig,
  invoice: AfipInvoiceRequest
): Promise<AfipInvoiceResponse> {
  console.log(`📄 Creando comprobante AFIP: ${invoice.tipo_cbte} - ${invoice.punto_vta}-${invoice.cbte_nro}`);
  
  // Obtener auth
  const auth = await getAfipAuth(config);
  
  // Generar XML
  const xml = generateInvoiceXml(auth, invoice, config);
  
  // Enviar a AFIP
  const result = await callWsfe(xml, config);
  
  console.log(`✅ Comprobante autorizado! CAE: ${result.cae}`);
  
  return {
    cae: result.cae,
    fecha_vto: result.fecha_vto,
    numero: result.numero,
    tipo_cbte: invoice.tipo_cbte,
    punto_vta: invoice.punto_vta
  };
}

/**
 * Obtiene el último número de comprobante
 */
export async function getLastInvoiceNumber(
  config: AfipConfig,
  tipoCbte: number,
  puntoVta: number
): Promise<number> {
  const auth = await getAfipAuth(config);
  
  // En una implementación real, haríamos un request a AFIP
  // Por ahora devolvemos 0 y AFIP asignará el siguiente
  return 0;
}