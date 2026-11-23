/** Respuesta 200 de POST /sesion/renovar. */
export interface SessionRenewal {
  expiraEn: string;
  csrfToken: string;
}

export type SessionStatus = 'starting' | 'active' | 'warning' | 'expired';
