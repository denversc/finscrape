// @ts-check

import eslint from "@eslint/js";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import typescriptEslint from "typescript-eslint";

export default typescriptEslint.config(
  eslint.configs.recommended,
  ...typescriptEslint.configs.recommended,
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
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
);
