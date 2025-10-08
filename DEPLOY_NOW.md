# 🚀 Deploy Your Game NOW - 100% Free!

## 🎯 Easiest Method: Netlify (Recommended!)

### Option 1: Drag & Drop (No Command Line!)

1. **Go to:** https://app.netlify.com/drop
2. **Sign up** (free, takes 30 seconds)
3. **Drag the ENTIRE project folder** (not just dist)
4. **Done!** Your game is live! 🎉

Netlify will automatically:
- Install dependencies
- Build your project
- Deploy it
- Give you a URL like: `https://your-game-name.netlify.app`

### Option 2: GitHub Integration (Auto-Deploy on Push)

1. **Push your code to GitHub:**
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

2. **Go to:** https://app.netlify.com/
3. **Click:** "New site from Git"
4. **Connect** your GitHub repository
5. **Settings are auto-detected** (thanks to `netlify.toml`)
6. **Click:** "Deploy site"

**Every time you push to GitHub, it auto-deploys!** 🚀

---

## ⚡ Alternative: Vercel (Also Free!)

### Option 1: Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Deploy (it will ask you to login first time)
vercel

# For production deployment
vercel --prod
```

### Option 2: GitHub Integration

1. **Push code to GitHub** (see above)
2. **Go to:** https://vercel.com/
3. **Click:** "Import Project"
4. **Select** your repository
5. **Click:** "Deploy"

Settings are auto-detected from `vercel.json`!

---

## 🌐 Alternative: Cloudflare Pages (Unlimited Bandwidth!)

1. **Push code to GitHub**
2. **Go to:** https://pages.cloudflare.com/
3. **Click:** "Create a project"
4. **Connect** your GitHub repository
5. **Build settings:**
   - Build command: `npm run build`
   - Build output: `dist`
6. **Click:** "Save and Deploy"

---

## 📦 Alternative: GitHub Pages (Free with GitHub)

```bash
# Install gh-pages package
npm install -D gh-pages

# Add to package.json scripts:
# "deploy": "npm run build && gh-pages -d dist"

# Deploy
npm run deploy
```

Your site will be at: `https://YOUR_USERNAME.github.io/YOUR_REPO/`

**Note:** Update `vite.config.js` base path:
```javascript
base: '/YOUR_REPO/', // Replace with your repo name
```

---

## 🎮 Fix the Invisible Boxes Issue

The boxes are invisible because the canvas might not be rendering properly. Here's the fix:

### Quick Fix: Check Browser Console

1. Open your browser's Developer Tools (F12)
2. Look for any errors in the Console
3. Common issues:
   - Assets not loading (check paths)
   - WebGL not supported (rare)
   - Canvas size is 0

### Debugging Steps:

1. **Check if PixiJS initialized:**
   - You should see a green debug overlay saying "PIXI OK"
   - If not, check console for errors

2. **Check if tiles are created:**
   - Open console and type: `window.minesGame`
   - You should see the game object

3. **Force visibility (temporary test):**
   Add this to your browser console:
   ```javascript
   const tiles = document.querySelectorAll('canvas');
   tiles.forEach(c => {
     c.style.border = '2px solid red';
     console.log('Canvas size:', c.width, c.height);
   });
   ```

### Common Causes:

1. **Container has no size:**
   - The `#mines` div needs explicit dimensions
   - Check if CSS is loading properly

2. **Assets not loading:**
   - Check if images are in the correct paths
   - Open Network tab in DevTools

3. **WebGL context lost:**
   - Refresh the page
   - Try a different browser

---

## 🐛 Troubleshooting Deployment

### Build Fails

**Error:** `npm: command not found`
**Fix:** Netlify/Vercel have Node.js pre-installed, this shouldn't happen. If it does, check your `package.json` is valid.

**Error:** `Module not found`
**Fix:** Make sure all dependencies are in `package.json`, not just `devDependencies`.

### Assets Not Loading

**Error:** 404 on images/sounds
**Fix:** Check that `assets/` folder is committed to Git and paths are correct.

### Blank Page After Deploy

**Fix:** 
1. Check browser console for errors
2. Verify build completed successfully
3. Check that `dist/index.html` exists after build

---

## ✅ Deployment Checklist

Before deploying:

- [ ] Game works locally (test with `npm run dev`)
- [ ] All assets load correctly
- [ ] No console errors
- [ ] `npm run build` completes successfully
- [ ] Test the `dist` folder locally: `npx serve dist`
- [ ] All files committed to Git (if using Git integration)
- [ ] `package.json` has all dependencies
- [ ] Configuration files present (`netlify.toml` or `vercel.json`)

---

## 🎉 After Deployment

Your game will be live at a URL like:
- Netlify: `https://your-game-name.netlify.app`
- Vercel: `https://your-game-name.vercel.app`
- Cloudflare: `https://your-game-name.pages.dev`
- GitHub Pages: `https://username.github.io/repo-name/`

### Share Your Game!

- Copy the URL
- Share on social media
- Send to friends
- Add to your portfolio

### Custom Domain (Optional)

All platforms support custom domains for free:
1. Buy a domain (Namecheap, Google Domains, etc.)
2. Add it in platform settings
3. Update DNS records
4. Wait for SSL certificate (automatic)

---

## 💡 Pro Tips

1. **Use Netlify for easiest deployment** - Just drag and drop!
2. **Use Vercel for best performance** - Edge network
3. **Use Cloudflare for unlimited bandwidth** - No limits
4. **Use GitHub Pages for open source** - Free forever

All are 100% free for personal projects!

---

## 🆘 Still Having Issues?

1. **Check the build logs** in your deployment platform
2. **Test locally first:** `npm run build && npx serve dist`
3. **Check browser console** for errors
4. **Verify all files are uploaded** (check deployment file list)

---

**Your game will be live in under 5 minutes! 🚀**

Choose Netlify drag-and-drop for the absolute easiest method!

