# ⚡ Quick Reference Card

## 🚨 Fix Invisible Boxes

```bash
# The problem: CORS error from opening file directly
# The solution: Use a web server!

# Option 1 (Best)
npm install && npm run dev

# Option 2
python -m http.server 3000

# Option 3
npx serve
```

Then open: `http://localhost:3000`

---

## 🧪 Test PixiJS First

Before running the game:
1. Start web server
2. Open: `http://localhost:3000/test-pixi.html`
3. Should see animated graphics
4. If it works → Open `index.html`
5. If it fails → Read `TROUBLESHOOTING.md`

---

## 🚀 Deploy for Free (30 seconds!)

```bash
# 1. Build
npm run build

# 2. Deploy
# Go to: https://app.netlify.com/drop
# Drag the 'dist' folder
# Done!
```

Alternative:
```bash
npm install -g vercel
vercel
```

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| `START_HERE.md` | **Read this first!** |
| `index.html` | Main game page |
| `test-pixi.html` | Test PixiJS works |
| `TROUBLESHOOTING.md` | Fix issues |
| `DEPLOY_NOW.md` | Deploy guide |

---

## 🐛 Quick Fixes

| Problem | Solution |
|---------|----------|
| CORS error | Use web server |
| 404 errors | Check asset paths |
| Blank page | Check console (F12) |
| Canvas invisible | Check container size |
| Module error | Run `npm install` |

---

## 💻 Commands

```bash
# Install
npm install

# Dev server
npm run dev

# Build
npm run build

# Test build
npx serve dist

# Deploy
vercel
```

---

## 🌐 Free Hosting

- **Netlify:** https://app.netlify.com/drop (drag & drop!)
- **Vercel:** `vercel` command
- **Cloudflare:** https://pages.cloudflare.com/
- **GitHub Pages:** Push to `gh-pages` branch

---

## 🆘 Help

1. Check browser console (F12)
2. Read `TROUBLESHOOTING.md`
3. Test with `test-pixi.html`
4. Verify web server is running
5. Check asset files exist

---

## ✅ Success Checklist

- [ ] Web server running
- [ ] No CORS errors
- [ ] `test-pixi.html` works
- [ ] Game tiles visible
- [ ] Hover effects work
- [ ] Sounds play
- [ ] No console errors

---

**Need more details? Read `START_HERE.md`**

