import { defineConfig } from "vitest/config";
export default defineConfig({
  base: "./",
  // Generated reviews and source backups are not application modules. Watching
  // them reloads the book during native input checks and wastes watcher work.
  server: {
    watch: { ignored: [
      "**/work/**", "**/output/**", "**/archive/**", "**/release/**",
      "**/research/**", "**/test-results/**", "**/.playwright-cli/**",
    ] },
  },
  test: { include: ["tests/*.test.ts"] },
  build: { chunkSizeWarningLimit: 650 },
});
