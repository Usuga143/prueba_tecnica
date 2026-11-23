export interface ApiFieldError {
  campo: string;
  codigo: string;
}

export interface ApiError {
  status: number;
  codigo: string;
  mensaje: string;
  errores?: ApiFieldError[];
  retryAfterSeconds?: number;
}
