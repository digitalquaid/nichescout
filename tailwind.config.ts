import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0B0F14",
        card: "#111820",
        border: "#202A35",
        primary: "#00D084",
        text: "#F5F7FA",
        muted: "#8B98A7",
      },
    },
  },
  plugins: [],
};
export default config;
