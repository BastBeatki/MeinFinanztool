/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: {
            850: '#1e293b', 
            900: '#0f172a',
            950: '#020617',
        }
      }
    },
  },
  plugins: [],
}