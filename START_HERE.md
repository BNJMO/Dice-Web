# 🎮 START HERE - Complete Setup Guide

## 🚨 You Have Two Issues to Fix:

1. **Invisible boxes** (but sounds work) - We'll fix this
2. **Need free deployment** - We'll deploy it

Let's solve both!

---

## 🔧 Step 1: Fix the Invisible Boxes

### Quick Diagnosis

Open your browser and press **F12** to open Developer Tools. Look at the Console tab.

**Do you see this error?**
```
Access to script at 'file://...' has been blocked by CORS policy
```

**✅ YES** → You're opening the file directly. You MUST use a web server!

**❌ NO** → Skip to "Other Issues" below

---

## 🚀 Step 2: Run with a Web Server

Choose ONE method:

### Method 1: NPM (Best for Development)

```bash
# Install dependencies (first time only)
npm install

# Start development server
npm run dev
```

Your browser will open automatically at `http://localhost:3000`

### Method 2: Python (If you have Python)

```bash
# Python 3
python -m http.server 3000

# Then open: http://localhost:3000
```

### Method 3: VS Code Live Server

1. Install "Live Server" extension in VS Code
2. Right-click `index.html`
3. Click "Open with Live Server"

### Method 4: npx (No installation needed)

```bash
npx serve
```

Then open the URL shown in the terminal.

---

## 🧪 Step 3: Test PixiJS

Before running the full game, test if PixiJS works:

1. **Start your web server** (using any method above)
2. **Open:** `http://localhost:3000/test-pixi.html`
3. **You should see:**
   - ✅ Green success messages
   - ✅ A yellow rectangle
   - ✅ A green animated circle
   - ✅ "PixiJS is Working!" text

**If the test passes** → PixiJS works! Go to `index.html`

**If the test fails** → See `TROUBLESHOOTING.md`

---

## 🎮 Step 4: Run Your Game

1. **Open:** `http://localhost:3000/index.html`
2. **You should see:**
   - Yellow/green tiles in a 5x5 grid
   - Hover effects with sounds
   - Control buttons on the right

**Still invisible?** → See "Other Issues" below

---

## 🐛 Other Issues (If Not CORS)

### Issue: Assets Not Loading

**Check browser console for 404 errors:**

```
Failed to load resource: assets/sprites/Diamond.png
```

**Fix:** Make sure these files exist:
- `assets/sprites/Diamond.png`
- `assets/sprites/Bomb.png`
- `assets/sprites/Explosion_Spritesheet.png`
- All `.ogg` files in `assets/sounds/`

### Issue: Canvas Has Zero Size

**Check in browser console:**
```javascript
const mines = document.querySelector('#mines');
console.log('Size:', mines.clientWidth, mines.clientHeight);
```

**If both are 0:**
- The container has no size
- Check if CSS is loading
- Try adding explicit size in HTML

### Issue: WebGL Not Supported

**Test WebGL:** Visit https://get.webgl.org/

**If it fails:**
- Update your browser
- Try a different browser (Chrome recommended)
- Enable WebGL in browser settings

### Issue: Module Import Errors

**Error:**
```
Failed to resolve module specifier "pixi.js"
```

**Fix:** You need to use a bundler (Vite). Run:
```bash
npm install
npm run dev
```

---

## 🌐 Step 5: Deploy for Free (No Windows Needed!)

Once it works locally, deploy it to the internet!

### 🏆 Easiest Method: Netlify Drag & Drop

1. **Build your project:**
```bash
npm run build
```

2. **Go to:** https://app.netlify.com/drop

3. **Sign up** (free, takes 30 seconds)

4. **Drag the entire project folder** (or just the `dist` folder after building)

5. **Done!** Your game is live at: `https://your-game.netlify.app`

**No Windows needed! No command line needed! Just drag and drop!**

### Alternative: Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

Follow the prompts. Your game will be live in seconds!

### Alternative: GitHub Pages

1. **Push to GitHub:**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

2. **Go to:** https://app.netlify.com/ or https://vercel.com/

3. **Click:** "New site from Git"

4. **Connect** your repository

5. **Deploy!**

Every push will auto-deploy!

---

## 📁 Files Created for You

Here's what I created:

### Main Files
- `index.html` - Beautiful game page with UI
- `test-pixi.html` - Test page to verify PixiJS works

### Configuration
- `package.json` - Dependencies and scripts
- `vite.config.js` - Build configuration
- `netlify.toml` - Netlify deployment config
- `vercel.json` - Vercel deployment config

### Documentation
- `START_HERE.md` - This file (start here!)
- `README.md` - Full project documentation
- `QUICK_START.md` - Quick start guide
- `PIXI_INTEGRATION_GUIDE.md` - Complete PixiJS guide
- `DEPLOY_NOW.md` - Deployment instructions
- `DEPLOYMENT_GUIDE.md` - Detailed deployment guide
- `TROUBLESHOOTING.md` - Fix common issues

### Helpers
- `server.js` - Simple Node.js server
- `start-server.bat` - Windows batch file (double-click to start)
- `.gitignore` - Git ignore file

---

## ✅ Success Checklist

You'll know everything is working when:

- [ ] No CORS errors in console
- [ ] `test-pixi.html` shows animated graphics
- [ ] `index.html` shows yellow tiles in a grid
- [ ] Tiles respond to hover (visual + sound)
- [ ] You can click tiles and select Diamond/Bomb
- [ ] Game resets when you click Reset button
- [ ] No errors in browser console

---

## 🎯 Quick Commands Reference

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Test the production build
npx serve dist

# Deploy to Vercel
vercel

# Deploy to Netlify (after building)
# Just drag the 'dist' folder to https://app.netlify.com/drop
```

---

## 🆘 Still Having Issues?

1. **Read:** `TROUBLESHOOTING.md` - Detailed solutions
2. **Test:** Open `test-pixi.html` to verify PixiJS
3. **Check:** Browser console (F12) for errors
4. **Verify:** You're using a web server (not opening file directly)
5. **Try:** Different browser (Chrome recommended)

---

## 🎉 Next Steps

Once everything works:

1. ✅ Test locally
2. ✅ Build: `npm run build`
3. ✅ Deploy to Netlify/Vercel
4. ✅ Share your game URL!
5. ✅ Add custom domain (optional)

---

## 📚 Learn More

- **PixiJS Docs:** https://pixijs.com/8.x/guides
- **PixiJS Examples:** https://pixijs.com/8.x/examples
- **Vite Docs:** https://vitejs.dev/
- **Netlify Docs:** https://docs.netlify.com/

---

## 💡 Pro Tips

1. **Always use a web server** - Never open HTML files directly
2. **Test with `test-pixi.html` first** - Verify PixiJS works
3. **Check browser console** - Most issues show errors there
4. **Use Netlify drag-and-drop** - Easiest deployment method
5. **Keep assets organized** - Check file paths carefully

---

**Your game is awesome! Let's get it working and deployed! 🚀**

Start with Step 1 above and work through each step. You'll be live on the internet in under 10 minutes!

