import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Resolve o alias "@/..." (mesmo do tsconfig) para os testes de lib/ que importam outros módulos do app.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
});
