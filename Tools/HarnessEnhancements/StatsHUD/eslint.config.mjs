import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // TS handles undefined globals; no-undef misfires on React.ReactNode
      // type references in .tsx files under eslint-config-next.
      "no-undef": "off",
    },
  },
  // Default ignores of eslint-config-next, re-declared explicitly.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
