/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Team colors
        'team-a': {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        'team-b': {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        // Game UI colors
        'game': {
          bg: '#0f172a',
          surface: '#1e293b',
          border: '#334155',
          text: '#f8fafc',
          muted: '#94a3b8',
        },
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // TV-optimized sizes (readable from 3m)
        'tv-sm': ['1.5rem', { lineHeight: '2rem' }],
        'tv-base': ['2rem', { lineHeight: '2.5rem' }],
        'tv-lg': ['2.5rem', { lineHeight: '3rem' }],
        'tv-xl': ['3rem', { lineHeight: '3.5rem' }],
        'tv-2xl': ['4rem', { lineHeight: '4.5rem' }],
        'tv-code': ['5rem', { lineHeight: '5.5rem', letterSpacing: '0.25em' }],
      },
    },
  },
};
