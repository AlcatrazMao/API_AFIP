/**
 * AFIP API - Cloudflare Worker (Simplified)
 */

interface Env {
  PUBLIC_API_KEY: string;
  INTERNAL_API_KEY: string;
  AFIP_SERVICE_URL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Health check
    if (path === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        service: 'afip-api' 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Crear factura
    if (path === '/invoices' && request.method === 'POST') {
      // Autenticar
      const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization');
      if (!apiKey || apiKey !== env.PUBLIC_API_KEY) {
        return new Response(JSON.stringify({ 
          error: 'UNAUTHORIZED', 
          message: 'Invalid API key' 
        }), { status: 401 });
      }
      
      // Validar body
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ 
          error: 'INVALID_REQUEST', 
          message: 'Invalid JSON' 
        }), { status: 400 });
      }
      
      // Reenviar al servidor
      if (!env.AFIP_SERVICE_URL) {
        return new Response(JSON.stringify({ 
          error: 'BACKEND_ERROR', 
          message: 'Backend not configured' 
        }), { status: 502 });
      }
      
      try {
        const response = await fetch(env.AFIP_SERVICE_URL + '/process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + env.INTERNAL_API_KEY,
          },
          body: JSON.stringify(body),
        });
        
        const data = await response.json();
        return new Response(JSON.stringify(data), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ 
          error: 'BACKEND_ERROR', 
          message: e instanceof Error ? e.message : 'Connection failed' 
        }), { status: 502 });
      }
    }
    
    // 404
    return new Response(JSON.stringify({ 
      error: 'NOT_FOUND', 
      message: 'Endpoint not found' 
    }), { status: 404 });
  }
};