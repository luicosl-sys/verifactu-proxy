// Proxy mTLS para VeriFactu (AEAT) — versión simplificada.
//
// El runtime de Base44 no soporta mTLS. Este proxy corre en Render (o cualquier
// plataforma Node.js) y hace el mTLS directamente con el módulo https de Node.js.
//
// Recibe un JSON con el certificado y la clave PEM en cada petición, así NO hace
// falta configurar el certificado en el proxy: el usuario lo sube una vez en la
// app (Configuración → VeriFactu) y la función backend lo extrae y lo envía aquí.
//
// Formato de la petición:
//   POST /  con cabecera X-Proxy-Key  y body = JSON { endpoint, soap, cert, key }
//     endpoint : URL completa del servicio de la AEAT
//     soap     : sobre SOAP XML a enviar
//     cert     : certificado PEM (cadena completa, leaf primero)
//     key      : clave privada PEM (PKCS#8)
//   Opcional: X-Proxy-Debug: 1  → devuelve JSON con detalles de la respuesta AEAT
//
// Respuesta: el cuerpo crudo que devuelve la AEAT (text/xml) con su Content-Type,
// o un JSON de error si el proxy no pudo conectar.

const http = require('http');
const https = require('https');

const HOSTS_PERMITIDOS = [
  'prewww1.aeat.es',
  'www1.agenciatributaria.gob.es',
  'www2.agenciatributaria.gob.es',
  'www7.aeat.es',
];

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=UTF-8' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  // Autenticación
  const proxyKey = req.headers['x-proxy-key'];
  if (!proxyKey || !process.env.PROXY_KEY || proxyKey !== process.env.PROXY_KEY) {
    return sendJson(res, 401, { error: 'No autorizado: la clave X-Proxy-Key no coincide con PROXY_KEY' });
  }

  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (e) {
      return sendJson(res, 400, { error: 'El body debe ser un JSON válido', detail: e.message });
    }

    const { endpoint, soap, cert, key } = payload || {};
    if (!endpoint) return sendJson(res, 400, { error: 'Falta "endpoint" en el body' });
    if (!soap) return sendJson(res, 400, { error: 'Falta "soap" en el body' });
    if (!cert || !key) return sendJson(res, 400, { error: 'Faltan "cert" o "key" en el body' });

    let host;
    try { host = new URL(endpoint).hostname; } catch { host = null; }
    if (!host || !HOSTS_PERMITIDOS.includes(host)) {
      return sendJson(res, 400, { error: `Endpoint no permitido (${host}). Solo se permiten los servicios oficiales de la AEAT.` });
    }

    const isDebug = req.headers['x-proxy-debug'] === '1';
    const url = new URL(endpoint);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      cert: cert,
      key: key,
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        'SOAPAction': '""',
        'Content-Length': Buffer.byteLength(soap),
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      let responseBody = '';
      proxyRes.on('data', (chunk) => { responseBody += chunk; });
      proxyRes.on('end', () => {
        if (isDebug) {
          const headers = {};
          for (const [k, v] of Object.entries(proxyRes.headers)) headers[k] = v;
          return sendJson(res, 200, {
            endpoint,
            aeatStatus: proxyRes.statusCode,
            aeatHeaders: headers,
            aeatBody: responseBody.slice(0, 20000),
          });
        }
        res.writeHead(proxyRes.statusCode || 200, {
          'Content-Type': proxyRes.headers['content-type'] || 'text/xml; charset=UTF-8',
        });
        res.end(responseBody);
      });
    });

    proxyReq.on('error', (e) => {
      sendJson(res, 502, { error: 'El proxy no pudo completar la conexión con la AEAT', detail: e.message });
    });

    proxyReq.write(soap);
    proxyReq.end();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Proxy VeriFactu (Render) escuchando en puerto ${PORT}`);
});