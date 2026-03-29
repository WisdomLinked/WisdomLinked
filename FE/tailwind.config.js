module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        'cormorant': ['"Cormorant Garamond"', 'Georgia', 'serif'],
        'crimson': ['"Crimson Pro"', 'Georgia', 'serif'],
      },
      colors: {
        /* WisdomLinked dashboard palette (student / expert / admin) */
        wl: {
          brand: "#234C6A",
          brandSoft: "#E8EEF4",
          page: "#F5F3EF",
          /** Warm light gold — chat routes (student / expert / admin) */
          chatGold: "#F7F1E6",
          pageAlt: "#f8f7f4",
          card: "#ffffff",
          line: "#e8e6e1",
          ink: "#1a2d3a",
          muted: "#6C7278",
        },
        "green": "#31B099",
        "blue": "#03a9f4",
        "darkgrey": "#141414",
        "darkgrey-1": "#1f1f1f",
        "lightgrey": "#DCE4E8",
        "midgrey": "#232323",
        "midgrey-1": "#202225",
        "grey": "#6C7278",
        "brownyellow": "#a87723",
        "red": "#EF4444"
      }
    },
  },
  plugins: [],
}
