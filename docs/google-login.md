# Ingresar con Google — cómo activarlo

El botón **"Continuar con Google"** ya está programado en el login, el registro y el panel
de compra de la página de producto. Queda oculto hasta que cargues un **Client ID** de Google
en el servidor. Es gratis.

## 1. Crear el Client ID (una sola vez, ~10 minutos)

1. Entrá a <https://console.cloud.google.com/> con la cuenta de Google de la tienda.
2. Arriba a la izquierda, **Seleccionar proyecto → Proyecto nuevo**. Nombre: `Jedami`. Crear.
3. Menú ☰ → **APIs y servicios → Pantalla de consentimiento de OAuth** (o "Google Auth Platform").
   - Tipo de usuario: **Externo**.
   - Nombre de la app: `Jedami`. Email de asistencia: el tuyo.
   - Dominio autorizado: `jedamiapp.com`.
   - Permisos (scopes): no agregues nada; alcanzan los básicos (email y perfil).
   - Guardá y, en **Público / Estado de publicación**, tocá **Publicar app** (si queda en
     "Prueba" solo pueden entrar los emails que agregues como testers).
4. Menú ☰ → **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**.
   - Tipo de aplicación: **Aplicación web**.
   - Nombre: `Jedami web`.
   - **Orígenes autorizados de JavaScript** (agregá los tres):
     - `https://www.jedamiapp.com`
     - `https://jedamiapp.com`
     - `http://localhost:5173` (para probar en tu compu)
   - **URIs de redireccionamiento autorizados**: dejalo vacío (usamos la ventana emergente).
   - Crear. Copiá el **ID de cliente** (termina en `.apps.googleusercontent.com`).
     No hace falta el "secreto del cliente".

## 2. Cargarlo en el servidor

En el droplet, editá `/opt/jedami/.env.prod` y agregá:

```bash
GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
```

Después recreá la API (`restart` no relee el archivo):

```bash
cd /opt/jedami
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d jedami-bff
```

No hace falta volver a deployar la web: el botón aparece solo al recargar la página.

## 3. Probarlo

- Abrí <https://www.jedamiapp.com/login> en una ventana de incógnito → **Acceder con Google**.
- Si el email ya tenía cuenta en la tienda, se vincula y entra a esa cuenta.
- Si no, se crea una cuenta nueva (minorista, o el tipo que haya elegido en "Crear cuenta").
- Las cuentas creadas con Google no tienen contraseña. Si alguien quiere una, usa
  "¿Olvidaste tu contraseña?".

## Para desarrollo local

En `jedami-bff/.env` agregá el mismo `GOOGLE_CLIENT_ID` y reiniciá `npm run dev`.

## Apagarlo

Borrá la línea `GOOGLE_CLIENT_ID` de `.env.prod` y recreá la API. Las cuentas ya creadas con
Google siguen existiendo y pueden entrar con "¿Olvidaste tu contraseña?".
