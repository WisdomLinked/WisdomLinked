import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "window",
          property: "localStorage",
          message:
            "Use atomWithStorage-backed state (or an approved storage abstraction), not direct localStorage access.",
        },
        {
          object: "window",
          property: "sessionStorage",
          message:
            "Use atomWithStorage-backed state (or an approved storage abstraction), not direct sessionStorage access.",
        },
        {
          object: "globalThis",
          property: "localStorage",
          message:
            "Use atomWithStorage-backed state (or an approved storage abstraction), not direct localStorage access.",
        },
        {
          object: "globalThis",
          property: "sessionStorage",
          message:
            "Use atomWithStorage-backed state (or an approved storage abstraction), not direct sessionStorage access.",
        },
        {
          object: "localStorage",
          property: "getItem",
          message:
            "Use atomWithStorage-backed state (or an approved storage abstraction), not direct localStorage access.",
        },
        {
          object: "localStorage",
          property: "setItem",
          message:
            "Use atomWithStorage-backed state (or an approved storage abstraction), not direct localStorage access.",
        },
        {
          object: "localStorage",
          property: "removeItem",
          message:
            "Use atomWithStorage-backed state (or an approved storage abstraction), not direct localStorage access.",
        },
        {
          object: "sessionStorage",
          property: "getItem",
          message:
            "Use atomWithStorage-backed state (or an approved storage abstraction), not direct sessionStorage access.",
        },
        {
          object: "sessionStorage",
          property: "setItem",
          message:
            "Use atomWithStorage-backed state (or an approved storage abstraction), not direct sessionStorage access.",
        },
        {
          object: "sessionStorage",
          property: "removeItem",
          message:
            "Use atomWithStorage-backed state (or an approved storage abstraction), not direct sessionStorage access.",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[computed=true][object.name='window'][property.value='localStorage']",
          message:
            "Use atomWithStorage-backed state (or an approved storage abstraction), not direct localStorage access.",
        },
        {
          selector: "MemberExpression[computed=true][object.name='window'][property.value='sessionStorage']",
          message:
            "Use atomWithStorage-backed state (or an approved storage abstraction), not direct sessionStorage access.",
        },
        {
          selector: "MemberExpression[computed=true][object.name='globalThis'][property.value='localStorage']",
          message:
            "Use atomWithStorage-backed state (or an approved storage abstraction), not direct localStorage access.",
        },
        {
          selector: "MemberExpression[computed=true][object.name='globalThis'][property.value='sessionStorage']",
          message:
            "Use atomWithStorage-backed state (or an approved storage abstraction), not direct sessionStorage access.",
        },
        {
          selector: "MemberExpression[computed=true][object.name='localStorage'][property.value='getItem']",
          message:
            "Use atomWithStorage-backed state (or an approved storage abstraction), not direct localStorage access.",
        },
        {
          selector: "MemberExpression[computed=true][object.name='localStorage'][property.value='setItem']",
          message:
            "Use atomWithStorage-backed state (or an approved storage abstraction), not direct localStorage access.",
        },
        {
          selector: "MemberExpression[computed=true][object.name='localStorage'][property.value='removeItem']",
          message:
            "Use atomWithStorage-backed state (or an approved storage abstraction), not direct localStorage access.",
        },
        {
          selector: "MemberExpression[computed=true][object.name='sessionStorage'][property.value='getItem']",
          message:
            "Use atomWithStorage-backed state (or an approved storage abstraction), not direct sessionStorage access.",
        },
        {
          selector: "MemberExpression[computed=true][object.name='sessionStorage'][property.value='setItem']",
          message:
            "Use atomWithStorage-backed state (or an approved storage abstraction), not direct sessionStorage access.",
        },
        {
          selector: "MemberExpression[computed=true][object.name='sessionStorage'][property.value='removeItem']",
          message:
            "Use atomWithStorage-backed state (or an approved storage abstraction), not direct sessionStorage access.",
        },
      ],
    },
  },
  {
    files: ["src/atoms/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-properties": "off",
      "no-restricted-syntax": "off",
    },
  },
  {
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // ============================================================
      // 🔒 ESCAPE HATCH LOCKDOWN — DO NOT REMOVE OR YOU WILL BE FIRED
      // No `any`. No `eslint-disable`. No `@ts-ignore`. No exceptions.
      // ============================================================
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],
      "@typescript-eslint/ban-ts-comment": ["error", {
        "ts-ignore": true,
        "ts-expect-error": true,
        "ts-nocheck": true,
      }],
      "@typescript-eslint/no-empty-object-type": "error",
      "@typescript-eslint/triple-slash-reference": "off",
      "no-case-declarations": "error",
      "prefer-const": "error",
      "no-useless-escape": "error",
      "no-console": "off",
    },
  },
  // 🔒 Block ALL inline eslint-disable comments — DO NOT REMOVE OR YOU WILL BE FIRED
  {
    linterOptions: {
      noInlineConfig: true,
    },
  },
  {
    ignores: ["dist", "node_modules"],
  }
);

