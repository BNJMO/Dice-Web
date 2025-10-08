# ⚡ QUICK START - Get Your Game Running in 2 Minutes!

## 🚨 IMPORTANT: Why You Got the CORS Error

You tried to open `index.html` directly by double-clicking it. **This doesn't work with modern JavaScript modules!**

You MUST use a web server. Here are the easiest ways:

---

## ✅ Solution 1: Double-Click the Batch File (EASIEST for Windows!)

1. **Double-click `start-server.bat`**
2. Wait for it to install dependencies and start the server
3. Your browser will open automatically at `http://localhost:3000`
4. **Done!** 🎉

---

## ✅ Solution 2: Use NPM Commands

Open your terminal in this folder and run:

```bash
# First time only - install dependencies
npm install

# Start the development server
npm run dev
```

The game will open automatically at `http://localhost:3000`

---

## ✅ Solution 3: Use Python (If you have Python installed)

Open terminal in this folder:

```bash
# Python 3
python -m http.server 3000

# Python 2
python -m SimpleHTTPServer 3000
```

Then open your browser to: `http://localhost:3000`

---

## ✅ Solution 4: Use VS Code Live Server

1. Open this folder in VS Code
2. Install the "Live Server" extension
3. Right-click `index.html`
4. Click "Open with Live Server"

---

## ✅ Solution 5: Use npx (No installation needed)

```bash
npx serve
```

Then open the URL shown in the terminal.

---

## 🌐 Deploy to the Internet

Once it works locally, deploy it:

### Easiest Method: Netlify Drop

1. Run: `npm run build`
2. Go to: https://app.netlify.com/drop
3. Drag the `dist` folder
4. **Your game is live on the internet!** 🚀

See `DEPLOYMENT_GUIDE.md` for more options.

---

## 🎮 How to Use the Game

Once the server is running:

1. **Click a tile** to select it
2. **Choose Diamond 💎 or Bomb 💣**
3. **Find all diamonds** without hitting bombs!
4. Use the buttons to:
   - Reset the game
   - Change difficulty (Easy/Hard)
   - Select card type

---

## 📁 What Files Were Created

- `index.html` - The main game page (beautiful UI!)
- `package.json` - Project configuration
- `vite.config.js` - Build tool configuration
- `server.js` - Simple Node.js server
- `start-server.bat` - Windows batch file to start easily
- `README.md` - Full documentation
- `PIXI_INTEGRATION_GUIDE.md` - Complete PixiJS guide
- `DEPLOYMENT_GUIDE.md` - How to deploy online

---

## 🐛 Troubleshooting

### "npm is not recognized"

**Solution:** Install Node.js from https://nodejs.org/

### Port 3000 already in use

**Solution:** Change the port in `vite.config.js`:
```javascript
server: {
  port: 3001, // Change to any available port
}
```

### Assets not loading

**Solution:** Make sure you're running the server from the project root folder.

---

## 🎯 Next Steps

1. ✅ Get it running locally (use any method above)
2. ✅ Test the game
3. ✅ Build for production: `npm run build`
4. ✅ Deploy to Netlify/Vercel
5. ✅ Share your game with the world! 🌍

---

**Need more help?** Check the other documentation files or open an issue!

**Enjoy your game! 💎💣**

