# VendorPass MCP Server

Conecta VendorPass a Claude (Desktop / Code) usando una API key.

## Instalación

```bash
cd mcp-server
npm install
npm run build
```

## Obtener una API key

En la app: **Integraciones → Generar API key**. Copiala (se muestra una sola vez).

## Claude Desktop

Editá `claude_desktop_config.json` y agregá:

```json
{
  "mcpServers": {
    "vendorpass": {
      "command": "node",
      "args": ["/RUTA/ABSOLUTA/vendor-pass/mcp-server/dist/index.js"],
      "env": {
        "VENDORPASS_API_KEY": "vp_tu_clave",
        "VENDORPASS_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

Reiniciá Claude Desktop.

## Claude Code

```bash
claude mcp add vendorpass \
  --env VENDORPASS_API_KEY=vp_tu_clave \
  --env VENDORPASS_BASE_URL=http://localhost:3000 \
  -- node /RUTA/ABSOLUTA/vendor-pass/mcp-server/dist/index.js
```

## Probar

Preguntale a Claude: *"¿Qué proveedores tengo bloqueados y por qué?"* — usará las
herramientas `list_vendors` / `get_vendor_compliance`. O pedile un **reporte de auditoría
blockchain** y usará `arkiv_report` / `arkiv_audit` / `verify_document`.

## Herramientas

| Tool | Descripción |
|---|---|
| `list_vendors` | Proveedores + estado de cumplimiento |
| `get_vendor` | Detalle de un proveedor + documentos |
| `get_vendor_compliance` | Estado, habilitación y razones |
| `list_documents` | Documentos (filtro `vendor_id` opcional) |
| `list_expirations` | Documentos por vencer / vencidos |
| `verify_document` | Valida un documento contra Arkiv (en cadena, estado y hash) |
| `arkiv_audit` | Auditoría de paridad DB↔Arkiv (faltantes, huérfanos, diferencias) |
| `arkiv_report` | Reporte de auditoría (cumplimiento + paridad + conclusión) |
