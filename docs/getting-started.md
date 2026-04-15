# API AFIP — Getting Started

Guía paso a paso para poner en marcha el sistema de facturación.

## 📋 Requisitos Previos

- Node.js 18+
- npm o yarn
- Cloudflare Tunnel (cloudflared)
- Cuenta de Cloudflare
- (Opcional) Credenciales AFIP para producción

## 🏗️ Arquitectura del Sistema

```
Cliente (Frontend/ERP)
        ↓
Cloudflare Worker (Puerto 443 - público)
        ↓
Cloudflare Tunnel (https://tu-tunnel.trycloudflare.com)
        ↓
Servidor Local (Node.js - tu PC)
        ↓
AFIP (WSAA + WSFEv1) [FASE 3]
```

## 🚀 FASE 1: Servidor Local

### 1.1 Instalación

```bash
# Ir a la carpeta del servidor
cd server

# Instalar dependencias
npm install

# Copiar configuración de ejemplo
cp ../config/.env.example .env
```

### 1.2 Configuración

Editá el archivo `.env`:

```bash
# Seguridad - GENERÁ CLAVES ÚNICAS
# Linux/Mac: openssl rand -base64 32
# PowerShell: [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 255 }))

INTERNAL_API_KEY=tu-clave-segura-aqui

# Puerto del servidor
PORT=3000
```

### 1.3 Iniciar el Servidor

```bash
# Modo desarrollo (con hot reload)
npm run dev

# O compilar y ejecutar
npm run build
npm start
```

Deberías ver:

```
╔═══════════════════════════════════════════════════════╗
║           AFIP Server - ONLINE                     ║
╠═══════════════════════════════════════════════════════╣
║  Puerto: 3000                                      ║
║  Ambiente: development                               ║
║  Auth: Bearer Token (configurado)                    ║
╚═══════════════════════════════════════════════════════╝
```

### 1.4 Probar el Servidor

```bash
# En otra terminal
curl -X POST http://localhost:3000/process \
  -H "Authorization: Bearer TU_INTERNAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Test SA",
    "client_cuit": "30711223334",
    "invoice_type": 1,
    "invoice_letter": "A",
    "items": [
      {
        "description": "Producto test",
        "quantity": 1,
        "unit_price": 100,
        "iva_rate": 21
      }
    ]
  }'
```

Deberías obtener una respuesta con `status: "PENDING"`.

## 🌐 FASE 2: Cloudflare Tunnel

### 2.1 Instalar cloudflared

**Windows (PowerShell - como admin):**
```powershell
irm https://raw.githubusercontent.com/cloudflare/cloudflared/master/cmd/cloudflared/install.ps1 | iex
```

**Mac/Linux:**
```bash
brew install cloudflared
# o
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
```

### 2.2 Crear el túnel

```bash
cloudflared tunnel --url http://localhost:3000
```

Esto te dará una URL типа:
```
https://random-name.trycloudflare.com
```

### 2.3 Guardar la URL

Copia esa URL y ponela en tu `.env` del servidor:

```bash
AFIP_SERVICE_URL=https://random-name.trycloudflare.com
```

## ☁️ FASE 3: Cloudflare Worker

### 3.1 Preparar el Worker

```bash
cd worker

# Instalar dependencias
npm install
```

### 3.2 Configurar Secrets

```bash
#PUBLIC_API_KEY: para tus clientes
wrangler secret put PUBLIC_API_KEY

#INTERNAL_API_KEY: la misma que en tu .env del servidor
wrangler secret put INTERNAL_API_KEY

#AFIP_SERVICE_URL: tu URL de Cloudflare Tunnel
wrangler secret put AFIP_SERVICE_URL
```

### 3.3 Desplegar

```bash
npm run deploy
```

Te dará un dominio типа:
```
https://afip-api.tu-usuario.workers.dev
```

## 🧪 Probando el Sistema Completo

### Desde el Cliente

```bash
curl -X POST https://tu-worker.workers.dev/invoices \
  -H "x-api-key: TU_PUBLIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Empresa Test S.A.",
    "client_cuit": "30711223334",
    "invoice_type": 1,
    "invoice_letter": "A",
    "items": [
      {
        "description": "Consultoría técnica",
        "quantity": 5,
        "unit_price": 5000,
        "iva_rate": 21
      }
    ]
  }'
```

### Respuesta Exitosa

```json
{
  "success": true,
  "data": {
    "id": "uuid-aqui",
    "status": "PENDING",
    "invoice_type": 1,
    "invoice_letter": "A",
    "subtotal": 25000,
    "iva_total": 5250,
    "total": 30250,
    "client_name": "Empresa Test S.A.",
    "client_cuit": "30711223334",
    "created_at": "2026-04-15T10:30:00.000Z"
  }
}
```

## 🔐 Checklist de Seguridad

- [ ] INTERNAL_API_KEY configurada (no usar默认值)
- [ ] PUBLIC_API_KEY configurada en Worker
- [ ] AFIP_SERVICE_URL configurada
- [ ] Tunnel activo y funcionando
- [ ] Worker desplegado

## ❓ Troubleshooting

### "Bad Gateway" desde el Worker
- Verificá que el servidor local esté corriendo
- Verificá la URL del Tunnel en AFIP_SERVICE_URL
- Verificá que INTERNAL_API_KEY sea la misma en ambos lugares

### "Unauthorized" desde Postman
- Verificá el header `x-api-key`
- La clave debe ser la PUBLIC_API_KEY configurada en Worker

### Error de rate limiting
- Too many requests — esperá 1 minuto
- Los límites se resetean automáticamente

---

**¿Necesitás ayuda?** Creá un issue en el repo o preguntame directamente.