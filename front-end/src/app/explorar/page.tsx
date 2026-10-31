import { redirect } from "next/navigation";

/**
 * La antigua exploración territorial usaba una maqueta local incompleta.
 * El mapa público se genera ahora únicamente desde datos CCPC verificados.
 */
export default function ExplorarMexicoPage() {
  redirect("/conversar");
}
