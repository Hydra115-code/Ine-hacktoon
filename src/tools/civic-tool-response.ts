import { logger } from "../config/logger.js";
import { RateLimitError } from "../application/errors/rate-limit.error.js";
import { createToolErrorResult } from "../application/tool-error-result.js";
import { TimeoutError } from "../application/with-timeout.js";
import {
  CivicDataNotFoundError,
  CivicInvalidRequestError,
} from "../services/civic-data.service.js";

/** Respuesta exitosa de una tool: el resultado como JSON. */
export function civicToolSuccess(output: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
  };
}

/**
 * Convierte cualquier error en un mensaje amable. `retryable` le dice al
 * agente si vale la pena volver a intentar (errores recuperables).
 */
export function civicToolError(toolName: string, error: unknown) {
  logger.error(`Error en herramienta ${toolName}`, {
    errorType: error instanceof Error ? error.name : "UnknownError",
  });

  if (error instanceof RateLimitError) {
    return createToolErrorResult("Límite de solicitudes alcanzado. Inténtalo más tarde.", "rate_limited", true);
  }
  if (error instanceof TimeoutError) {
    return createToolErrorResult("La fuente de datos tardó demasiado en responder. Inténtalo de nuevo.", "temporarily_unavailable", true);
  }
  if (error instanceof CivicDataNotFoundError) {
    return createToolErrorResult(
      `${error.message} Prueba con otro año, otro cargo o con el nivel nacional.`,
      "not_found",
    );
  }
  if (error instanceof CivicInvalidRequestError) {
    return createToolErrorResult(error.message, "invalid_input");
  }
  return createToolErrorResult("No fue posible consultar los datos electorales.", "internal");
}
