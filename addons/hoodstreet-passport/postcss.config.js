// PostCSS pipeline: tailwindcss processes @tailwind directives in src/index.css
// into utility classes that the renderer can reference. autoprefixer adds
// vendor prefixes for cross-browser compatibility.
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
