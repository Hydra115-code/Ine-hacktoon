import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const localNetworkAddresses = Object.values(networkInterfaces())
  .flatMap((network) => network ?? [])
  .filter((address) => address.family === "IPv4" && !address.internal)
  .map((address) => address.address);

const securityHeaders = [
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self), payment=(), usb=()" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: [...new Set(["127.0.0.1", ...localNetworkAddresses])],
  reactStrictMode: true,
  experimental: {
    // La ruta CLI de Next no captura `tsc --showConfig` correctamente en este entorno.
    // La API estable conserva tanto la lectura de configuración como el typecheck.
    useTypeScriptCli: false,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
