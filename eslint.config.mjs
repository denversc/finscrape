// @ts-check

import eslint from "@eslint/js";
import chaiFriendlyPlugin from "eslint-plugin-chai-friendly";
import simpleImportSortPlugin from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    "ignores": ["build/**/*"],
  },
  {
    "rules": {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "args": "all",
          "argsIgnorePattern": "_",
          "caughtErrors": "all",
          "caughtErrorsIgnorePattern": "_",
          "destructuredArrayIgnorePattern": "_",
          "varsIgnorePattern": "_",
          "ignoreRestSiblings": true,
        },
      ],
    },
  },
  {
    plugins: {
      "simple-import-sort": simpleImportSortPlugin,
      "chai-friendly": chaiFriendlyPlugin,
    },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "@typescript-eslint/no-unused-expressions": "off", // use chai-friendly/no-unused-expressions instead
      "chai-friendly/no-unused-expressions": "error",
    },
  },
);
