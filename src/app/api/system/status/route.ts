import { errorPayloadSchema } from "@ine/contracts";
import {
  IntegrationConfigurationError,
  requestBackendSystemStatus,
} from "@/features/system-status/server/backend-system-status";
import { SystemStatusRequestError } from "@/features/system-status/system-status-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const correlationId = crypto.randomUUID();
  try {
    return Response.json(await requestBackendSystemStatus(fetch, correlationId), {
      headers: responseHeaders(correlationId),
    });
  } catch (error) {
    const isConfigurationError = error instanceof IntegrationConfigurationError;
    const isStatusError = error instanceof SystemStatusRequestError;
    const code = isConfigurationError
      ? "integration_not_configured"
      : isStatusError
        ? error.code
        : "backend_unavailable";
    return Response.json(errorPayloadSchema.parse({
      version: "1",
      code,
      message: isConfigurationError
        ? "La integración del agente no está configurada"
        : isStatusError
          ? error.message
          : "El backend no está disponible",
      recoverable: isStatusError ? error.recoverable : !isConfigurationError,
      hasPartialData: false,
      correlationId,
    }), {
      status: 503,
      headers: responseHeaders(correlationId),
    });
  }
}

function responseHeaders(correlationId: string): HeadersInit {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Correlation-ID": correlationId,
  };
}
