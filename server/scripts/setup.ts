#!/usr/bin/env npx tsx
/**
 * Setup AFIP Credentials - Solo ejecutar UNA vez
 * 
 * Usage: npx tsx scripts/setup.ts
 * 
 * Este script:
 * 1. Pide password (para encriptar)
 * 2. Pide CUIT
 * 3. Pide path al certificado .crt
 * 4. Pide path a la clave .key
 * 5. Pide ambiente (homologacion/produccion)
 * 6. Guarda todo encriptado
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { saveCredentials, hasCredentials, getSecureDir } from '../src/security.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function pregunta(texto: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(texto, resolve);
  });
}

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════╗
║         AFIP Setup - Configuración              ║
╚═══════════════════════════════════════════════════╝
`);
  
  // Verificar si ya hay credenciales
  if (hasCredentials()) {
    console.log('⚠️  Ya hay credenciales guardadas.');
    const resp = await pregunta('Querés sobrescribirlas? (s/n): ');
    if (resp.toLowerCase() !== 's') {
      console.log('Cancelado.');
      process.exit(0);
    }
  }
  
  console.log('\n📁 Ubicación segura: ' + getSecureDir());
  console.log('(Los archivos se encriptan con AES-256)\n');
  
  // Password
  const password = await pregunta('Ingresá una password (para encriptar): ');
  if (password.length < 8) {
    console.log('❌ Password muy cortos. Mínimo 8 caracteres.');
    process.exit(1);
  }
  
  // Confirmar password
  const password2 = await pregunta('Confirmar password: ');
  if (password !== password2) {
    console.log('❌ No coinciden.');
    process.exit(1);
  }
  
  // CUIT
  console.log('\n--- Datos AFIP ---');
  const cuit = await pregunta('CUIT (sin guiones): ');
  if (!/^\d{11}$/.test(cuit)) {
    console.log('❌ CUIT debe tener 11 dígitos.');
    process.exit(1);
  }
  
  // Certificado
  let certPath = await pregunta('Path al certificado (.crt): ');
  certPath = path.resolve(certPath.trim());
  if (!fs.existsSync(certPath)) {
    console.log('❌ Archivo no existe:', certPath);
    process.exit(1);
  }
  
  // Clave
  let keyPath = await pregunta('Path a la clave (.key): ');
  keyPath = path.resolve(keyPath.trim());
  if (!fs.existsSync(keyPath)) {
    console.log('❌ Archivo no existe:', keyPath);
    process.exit(1);
  }
  
  // Ambiente
  console.log('\n--- Ambiente ---');
  console.log('1) homologacion (pruebas)');
  console.log('2) produccion (real)');
  const amb = await pregunta('Elegir (1/2): ');
  const environment = amb === '2' ? 'produccion' : 'homologacion';
  
  // Guardar
  saveCredentials({
    CUIT: cuit,
    certPath,
    keyPath,
    environment: environment as 'homologacion' | 'produccion'
  }, password);
  
  console.log('\n✅ Setup completado!');
  console.log('El certificado y clave se copiarán a:', getSecureDir());
  console.log('\n📌 IMPORTANTE:');
  console.log('   - Recordá tu password');
  console.log('   - Esta es la única vez que necesitás ingresarla');
  process.exit(0);
}

main();