# AFIP Server - Configuración

## 🚀 Instalación Rápida

```bash
npm install
npm run dev
```

## 📋 Configuración

### 1. Archivo `.env`

Editá el archivo `.env` con tu configuración:

```env
# Tu CUIT (sin guiones)
AFIP_CUIT=20111111112

# Punto de venta (4 dígitos)
AFIP_PUNTO_VTA=0001

# Entorno: homologacion o produccion
AFIP_ENV=produccion

# Clave de seguridad
INTERNAL_API_KEY=tu-clave-segura-aqui
```

### 2. Certificados AFIP

Poné tus archivos en la carpeta `certs/`:

```
server/
├── certs/
│   ├── certificado.crt   ← Tu certificado .crt
│   └── clave.key        ← Tu clave privada .key
├── src/
├── .env
└── package.json
```

### 3. Obtener Certificados AFIP

1. Entrá a [AFIP Homologación](https://fwshomo.afip.gov.ar/)
2. Solicitá el certificado para WSFEV1
3. Descargá el certificado (.crt)
4. Descargá la clave privada (.key)

## 🧪 Probar sin AFIP (Mock)

Si no tenés los certificados, el servidor funciona en modo MOCK:

```json
{
  "status": "PENDING",
  "_note": "MOCK - Configure AFIP credentials to get real invoices"
}
```

## 🔧 Punto de Venta

Los puntos de venta se configuran en AFIP. El más común es `0001`.

Si necesitás más, solicitálos en AFIP y agregalos al .env:

```env
AFIP_PUNTO_VTA=0002
```

## 📝 Formato de Factura

### Request
```json
{
  "client_name": "Empresa SA",
  "client_cuit": "30711223334",
  "invoice_type": 1,
  "invoice_letter": "A",
  "items": [
    {
      "description": "Producto",
      "quantity": 1,
      "unit_price": 1000,
      "iva_rate": 21
    }
  ]
}
```

### Respuesta (con AFIP real)
```json
{
  "status": "APPROVED",
  "cae": "12345678901234",
  "caex_vto": "20260430",
  "numero": 1,
  "total": 1210
}
```

## ⚠️ Errores Comunes

| Error | Solución |
|-------|----------|
| "Certificado no encontrado" | Verificar que `certificado.crt` existe en `certs/` |
| "Clave privada no encontrada" | Verificar que `clave.key` existe en `certs/` |
| "CUIT inválido" | El CUIT en .env debe ser sin guiones |
| "WSFEv1 no autorizado" | Solicitar habilitación en AFIP |

## 🔐 Seguridad

- **NUNCA** hagás commit del `.env`
- **NUNCA** subás los archivos `.crt` y `.key` al repositorio
- Usá `.gitignore` para excluir `certs/` y `.env`
