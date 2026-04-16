/**
 * WSAA - Webservice de Autenticación y Autorización AFIP
 * Este módulo maneja la autenticación con AFIP para obtener el token
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { AfipConfig, AfipAuth } from './types.js';

const WSAA_URLS = {
  homologacion: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
  produccion: 'https://wsaa.afip.gov.ar/ws/services/LoginCms'
};

const SERVICE = 'wsfe';

/**
 * Genera el XML para el pedido de ticket de acceso
 */
function generateLoginTicketRequest(config: AfipConfig): string {
  const uniqueId = Math.floor(Math.random() * 1000000);
  const generationTime = new Date().toISOString();
  const expirationTime = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(); // 12 horas
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${generationTime}</generationTime>
    <expirationTime>${expirationTime}</expirationTime>
    <service>${SERVICE}</service>
  </header>
  <credentials>${config.CUIT}</credentials>
</loginTicketRequest>`;
}

/**
 * Firma el XML con la clave privada
 */
async function signRequest(xml: string, keyPath: string): Promise<string> {
  const { execSync } = await import('child_process');
  
  // Guardar XML temporal
  const tmpDir = process.env.TMPDIR || process.env.TEMP || '/tmp';
  const inFile = path.join(tmpDir, `login_${Date.now()}.xml`);
  const outFile = path.join(tmpDir, `login_signed_${Date.now()}.xml`);
  
  fs.writeFileSync(inFile, xml, 'utf8');
  
  // Firmar con OpenSSL
  try {
    execSync(`openssl smime -sign -signer "${keyPath}" -inkey "${keyPath}" -outform DER -out "${outFile}" -in "${inFile}"`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    const signedData = fs.readFileSync(outFile);
    
    // Limpiar archivos temporales
    fs.unlinkSync(inFile);
    fs.unlinkSync(outFile);
    
    return signedData.toString('base64');
  } catch (error) {
    throw new Error(`Error firmando request: ${error}`);
  }
}

/**
 * Envía el request a AFIP y obtiene el token
 */
async function callWsaa(signedRequest: string, config: AfipConfig): Promise<AfipAuth> {
  return new Promise((resolve, reject) => {
    const url = WSAA_URLS[config.environment];
    
    const postData = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <loginTicketRequest>${signedRequest}</loginTicketRequest>
  </soap:Body>
</soap:Envelope>`;

    const options = {
      hostname: url.replace('https://', '').replace('/ws/services/LoginCms', ''),
      path: '/ws/services/LoginCms',
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        // Parsear respuesta
        const tokenMatch = data.match(/<token>([^<]+)<\/token>/);
        const signMatch = data.match(/<sign>([^<]+)<\/sign>/);
        
        if (tokenMatch && signMatch) {
          resolve({
            token: tokenMatch[1],
            sign: signMatch[1],
            expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000)
          });
        } else {
          reject(new Error(`Error en autenticación AFIP: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Obtiene el token de AFIP (usa cache si no expiró)
 */
let cachedAuth: AfipAuth | null = null;

export async function getAfipAuth(config: AfipConfig): Promise<AfipAuth> {
  // Verificar cache
  if (cachedAuth && cachedAuth.expiresAt > new Date()) {
    return cachedAuth;
  }
  
  console.log('🔐 Obteniendo token AFIP...');
  
  // Verificar que existen los archivos
  if (!fs.existsSync(config.certPath)) {
    throw new Error(`Certificado no encontrado: ${config.certPath}`);
  }
  if (!fs.existsSync(config.keyPath)) {
    throw new Error(`Clave privada no encontrada: ${config.keyPath}`);
  }
  
  // Generar y firmar request
  const xml = generateLoginTicketRequest(config);
  const signedRequest = await signRequest(xml, config.certPath);
  
  // Obtener token
  cachedAuth = await callWsaa(signedRequest, config);
  
  console.log('✅ Token AFIP obtenido');
  return cachedAuth;
}

/**
 * Limpia el token cacheado (para forzar renovación)
 */
export function clearAuthCache(): void {
  cachedAuth = null;
}