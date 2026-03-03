module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        'cormorant': ['"Cormorant Garamond"', 'Georgia', 'serif'],
        'crimson': ['"Crimson Pro"', 'Georgia', 'serif'],
      },
      colors: {
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
