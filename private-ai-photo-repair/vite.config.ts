import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// onnxruntime-web ships prebuilt WASM/JSEP artifacts that must not be
// pre-bundled by esbuild, otherwise the runtime cannot resolve its workers.
export default defineConfig({
  plugins: [react()],
  base: "./",
  worker: {
    format: "es",
  },
  optimizeDeps: {
    exclude: ["onnxruntime-web"],
  },
  build: {
    target: "es2022",
  },
  server: {
    // Cross-origin isolation enables multi-threaded WASM (SharedArrayBuffer)
    // for onnxruntime-web. Safe defaults for local dev.
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
