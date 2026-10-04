# Proxy VeriFactu para Render

El runtime de Base44 **no soporta mTLS** (TLS mutuo) para conexiones salientes, y la AEAT exige un certificado cliente. Este proxy corre en **Render** (gratis) y hace el mTLS directamente con Node.js.

**Versión simplificada:** el certificado NO se configura en el proxy. Se sube una vez en la app (Configuración → VeriFactu) y la función backend lo extrae y lo envía en cada petición. Aquí solo hace falta una variable de entorno: `PROXY_KEY`.

---

## Despliegue paso a paso

### 1. Crear el repositorio en GitHub

Este repositorio ya contiene los tres archivos necesarios (`server.js`, `package.json`, `README.md`). Si lo estás leyendo en GitHub, ya está creado. Si no, crea un repositorio público llamado `verifactu-proxy` y sube estos tres archivos.

### 2. Crear el servicio en Render

1. Ve a [render.com](https://render.com) y regístrate (gratis, con cuenta de GitHub).
2. Pulsa **New +** → **Web Service**.
3. Conecta tu cuenta de GitHub y selecciona el repositorio `verifactu-proxy`.
4. Configura:
   - **Name:** `verifactu-proxy`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
5. Abre la sección **Environment** y añade **una sola** variable:

   | Variable | Valor |
   |---|---|
   | `PROXY_KEY` | La misma clave que tienes en `VERIFACTU_PROXY_KEY` en Base44 |

   > No hace falta subir el certificado aquí: la app lo envía en cada petición.

6. Pulsa **Create Web Service**. Render despliega y te da una URL como:
   `https://verifactu-proxy-xxxx.onrender.com`

### 3. Actualizar el secreto en Base44

En la sección **Secrets** de tu app en Base44, cambia el valor de:

| Secreto | Nuevo valor |
|---|---|
| `VERIFACTU_PROXY_URL` | La URL de Render: `https://verifactu-proxy-xxxx.onrender.com` |

`VERIFACTU_PROXY_KEY` se mantiene igual (debe coincidir con `PROXY_KEY` en Render).

### 4. Subir el certificado en la app

En la app, ve a **Configuración → VeriFactu** y sube tu certificado digital (`.p12` o `.pfx`). La contraseña del certificado ya está configurada en el secreto `VERIFACTU_CERT_PASSWORD` de la app.

---

## Verificación

Una vez desplegado y con el certificado subido, desde el detalle de una factura en la app pulsa **Enviar a AEAT (VeriFactu)**. La función enviará el sobre SOAP al proxy, que lo reenviará a la AEAT presentando el certificado cliente.

---

## Notas

- El plan gratuito de Render "duerme" el servicio tras 15 minutos sin actividad. La primera petición tras estar dormido tarda ~30 segundos. Si envías facturas con frecuencia, considera el plan de pago (~7€/mes) para que esté siempre activo.
- El proxy solo acepta los endpoints oficiales de la AEAT (`prewww1.aeat.es`, `www1.agenciatributaria.gob.es`, etc.).
- La clave `PROXY_KEY` evita que cualquiera con la URL del proxy pueda usarlo. La conexión app → proxy va por HTTPS.