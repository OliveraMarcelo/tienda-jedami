interface ApiErrorShape {
  response?: { status?: number; data?: { detail?: string; type?: string } }
}

/** Mensaje del servidor (RFC 7807 `detail`) o un texto por defecto */
export function apiErrorDetail(err: unknown, fallback = 'Error inesperado. Intentá de nuevo.'): string {
  return (err as ApiErrorShape).response?.data?.detail ?? fallback
}

/** El login fue correcto pero la cuenta todavía no confirmó su email */
export function isEmailNotVerified(err: unknown): boolean {
  const res = (err as ApiErrorShape).response
  return res?.status === 403 && (res.data?.type ?? '').endsWith('/email-not-verified')
}
