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
    plugins: [cesium(), glsl()],
  };
});
