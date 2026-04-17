/**
 * Security Module - Protección de archivos sensibles
 * 
 * Estrategia:
 * 1. Archivos en location seguro (%APPDATA%/AFIP-API/)
 * 2. Encriptación AES-256-GCM con clave derivada de password
 * 3. Tokens cache encriptados
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import crypto from 'crypto';

// Location seguro - fuera del proyecto
const SECURE_DIR = path.join(os.homedir(), 'AFIP-API');
const CREDS_FILE = path.join(SECURE_DIR, 'creds.enc');
const TOKEN_FILE = path.join(SECURE_DIR, 'token.enc');

// Crear directorio si no existe
if (!fs.existsSync(SECURE_DIR)) {
  fs.mkdirSync(SECURE_DIR, { recursive: true });
}

// ============================================
// ENCRIPTACIÓN
// ============================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Derivar clave de una password usando PBKDF2
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Encriptar datos con password
 */
export function encrypt(data: string, password: string): Buffer {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(password, salt);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  // Formato: salt + iv + authTag + encrypted
  return Buffer.concat([salt, iv, authTag, encrypted]);
}

/**
 * Desencriptar datos con password
 */
export function decrypt(encryptedData: Buffer, password: string): string {
  const salt = encryptedData.subarray(0, SALT_LENGTH);
  const iv = encryptedData.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = encryptedData.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = encryptedData.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  
  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

// ============================================
// CREDENCIALES AFIP
// ============================================

export interface AfipCredentials {
  CUIT: string;
  certPath: string;
  keyPath: string;
  environment: 'homologacion' | 'produccion';
}

/**
 * Guardar credenciales encriptadas
 */
export function saveCredentials(creds: AfipCredentials, password: string): void {
  const data = JSON.stringify(creds);
  const encrypted = encrypt(data, password);
  fs.writeFileSync(CREDS_FILE, encrypted);
  console.log('[SECURITY] Credenciales guardadas en:', CREDS_FILE);
}

/**
 * Cargar credenciales encriptadas
 */
export function loadCredentials(password: string): AfipCredentials | null {
  if (!fs.existsSync(CREDS_FILE)) {
    return null;
  }
  
  try {
    const encrypted = fs.readFileSync(CREDS_FILE);
    const data = decrypt(encrypted, password);
    return JSON.parse(data);
  } catch (e) {
    console.error('[SECURITY] Error al desencriptar credenciales');
    return null;
  }
}

/**
 * Verificar si hay credenciales guardadas
 */
export function hasCredentials(): boolean {
  return fs.existsSync(CREDS_FILE);
}

// ============================================
// TOKEN CACHE
// ============================================

export interface TokenCache {
  token: string;
  expires: string;
  service: string;
}

/**
 * Guardar token en cache encriptado
 */
export function saveTokenCache(tokenInfo: TokenCache, password: string): void {
  const data = JSON.stringify(tokenInfo);
  const encrypted = encrypt(data, password);
  fs.writeFileSync(TOKEN_FILE, encrypted);
}

/**
 * Cargar token desde cache
 */
export function loadTokenCache(password: string): TokenCache | null {
  if (!fs.existsSync(TOKEN_FILE)) {
    return null;
  }
  
  try {
    const encrypted = fs.readFileSync(TOKEN_FILE);
    const data = decrypt(encrypted, password);
    const tokenInfo = JSON.parse(data);
    
    // Verificar si expiró
    if (new Date(tokenInfo.expires) < new Date()) {
      return null;
    }
    
    return tokenInfo;
  } catch (e) {
    return null;
  }
}

/**
 * Limpiar cache de tokens
 */
export function clearTokenCache(): void {
  if (fs.existsSync(TOKEN_FILE)) {
    fs.unlinkSync(TOKEN_FILE);
  }
}

/**
 * Obtener la ruta del directorio seguro
 */
export function getSecureDir(): string {
  return SECURE_DIR;
}