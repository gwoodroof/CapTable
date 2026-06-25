/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand Identity Colors (from BrandIdentity.html)
        brand: {
          primary: '#0066cc',    // Blue
          accent: '#f59e0b',     // Amber
          light: '#f0f4f8',      // Light background
          dark: '#0f172a',       // Dark background
        },
      },
      fontFamily: {
        sans: ['Outfit', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
