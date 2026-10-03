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
        /* Navy scale for student discovery cards (FeedCard). */
        brand: {
          900: "#0F2A40",
          800: "#1D4466",
          700: "#234B6B",
          600: "#2F6A98",
          500: "#4D6A85",
          400: "#3A5670",
          200: "#C9D7E5",
          150: "#D3E1EE",
          100: "#E3EDF7",
          75: "#E1EAF3",
          50: "#F3F7FB",
          25: "#EEF4FA",
          ring: "#DBE5EF",
          "ring-hover": "#BFD0E2",
          "outline-hover": "#8FB0CF",
          pager: "#7B8EA3",
          "pager-border": "#D5E0EB",
          dot: "#7FB3DE",
          "panel-strong": "#E8F0F8",
          deep: "#1E3A5F",
          sky: "#3B6EA5",
          mist: "#D6E4F2",
          haze: "#C7DAEE",
        },
        /* WisdomLinked dashboard palette (student / expert / admin) */
        wl: {
          brand: "#234C6A",
          brandSoft: "#E8EEF4",
          page: "#F5F3EF",
          /** Chat route canvas — same warm off-white as dashboard page */
          chatGold: "#F5F3EF",
          pageAlt: "#f8f7f4",
          card: "#ffffff",
          line: "#e8e6e1",
          ink: "#1a2d3a",
          muted: "#6C7278",
        },
        /* Public Resources page (timeline). Primary navy stays wl.brand. */
        res: {
          tint: "#f4f7fa",
          line: "#e3e8ee",
          blue: "#2f5f82",
          soft: "#e8eff5",
          gold: "#b7791f",
          "gold-soft": "#fbf3e4",
          dash: "#c9d3de",
          "promo-label": "#9fbad0",
          "promo-text": "#c9d7e3",
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
      },
      boxShadow: {
        "brand-lift": "0 10px 22px rgba(35, 75, 107, 0.12)",
        "res-card": "0 1px 2px rgba(20,38,58,.04), 0 4px 16px rgba(20,38,58,.05)",
      },
    },
  },
  plugins: [],
}
