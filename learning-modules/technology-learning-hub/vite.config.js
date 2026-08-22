import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "node-fetch": resolve(import.meta.dirname, "src/node-fetch-browser.js"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        hub: resolve(import.meta.dirname, "index.html"),
        "data-spreadsheets": resolve(import.meta.dirname, "modules/data-spreadsheets/index.html"),
        "data-spreadsheets-printable": resolve(import.meta.dirname, "modules/data-spreadsheets/printable-fallback.html"),
        "3d-modelling-foundations": resolve(import.meta.dirname, "modules/3d-modelling-foundations/index.html"),
        "3d-modelling-foundations-printable": resolve(import.meta.dirname, "modules/3d-modelling-foundations/printable-fallback.html"),
        "microbit-sensing": resolve(import.meta.dirname, "modules/microbit-sensing/index.html"),
        "microbit-sensing-printable": resolve(import.meta.dirname, "modules/microbit-sensing/printable-fallback.html"),
        "spreadsheet-analysis": resolve(import.meta.dirname, "modules/spreadsheet-analysis/index.html"),
        "spreadsheet-analysis-printable": resolve(import.meta.dirname, "modules/spreadsheet-analysis/printable-fallback.html"),
        "scratch-decomposition": resolve(import.meta.dirname, "modules/scratch-decomposition/index.html"),
        "scratch-decomposition-printable": resolve(import.meta.dirname, "modules/scratch-decomposition/printable-fallback.html"),
        "source-credibility": resolve(import.meta.dirname, "modules/source-credibility/index.html"),
        "source-credibility-printable": resolve(import.meta.dirname, "modules/source-credibility/printable-fallback.html"),
        "sensor-systems": resolve(import.meta.dirname, "modules/sensor-systems/index.html"),
        "sensor-systems-printable": resolve(import.meta.dirname, "modules/sensor-systems/printable-fallback.html"),
        "app-design": resolve(import.meta.dirname, "modules/app-design/index.html"),
        "app-design-printable": resolve(import.meta.dirname, "modules/app-design/printable-fallback.html"),
        "python-fundamentals": resolve(import.meta.dirname, "modules/python-fundamentals/index.html"),
        "python-fundamentals-printable": resolve(import.meta.dirname, "modules/python-fundamentals/printable-fallback.html"),
        "digital-representation": resolve(import.meta.dirname, "modules/digital-representation/index.html"),
        "digital-representation-printable": resolve(import.meta.dirname, "modules/digital-representation/printable-fallback.html"),
        "cybersecurity-risk": resolve(import.meta.dirname, "modules/cybersecurity-risk/index.html"),
        "cybersecurity-risk-printable": resolve(import.meta.dirname, "modules/cybersecurity-risk/printable-fallback.html"),
      },
    },
  },
});
