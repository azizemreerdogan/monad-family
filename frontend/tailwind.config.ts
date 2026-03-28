import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        trader: '#7c3aed',
        farmer: '#16a34a',
        lender: '#d97706',
      },
    },
  },
  plugins: [],
}

export default config
