// Protecciones para que ningún dato sensible salga hacia el proveedor de IA.
//
// 1. Proveedor permitido: por defecto solo se aceptan modelos en la misma máquina o en
//    una red privada (localhost, LAN, Tailscale, contenedores de Docker). Un proveedor
//    externo (OpenAI, Gemini, etc.) exige AI_ALLOW_EXTERNAL_PROVIDER=true y HTTPS.
// 2. Datos personales: antes de enviar texto libre al modelo se reemplazan emails,
//    teléfonos, DNI/CUIT, tarjetas, CBU y links por "[dato omitido]".

export const REDACTED = '[dato omitido]';

function isPrivateIPv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 127
    || a === 10
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127); // CGNAT: direcciones de Tailscale (100.x)
}

/** true si el host del proveedor está en la misma máquina o en una red privada. */
export function isPrivateAiHost(baseUrl: string): boolean {
  let host: string;
  try {
    host = new URL(baseUrl).hostname.toLowerCase().replace(/^\[|\]$/g, '');
  } catch {
    return false;
  }
  if (host === 'localhost' || host === '::1' || host === 'host.docker.internal') return true;
  if (host.endsWith('.ts.net')) return true; // nombres MagicDNS de Tailscale
  if (isPrivateIPv4(host)) return true;
  // Nombre sin dominio (ej. "ollama"): un servicio de la red interna de Docker
  return !host.includes('.') && !host.includes(':');
}

/**
 * Motivo por el que el proveedor configurado NO se puede usar, o null si está permitido.
 */
export function aiProviderBlockReason(baseUrl: string, allowExternal: boolean): string | null {
  if (!baseUrl) return 'AI_BASE_URL vacío';
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return 'AI_BASE_URL no es una URL válida';
  }
  if (isPrivateAiHost(baseUrl)) return null;
  if (!allowExternal) {
    return 'el proveedor es externo: para permitirlo cargá AI_ALLOW_EXTERNAL_PROVIDER=true';
  }
  if (url.protocol !== 'https:') return 'un proveedor externo tiene que usar HTTPS';
  return null;
}

const PATTERNS: RegExp[] = [
  /[\w.+-]+@[\w-]+(\.[\w-]+)+/g,                              // emails
  /\b(?:https?:\/\/|www\.)\S+/gi,                            // links
  /\b\d{22}\b/g,                                             // CBU / CVU
  /\b(?:\d[ -]?){13,19}\b/g,                                 // tarjetas
  /\b(?:20|23|24|27|30|33|34)-?\d{8}-?\d\b/g,                // CUIT / CUIL
  /\b\d{1,2}\.\d{3}\.\d{3}\b/g,                              // DNI con puntos
  /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{4}\b/g, // teléfonos
  /\b\d{7,8}\b/g,                                            // DNI sin puntos
];

/** Reemplaza datos personales del texto por "[dato omitido]". */
export function redactSensitive(text: string): string {
  return PATTERNS.reduce((acc, re) => acc.replace(re, REDACTED), text);
}
