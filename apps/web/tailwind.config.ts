import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#FF2B00",
          primaryDark: "#E02600",
          primaryLight: "#FFF1EC",
          primarySoft: "#FFDCCB",
        },
        surface: {
          canvas: "#F6F7FB",
          card: "#FFFFFF",
        },
        text: {
          primary: "#101828",
          muted: "#667085",
        },
        semantic: {
          success: "#16A36A",
          warning: "#E79A16",
          danger: "#D94343",
        },
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
      },
    },
  },
  plugins: [],
};

export default config;
