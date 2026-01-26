# Silky Maps - Mapbox GL React Application

A full-screen interactive dark mode map built with React and Mapbox GL.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Get a Mapbox Access Token:**
   - Sign up at [mapbox.com](https://account.mapbox.com/)
   - Get your access token from [your account page](https://account.mapbox.com/access-tokens/)

3. **Set your Mapbox token:**
   
   Create a `.env` file in the root directory:
   ```bash
   VITE_MAPBOX_ACCESS_TOKEN=your_token_here
   ```
   
   Or edit `src/App.jsx` and replace `YOUR_MAPBOX_ACCESS_TOKEN` with your token.

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Build for production:**
   ```bash
   npm run build
   ```

## Features

- Full-screen interactive map
- Dark mode styling (Mapbox Dark v11 style)
- Navigation controls (zoom, rotate, pitch)
- Fullscreen control
- Responsive design

## Tech Stack

- React 18
- Vite
- Mapbox GL JS
- react-map-gl
