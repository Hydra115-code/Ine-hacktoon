import type { PaperGuideCopy, PaperState } from "../types/paper-state.ts";

/**
 * Voz ciudadana determinista de Paper.
 *
 * Ningún texto de esta tabla depende de un proveedor de IA ni incluye detalles
 * técnicos. Los mensajes específicos de un resultado se incorporarán en P3.
 */
export const paperCopy: Readonly<Record<PaperState, PaperGuideCopy>> = {
  idle: {
    title: "¿Qué quieres descubrir?",
    detail: "Haz una pregunta sobre participación, territorio o elecciones y la convertiremos en una vista explorable.",
    mood: "idle",
  },
  understanding: {
    title: "Estoy entendiendo tu pregunta",
    detail: "Primero identifico qué quieres comparar y qué información necesito buscar.",
    mood: "thinking",
  },
  consulting: {
    title: "Estoy revisando la información disponible",
    detail: "Busco los periodos, territorios e indicadores que corresponden a tu consulta.",
    mood: "pointing",
  },
  building: {
    title: "Estoy organizando la evidencia",
    detail: "Preparo una vista clara para que puedas explorar los datos y comprobar de dónde salen.",
    mood: "presenting",
  },
  explaining: {
    title: "Tu exploración está lista",
    detail: "Puedes recorrer la vista, aplicar filtros o pedirme que cambie la forma de mostrarla.",
    mood: "approving",
  },
  suggesting: {
    title: "Podemos seguir explorando",
    detail: "Elige una acción o dime con tus palabras qué quieres revisar después.",
    mood: "pointing",
  },
  recovering: {
    title: "Conservé lo que sí pudimos comprobar",
    detail: "Puedes ajustar la pregunta o intentarlo de nuevo sin perder la última vista válida.",
    mood: "surprised",
  },
};
