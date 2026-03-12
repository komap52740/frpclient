import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const jsSourceFiles = [
  "src/**/*.{js,jsx}",
  "scripts/**/*.{js,mjs}",
  "e2e/**/*.{js,mjs}",
  "*.js",
  "*.mjs",
];

const tsSourceFiles = [
  "src/**/*.{ts,tsx}",
  "scripts/**/*.{ts,mts}",
  "e2e/**/*.{ts,mts}",
  "*.ts",
  "*.mts",
];

const sharedRules = {
  "no-console": "off",
  "import/no-duplicates": "error",
  "import/order": [
    "error",
    {
      groups: ["builtin", "external", "internal", "parent", "sibling", "index", "object", "type"],
      "newlines-between": "ignore",
      alphabetize: {
        order: "asc",
        caseInsensitive: true,
      },
    },
  ],
  "react/prop-types": "off",
  "react/react-in-jsx-scope": "off",
  "react/jsx-uses-vars": "error",
  "react-hooks/rules-of-hooks": "error",
  "react-hooks/exhaustive-deps": "off",
};

export default [
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**", "package-lock.json"],
  },
  {
    ...js.configs.recommended,
    files: jsSourceFiles,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: tsSourceFiles,
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        ...(config.languageOptions?.parserOptions ?? {}),
        ecmaFeatures: {
          jsx: true,
        },
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  })),
  {
    files: [...jsSourceFiles, ...tsSourceFiles],
    plugins: {
      import: importPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: sharedRules,
  },
  {
    files: jsSourceFiles,
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: tsSourceFiles,
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["src/pages/AppointmentDetailPage.jsx"],
    rules: {
      "no-unused-vars": "off",
    },
  },
  prettierConfig,
];
