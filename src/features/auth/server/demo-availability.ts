import "server-only";

export function demoLoginAvailable() {
  return process.env.INE_DEMO_LOGIN_ENABLED === "true"
    && Boolean(process.env.INE_DEMO_EMAIL?.trim())
    && Boolean(process.env.INE_DEMO_PASSWORD);
}
