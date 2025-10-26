import { defineConfig } from "vite";
import cesium from "vite-plugin-cesium";

export default defineConfig(() => {
  return {
    root: "src",
    publicDir: "../public",
    base: "/fireflower/",
    build: {
      outDir: "../dist",
      emptyOutDir: true,
    },
    plugins: [cesium()],
  };
});
