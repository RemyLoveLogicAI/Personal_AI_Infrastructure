import { FlatCompat } from "@eslint/eslintrc";
const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // TS handles undefined globals; no-undef misfires on React.ReactNode
      // type references in .tsx files under eslint-config-next.
      "no-undef": "off",
    },
  },
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
