# API AFIP — Sistema de Facturación Electrónica

API de facturación electrónica con AFIP (Argentina). Arquitectura profesional basada en Cloudflare Workers + Servidor Local (Node.js).

## 🏗️ Arquitectura

```
Cliente (Frontend/ERP)
        ↓
Cloudflare Worker (API Gateway - Seguridad + Validación)
        ↓
Cloudflare Tunnel (HTTP Público Seguro)
        ↓
Servidor Local (Node.js + Fastify - Lógica AFIP)
        ↓
AFIP (WSAA + WSFEv1) [FASE 3]
```

## 📦 Estructura del Proyecto

```
/worker              → Cloudflare Worker (TypeScript)
/server              → Servidor Node.js (Fastify + TypeScript)/config              → Archivos de configuración.env.example       → Ejemplo de variables de entorno
README.md            → Este archivo
```

## 🚀 Getting Started

### Prerrequisitos

- Node.js 18+
- Cloudflare Tunnel (cloudflared)
- Credenciales AFIP (para producción)

### Pasos de Instalación

1. **Clonar el repositorio**
2. **Instalar dependencias del servidor**
3. **Configurar variables de entorno**
4. **Iniciar Cloudflare Tunnel**
5. **Desplegar Cloudflare Worker**

Ver `docs/getting-started.md` para instrucciones detalladas.

## 🔐 Seguridad

- ✅ API Key paraAuthentication de clientes
- ✅ Auth interna (Bearer token) entre Worker y Server
- ✅ Validación estricta de inputs
- ✅ Rate limiting básico
- ✅ Logs de requests/responses

## 📬 Endpoints

### Cloudflare Worker

| Método | Endpoint | Descripción |
|--------|----------|--------------|
| POST   | /invoices | Crear factura |
| GET    | /invoices/:id | Obtener estado |
| GET    | /health    | Health check |

### Servidor Local

| Método | Endpoint | Descripción |
|--------|----------|--------------|
| POST   | /process  | Procesar factura |
| GET    | /health   | Health check |

## 🧪 testing

```bash
# Servidor local
curl -X POST http://localhost:3000/process \
  -H "Authorization: Bearer TU_INTERNAL_KEY" \
  -H "Content-Type: application/json" \
  -d @examples/invoice-request.json
```

## 📚 Documentación

- [Getting Started](docs/getting-started.md)
- [API Reference](docs/api-reference.md)
- [Configuración AFIP](docs/afip-setup.md)
- [Deploy Guide](docs/deploy.md)

## 🔄 Estado del Sistema

- [ ] FASE 1: Worker + Server básico funcionando
- [ ] FASE 2: Mock AFIP (simulación)
- [ ] FASE 3: AFIP real (WSAA + WSFEv1)

## �许可证

MIT License - See LICENSE file

---

**Construido con:** Cloudflare Workers, Fastify, TypeScript