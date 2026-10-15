import type { WorkspaceStatus } from "../workspace/types/workspace-status";
import type { PaperMood } from "./paper-mood";

export interface PaperMessage {
  title: string;
  detail: string;
  tip?: string;
  mood: PaperMood;
}

export const paperStatusVoices: Record<WorkspaceStatus, PaperMessage> = {
  empty: {
    title: "¡Hola! Soy Paper",
    detail: "¿Qué te gustaría descubrir hoy sobre la participación ciudadana en México?",
    tip: "Puedes pedirme comparar tu estado, ver qué tanto votan los jóvenes o analizar la elección 2024.",
    mood: "greeting",
  },
  submitting: {
    title: "Leyendo tu consulta...",
    detail: "Acomodando los lentes para entender exactamente qué datos necesitas.",
    mood: "thinking",
  },
  retrieving_data: {
    title: "Buscando en los registros del INE...",
    detail: "Consultando únicamente las fuentes oficiales validadas del CCPC 2009–2024.",
    mood: "thinking",
  },
  generating_ui: {
    title: "Dibujando la visualización...",
    detail: "Preparando gráficas y métricas claras para ti.",
    mood: "presenting",
  },
  ready: {
    title: "¡Aquí tienes los datos!",
    detail: "Construí esta vista con datos oficiales. Puedes interactuar con ella o pedirme más detalles.",
    tip: "Prueba escribir: 'Compáralo con Nuevo León' o 'Muéstramelo por edad'.",
    mood: "approving",
  },
  updating: {
    title: "Ajustando la vista...",
    detail: "Conservando la información mientras actualizo los datos solicitados.",
    mood: "presenting",
  },
  awaiting_confirmation: {
    title: "Revisemos esto juntos",
    detail: "Antes de continuar, por favor confirma la acción para proceder de forma segura.",
    mood: "pointing",
  },
  executing_action: {
    title: "Aplicando tu acción...",
    detail: "Procesando la solicitud confirmada.",
    mood: "presenting",
  },
  partial: {
    title: "Tengo parte de la información",
    detail: "Algunos datos no estaban disponibles en este corte, pero te muestro todo lo que pudimos respaldar con certeza.",
    tip: "Podemos explorar con un periodo o territorio alternativo.",
    mood: "surprised",
  },
  cancelled: {
    title: "Consulta detenida",
    detail: "No te preocupes, cuando quieras podemos formular una nueva pregunta.",
    mood: "idle",
  },
  error: {
    title: "Algo no salió como esperaba",
    detail: "No pude conectar con la fuente o el formato no coincidió. ¡Intentémoslo de nuevo!",
    tip: "Revisa la conexión o prueba con una pregunta más directa.",
    mood: "surprised",
  },
};

export const paperQuickTips = [
  "¿Sabías que en 2024 la participación nacional superó el 60%?",
  "Los jóvenes de 20 a 29 años históricamente tienen mayor margen de abstención.",
  "Las mujeres mexicanas han mantenido una tasa de participación mayor a los hombres en las últimas 4 elecciones federales.",
  "En las elecciones intermedias suele haber una baja de participación respecto a las presidenciales.",
];
