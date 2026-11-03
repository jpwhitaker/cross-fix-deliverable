import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    {
        files: ["lib/predicates/**/*.{ts,tsx}"],
        rules: {
            "no-restricted-imports": ["error", {
                    paths: [
                        {
                            name: "@/lib/game-store",
                            message: "Predicates must not import runtime store modules. Pass plain data through arguments.",
                            allowTypeImports: true,
                        },
                    ],
                    patterns: [
                        { group: ["@/components", "@/components/*"], message: "Predicates must not import UI components." },
                        { group: ["@/hooks", "@/hooks/*"], message: "Predicates must not import hooks." },
                        { group: ["@/app", "@/app/*"], message: "Predicates must not import app-layer modules." },
                        { group: ["**/components/**"], message: "Predicates must not import UI components." },
                        { group: ["**/hooks/**"], message: "Predicates must not import hooks." },
                        { group: ["**/app/**"], message: "Predicates must not import app-layer modules." },
                    ],
                }],
        },
    },
    globalIgnores([
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts",
    ]),
]);
export default eslintConfig;
