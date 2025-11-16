/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        'hika-green': '#92C59F',
        'hika-darkgreen': '#516D58',
        'off-white': '#ffffc2'
      }
    }
  },
  plugins: [],
}