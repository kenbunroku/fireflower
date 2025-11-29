import { defineConfig } from "vite";
import cesium from "vite-plugin-cesium";
import glsl from "vite-plugin-glsl";

export default defineConfig(() => {
  return {
    root: "src/",
    publicDir: "../public/",
    base: "/",
    build: {
      outDir: "../dist",
      emptyOutDir: true,
      target: "esnext",
    },
    optimizeDeps: {
      esbuildOptions: {
        target: "esnext",
      },
    },
    // Load env vars from the repo root so VITE_* in .env are picked up even though root is set to src/
    envDir: "../",
    plugins: [cesium(), glsl()],
  };
});
