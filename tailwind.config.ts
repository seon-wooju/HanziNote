import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontSize: {
        'hanzi-lg': '64px',
        'hanzi-xl': '96px',
      },
    },
  },
  plugins: [],
};

export default config;
