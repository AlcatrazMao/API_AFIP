# 🚀 API AFIP - Sistema de Facturación Electrónica

## ℹ️ INFORMACIÓN

Este es un sistema completo de facturación electrónica AFIP desarrollado con:

- **Cloudflare Workers** (API Gateway)
- **Node.js + Fastify** (Servidor local)
- **Cloudflare Tunnel** (Conexión segura)

---

## 📋 INSTALACIÓN

### Requisitos Previos

- Node.js 18+
- Cuenta de Cloudflare
- Certificados AFIP (opcional - para producción real)

### Pasos

1. **Instalar dependencias del servidor:**
   ```
   cd server
   npm install
   ```

2. **Instalar dependencias del worker:**
   ```
   cd worker
   npm install
   ```

3. **Configurar credenciales:**

   ### Para el Worker (Cloudflare):
   ```
   cd worker
   wrangler secret put PUBLIC_API_KEY
   wrangler secret put INTERNAL_API_KEY
   wrangler secret put AFIP_SERVICE_URL
   ```

   ### Para el Servidor (server/.env):
   ```
   AFIP_CUIT=tu_cuit_sin_guiones
   AFIP_PUNTO_VTA=0001
   INTERNAL_API_KEY=tu_clave_interna
   ```

4. **Poner certificados AFIP** (opcional):
   ```
   server/certs/
   ├── certificado.crt
   └── clave.key
   ```

---

## ▶️ EJECUTAR

### Opción 1: start.bat (Automático)

Ejecutar `start.bat` - abre dos terminales:
- Una con el servidor
- Otra con el Cloudflare Tunnel

### Opción 2: Manual

**Terminal 1 - Servidor:**
```
cd server
npm run dev
```

**Terminal 2 - Cloudflare Tunnel:**
```
cloudflared.exe tunnel --url http://localhost:3000
```

---

## 🧪 PROBAR

### Health Check:
```
curl https://tu-worker.workers.dev/health
```

### Crear Factura:
```
curl -X POST https://tu-worker.workers.dev/invoices \
  -H "x-api-key: TU_PUBLIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Empresa Test SA",
    "client_cuit": "30711223334",
    "invoice_type": 1,
    "invoice_letter": "A",
    "items": [
      {
        "description": "Producto test",
        "quantity": 1,
        "unit_price": 1000,
        "iva_rate": 21
      }
    ]
  }'
```

---

## 🎯 MODOS DE OPERACIÓN

| Modo | Descripción | Archivos requeridos |
|------|------------|-------------------|
| **MOCK** | Simula facturas (pruebas) | Ninguno |
| **AFIP REAL** | Facturación Electrónica Real | certificado.crt + clave.key + .env |

---

## 📁 ESTRUCTURA

```
API_AFIP/
├── worker/              # Cloudflare Worker
│   ├── src/
│   ├── wrangler.toml
│   └── package.json
├── server/             # Servidor Node.js
│   ├── src/
│   │   ├── server.ts   # Servidor principal
│   │   └── afip/     # Módulos AFIP
│   │       ├── wsaa.ts    # Autenticación
│   │       ├── wsfe.ts    # Facturación
│   │       └── types.ts   # Tipos
│   ├── certs/         # Certificados AFIP
│   ├── .env          # Configuración
│   └── package.json
├── docs/              # Documentación
├── examples/          # Ejemplos
└── start.bat         # Inicio automático
```

---

## 🔐 SEGURIDAD

- ✅ API Key para clientes (Worker)
- ✅ Bearer Token para servidor interno
- ✅ Validación estricta de inputs
- ✅ Rate limiting básico

**IMPORTANTE:**
- NUNCA hacer commit de `.env`
- NUNCA subir certificados al repo
- Usar `.gitignore` para excluir `certs/`

---

## ⚠️ ERRORES COMUNES

| Error | Solución |
|-------|----------|
| "UNAUTHORIZED" | Verificar API key en header |
| "Certificado no encontrado" | Verificar certificado.crt en certs/ |
| "Backend not configured" | Actualizar AFIP_SERVICE_URL en Worker |
| "Puerto en uso" | Cerrar otra aplicación en puerto 3000 |

---

## 📞 SOPorte

- Revisar `server/SETUP.md` para configuración detallada
- Revisar `docs/getting-started.md` para guía paso a paso

---

## 📝 LICENCIA

MIT - USAR BAJO PROPIO RISGO

---

**Desarrollado con ❤️ para Argentina**