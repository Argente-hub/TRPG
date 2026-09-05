import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 防护:开发服务器只绑定本机回环,不对局域网/公网暴露(部署请用 dist/ 静态产物)
  server: { port: 5173, host: "127.0.0.1" },
  preview: { port: 4173, host: "127.0.0.1" },
  // 相对路径基址:任意域名/子路径(如 GitHub Pages 仓库子目录)都能直接运行
  base: "./",
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
