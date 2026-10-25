import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// base "./" keeps asset paths relative so the app works under any Pages repo path.
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: { include: ["src/**/*.test.ts"] },
});
