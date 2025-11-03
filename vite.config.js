import { defineConfig } from "vite";
import cesium from "vite-plugin-cesium";

export default defineConfig(() => {
  return {
    root: "src",
    publicDir: "../public",
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
    plugins: [cesium()],
  };
});
