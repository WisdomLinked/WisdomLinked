# TOE Consulting Landing Page

A modern, animated landing page for Thoughts of Experts (TOE) Consulting built with React and Tailwind CSS.

## Features

✨ **Modern Design**
- Elegant serif typography (Cormorant Garamond & Crimson Pro)
- Dark theme with amber/orange gradient accents
- Smooth scroll animations and transitions
- Floating particle effects

🎯 **Key Sections**
- Hero section with animated background
- Statistics showcase
- Service offerings with hover effects
- Rotating testimonials carousel
- Expert benefits section
- Call-to-action sections

📱 **Responsive**
- Fully responsive design
- Mobile-first approach
- Works on all screen sizes

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. **Navigate to the project folder in your terminal:**
   ```bash
   cd path/to/your/project
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser and visit:**
   ```
   http://localhost:5173
   ```

### Build for Production

To create a production build:
```bash
npm run build
```

The built files will be in the `dist` folder.

To preview the production build:
```bash
npm run preview
```

## Project Structure

```
.
├── index.html          # HTML entry point
├── main.jsx           # React entry point
├── TOEConsulting.jsx  # Main landing page component
├── index.css          # Global styles with Tailwind imports
├── package.json       # Dependencies
├── vite.config.js     # Vite configuration
├── tailwind.config.js # Tailwind CSS configuration
└── postcss.config.js  # PostCSS configuration
```

## Customization

### Colors
The design uses a dark slate background with amber/orange accents. To customize:
- Edit gradient colors in `TOEConsulting.jsx`
- Modify Tailwind colors in `tailwind.config.js`

### Typography
The design uses:
- **Cormorant Garamond** for headings
- **Crimson Pro** for body text

To change fonts:
1. Update the Google Fonts import in `TOEConsulting.jsx`
2. Modify font families in `tailwind.config.js`

### Content
All content can be edited directly in `TOEConsulting.jsx`:
- Services in the `services` array
- Testimonials in the `testimonials` array
- Stats in the `stats` array
- Expert benefits in the `expertBenefits` array

## Technologies Used

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Icon library
- **Google Fonts** - Custom typography

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT
