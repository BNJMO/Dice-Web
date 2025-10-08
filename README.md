## 🚀 Quick Start

### Option 1: Using Vite (Recommended)

1. **Install dependencies:**
```bash
npm install
```

2. **Run development server:**
```bash
npm run dev
```

3. **Open your browser:**
The game will automatically open at `http://localhost:3000`

### Option 2: Using Simple Node Server

1. **Run the server:**
```bash
npm run serve
```

2. **Open your browser:**
Navigate to `http://localhost:3000`

### Option 3: Using Python (No Installation Required)

If you have Python installed:

```bash
# Python 3
python -m http.server 3000

# Python 2
python -m SimpleHTTPServer 3000
```

Then open `http://localhost:3000`

### Option 4: Using VS Code Live Server

1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

### Option 5: Using npx (No Installation)

```bash
npx serve
```

Then open the URL shown in the terminal.

## 📦 Building for Production

```bash
npm run build
```

This creates an optimized build in the `dist/` folder ready for deployment.

## 🌐 Deployment

### Deploy to Netlify

1. **Drag & Drop:**
   - Build your project: `npm run build`
   - Go to [Netlify Drop](https://app.netlify.com/drop)
   - Drag the `dist` folder

2. **Using Netlify CLI:**
```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

### Deploy to Vercel

```bash
npm install -g vercel
npm run build
vercel --prod
```

### Deploy to GitHub Pages

1. **Build the project:**
```bash
npm run build
```

2. **Push the `dist` folder to `gh-pages` branch:**
```bash
git subtree push --prefix dist origin gh-pages
```

3. **Enable GitHub Pages:**
   - Go to your repository settings
   - Navigate to "Pages"
   - Select `gh-pages` branch as source

### Deploy to Any Static Host

Simply upload the contents of the `dist/` folder to:
- AWS S3 + CloudFront
- Firebase Hosting
- Cloudflare Pages
- Surge.sh
- Render
- Railway

## 🛠️ Project Structure

```
Mines-Web/
├── index.html              # Main HTML file
├── package.json            # Dependencies and scripts
├── vite.config.js          # Vite configuration
├── server.js               # Simple Node.js server
├── src/
│   ├── main.js            # Game initialization
│   ├── mines.js           # PixiJS game logic
│   ├── fallback.js        # DOM fallback renderer
│   ├── ease.js            # Easing functions
│   └── style.css          # Styles
├── assets/
│   ├── sprites/           # Game textures
│   │   ├── Diamond.png
│   │   ├── Bomb.png
│   │   └── Explosion_Spritesheet.png
│   └── sounds/            # Game audio
│       ├── TileTapped.ogg
│       ├── DiamondRevealed.ogg
│       └── ...
└── dist/                  # Production build (generated)
```

## 🔧 Technologies Used

- **PixiJS v8** - High-performance 2D WebGL renderer
- **@pixi/sound** - Audio management
- **Vite** - Fast build tool and dev server
- **ES Modules** - Modern JavaScript modules

## ⚠️ Troubleshooting

### CORS Error when opening index.html directly

**Problem:** `Access to script at 'file://...' has been blocked by CORS policy`

**Solution:** You must use a web server. Use any of the methods in the Quick Start section above.

### Game not loading

1. Make sure you're running a web server (not opening the file directly)
2. Check the browser console for errors
3. Ensure all assets are in the correct folders
4. Try clearing browser cache

### Assets not loading

- Verify file paths in `src/main.js`
- Check that files exist in `assets/sprites/` and `assets/sounds/`
- Ensure file extensions match (case-sensitive on some systems)

## 📚 Learn More

- [PixiJS Documentation](https://pixijs.com/8.x/guides)
- [PixiJS Examples](https://pixijs.com/8.x/examples)
- [Complete Integration Guide](./PIXI_INTEGRATION_GUIDE.md)

## 📄 License

MIT License - Feel free to use this project for learning and commercial purposes.

**Enjoy the game! 💎💣**

