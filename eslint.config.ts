import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
import ts from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
  },
  ts.configs.recommended,
  eslintConfigPrettier,
]);
