export interface User {
  id: number;
  email: string;
  /** NULL en cuentas creadas con Google que todavía no definieron contraseña */
  password_hash: string | null;
  created_at: Date;
  email_verified_at?: Date | null;
  google_sub?: string | null;
  roles?: string[];
}
