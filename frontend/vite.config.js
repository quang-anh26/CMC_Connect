import { defineConfig, loadEnv } from "vite"
import basicSsl from "@vitejs/plugin-basic-ssl"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_")
  const useHttps = env.VITE_HTTPS === "true"
  const backendUrl = env.VITE_BACKEND_URL || "http://localhost:8080"
  const allowedHost = env.VITE_ALLOWED_HOST

  return {
    plugins: [react(), tailwindcss(), ...(useHttps ? [basicSsl()] : [])],
    resolve: { dedupe: ["react", "react-dom"] },
    // sockjs-client dùng biến global của Node, trình duyệt không có -> alias về globalThis.
    define: { global: "globalThis" },
    server: {
      ...(allowedHost ? { allowedHosts: [allowedHost] } : {}),
      host: "0.0.0.0",
      https: useHttps,
      port: 5173,
      proxy: {
        "/api": backendUrl,
        "/ws": { target: backendUrl, ws: true },
        "/uploads": backendUrl,
      },
    },
  }
})
