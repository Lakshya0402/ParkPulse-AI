/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'pp-dark':     '#0d1117',
        'pp-surface':  '#161b22',
        'pp-border':   '#21262d',
        'pp-accent':   '#f97316',   // traffic orange
        'pp-accent2':  '#3b82f6',   // electric blue
        'pp-critical': '#ef4444',
        'pp-high':     '#f97316',
        'pp-medium':   '#eab308',
        'pp-low':      '#22c55e',
        'pp-muted':    '#8b949e',
        'pp-text':     '#e6edf3',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
        body:    ['"Inter"', 'sans-serif'],
      }
    }
  },
  plugins: []
}
