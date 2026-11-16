import nextVitals from "eslint-config-next/core-web-vitals";

export default [
  ...nextVitals,
  {
    rules: {
      // The admin data hooks fetch inside an effect and flip their loading
      // flags at the start. That pattern predates this React 19 rule; keep
      // it visible as a warning instead of blocking CI while the hooks are
      // migrated to a data library.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
];
