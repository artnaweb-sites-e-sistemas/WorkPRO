/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    borderRadius: {
      none: '0px',
      DEFAULT: '0px',
      sm: '2px',
    },
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        background: '#09090B',
        surface: '#09090B',
        'surface-2': '#18181B',
        muted: '#27272A',
        foreground: '#FAFAFA',
        'muted-foreground': '#A1A1AA',
        accent: {
          DEFAULT: '#DFE104',
          foreground: '#000000',
        },
        border: '#3F3F46',
        status: {
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
          info: '#3B82F6',
        },
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
}
