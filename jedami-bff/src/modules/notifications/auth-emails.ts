import { pool } from '../../config/database.js';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Nombre de la tienda para el remitente visible en el cuerpo del email */
export async function getStoreName(): Promise<string> {
  try {
    const { rows } = await pool.query('SELECT store_name FROM branding WHERE id = 1');
    return rows[0]?.store_name || 'Jedami';
  } catch {
    return 'Jedami';
  }
}

function layout(store: string, title: string, body: string): string {
  return `<!doctype html>
<html lang="es"><body style="margin:0;background:#F3F1EE;font-family:Arial,Helvetica,sans-serif;color:#33363A">
  <div style="max-width:520px;margin:0 auto;padding:24px">
    <div style="background:#ffffff;border-radius:20px;padding:28px">
      <p style="margin:0 0 4px;font-size:13px;color:#6B6F72">${escapeHtml(store)}</p>
      <h1 style="margin:0 0 12px;font-size:24px">${escapeHtml(title)}</h1>
      ${body}
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#8A8D90;text-align:center">
      Si no fuiste vos, ignorá este email: tu cuenta sigue igual.
    </p>
  </div>
</body></html>`;
}

/** Email con el código de 6 dígitos para confirmar la cuenta. Exportado para tests. */
export function buildVerificationCodeEmail(code: string, storeName: string, minutes: number) {
  const store = storeName || 'la tienda';
  const subject = `Tu código de verificación: ${code} — ${store}`;
  const text = [
    `Tu código para confirmar tu email es: ${code}`,
    ``,
    `Vence en ${minutes} minutos.`,
    `Si no creaste una cuenta en ${store}, ignorá este email.`,
    ``,
    store,
  ].join('\n');
  const html = layout(store, 'Confirmá tu email', `
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5">Ingresá este código en la tienda para terminar de crear tu cuenta:</p>
      <p style="margin:0 0 20px;font-size:34px;font-weight:bold;letter-spacing:8px;text-align:center;background:#F3F1EE;border-radius:14px;padding:16px">${escapeHtml(code)}</p>
      <p style="margin:0;font-size:14px;color:#6B6F72">Vence en ${minutes} minutos.</p>`);
  return { subject, text, html };
}

/** Email con el link para elegir una contraseña nueva. Exportado para tests. */
export function buildPasswordResetEmail(resetUrl: string, storeName: string, minutes: number) {
  const store = storeName || 'la tienda';
  const subject = `Restablecé tu contraseña — ${store}`;
  const text = [
    `Recibimos un pedido para restablecer la contraseña de tu cuenta.`,
    ``,
    `Elegí una nueva desde este link (vence en ${minutes} minutos):`,
    resetUrl,
    ``,
    `Si no lo pediste vos, ignorá este email: tu contraseña no cambia.`,
    ``,
    store,
  ].join('\n');
  const html = layout(store, 'Restablecé tu contraseña', `
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5">Recibimos un pedido para restablecer la contraseña de tu cuenta. Tocá el botón para elegir una nueva.</p>
      <p style="margin:0 0 20px">
        <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#33363A;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:bold">Elegir contraseña nueva</a>
      </p>
      <p style="margin:0;font-size:14px;color:#6B6F72">El link vence en ${minutes} minutos y sirve una sola vez.</p>`);
  return { subject, text, html };
}
