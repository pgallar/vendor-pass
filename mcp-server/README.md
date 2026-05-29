# VendorPass MCP Server (stdio, solo desarrollo)

Paquete **opcional** para probar MCP en local vía proceso stdio. Los usuarios de la app deben usar el **servidor remoto** documentado en Integraciones → [Guía MCP](/integrations/mcp) (`https://tu-dominio/api/mcp` + API key).

## Desarrollo local (stdio)

```bash
cd mcp-server
npm install
npm run build
```

Variables: `VENDORPASS_API_KEY`, `VENDORPASS_BASE_URL` (default `http://localhost:3000`).

Este modo llama a la REST API `/api/v1/*`; en producción preferí el endpoint remoto `/api/mcp` integrado en la app.
