export interface AgentFailureInput {
  code: string;
  message?: string;
  recoverable: boolean;
  hasPartialData?: boolean;
}

export interface AgentFailurePresentation {
  code: string;
  title: string;
  message: string;
  canRetry: boolean;
  canContinue: boolean;
}

export function presentAgentFailure(input: AgentFailureInput): AgentFailurePresentation {
  const code = input.code.toLowerCase();
  const canContinue = input.hasPartialData === true;

  if (code.includes("form_validation")) {
    return {
      code: input.code,
      title: "Revisa los campos",
      message: "Completa los campos requeridos antes de continuar.",
      canRetry: false,
      canContinue: false,
    };
  }

  if (code.includes("session_expired") || code.includes("authentication_expired") || code.includes("authentication_required") || code.includes("auth_expired")) {
    return {
      code: input.code,
      title: "Tu sesión expiró",
      message: canContinue
        ? "Conservamos la información visible. Recarga la página e inicia sesión antes de continuar."
        : "Recarga la página e inicia sesión antes de volver a consultar.",
      canRetry: false,
      canContinue,
    };
  }

  if (code.includes("duplicate_payment") || code.includes("duplicate_action")) {
    return {
      code: input.code,
      title: "La solicitud ya fue recibida",
      message: "Paper no la repetirá. El resultado que ya tienes permanece disponible.",
      canRetry: false,
      canContinue,
    };
  }

  if (code.includes("action_backend_required") || code.includes("authoritative_action")) {
    return {
      code: input.code,
      title: "Esta acción requiere confirmación",
      message: "Antes de continuar necesito que confirmes esta acción.",
      canRetry: false,
      canContinue,
    };
  }

  if (code.includes("revision_conflict")) {
    return {
      code: input.code,
      title: "La vista cambió mientras trabajábamos",
      message: "Tu resultado anterior sigue disponible. Recupéralo antes de pedir otro cambio.",
      canRetry: false,
      canContinue: false,
    };
  }

  if (code.includes("session_busy")) {
    return {
      code: input.code,
      title: "Paper todavía está trabajando",
      message: "Conservamos el resultado visible. Espera a que termine la consulta en curso antes de pedir otro cambio.",
      canRetry: false,
      canContinue,
    };
  }

  if (code.includes("session_not_found")) {
    return {
      code: input.code,
      title: "Esta exploración necesita reiniciarse",
      message: canContinue
        ? "El resultado anterior sigue visible, pero Paper ya no puede modificar esa exploración. Inicia una consulta nueva para continuar."
        : "Inicia una consulta nueva para volver a explorar los datos.",
      canRetry: false,
      canContinue,
    };
  }

  if (code.includes("session_forbidden")) {
    return {
      code: input.code,
      title: "Esta exploración no está disponible",
      message: "Conservamos tu resultado visible. Inicia una consulta nueva dentro de tu sesión para continuar.",
      canRetry: false,
      canContinue,
    };
  }

  if (code.includes("ui_event_invalid")) {
    return {
      code: input.code,
      title: "Paper no pudo aplicar ese cambio",
      message: canContinue
        ? "La vista anterior sigue intacta. Puedes seguir explorándola o pedir el ajuste con otras palabras."
        : "La vista no cambió. Intenta pedir el ajuste con otras palabras.",
      canRetry: false,
      canContinue,
    };
  }

  if (code.includes("semantic-ui")) {
    return {
      code: input.code,
      title: "No pude acomodar los datos como lo pediste",
      message: "Sí encontré la información, pero la forma de mostrarla no respetaba una de tus indicaciones. Ajusta la petición o inténtalo de nuevo.",
      canRetry: input.recoverable,
      canContinue: false,
    };
  }

  if (code.includes("evidence-validation") || code.includes("financial-reasoning")) {
    return {
      code: input.code,
      title: "Me falta información para responder con confianza",
      message: "Indica el periodo, el territorio o el grupo que quieres revisar y lo intentaré de nuevo.",
      canRetry: input.recoverable,
      canContinue: false,
    };
  }

  if (code.includes("mcp")) {
    return {
      code: input.code,
      title: "Los datos no están disponibles por el momento",
      message: canContinue
        ? "No pudimos consultar una de las fuentes necesarias. Puedes reintentar o continuar con la información recibida."
        : "No pudimos consultar una de las fuentes necesarias. Puedes intentarlo nuevamente.",
      canRetry: input.recoverable,
      canContinue,
    };
  }

  if (code.includes("timeout") || code.includes("timed_out")) {
    return {
      code: input.code,
      title: "El análisis tardó más de lo esperado",
      message: canContinue
        ? "Detuvimos la espera de forma segura y conservamos el resultado anterior. Puedes intentarlo de nuevo."
        : "Detuvimos la espera de forma segura. Puedes intentarlo de nuevo sin modificar tu consulta.",
      canRetry: input.recoverable,
      canContinue,
    };
  }

  if (code.includes("ui_") || code.includes("binding") || code.includes("visualization")) {
    return {
      code: input.code,
      title: "No pude mostrar una parte de la respuesta",
      message: canContinue
        ? "El resto de la información sigue disponible. Puedes continuar o intentarlo de nuevo."
        : "Inténtalo nuevamente o pide otra forma de mostrar la información.",
      canRetry: input.recoverable,
      canContinue,
    };
  }

  if (code.includes("network") || code.includes("connection")) {
    return {
      code: input.code,
      title: "Se interrumpió la conexión con Paper",
      message: canContinue
        ? "Conservamos el resultado anterior. Revisa la conexión e inténtalo nuevamente."
        : "Tu consulta sigue disponible. Revisa la conexión e inténtalo nuevamente.",
      canRetry: input.recoverable,
      canContinue,
    };
  }

  if (code.includes("partial_data") || code.includes("partial_result")) {
    return {
      code: input.code,
      title: "Faltan algunos datos",
      message: "Conservé lo que sí encontré. Puedes continuar con ello o intentarlo de nuevo.",
      canRetry: input.recoverable,
      canContinue,
    };
  }

  return {
    code: input.code,
    title: "No pude terminar esta consulta",
    message: canContinue
      ? "Puedes reintentar o continuar con la información que ya está disponible."
      : "La consulta se detuvo de forma segura. Puedes intentarlo nuevamente.",
    canRetry: input.recoverable,
    canContinue,
  };
}
