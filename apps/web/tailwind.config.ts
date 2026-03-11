import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#eef2ff',
        accent: '#3b6fff',
        teal: '#00c4a7',
        pink: '#ff6b9d',
        glass: 'rgba(255,255,255,0.62)',
      },
      fontFamily: {
        heading: ['Bricolage Grotesque', 'sans-serif'],
        body: ['Instrument Sans', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        'card-lg': '20px',
      },
      boxShadow: {
        card: '0 2px 16px rgba(59,111,255,0.08)',
      },
    },
  },
  plugins: [],
}

export default config
