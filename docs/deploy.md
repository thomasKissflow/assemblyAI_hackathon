# Deploying to Vercel

Heard Chef is a static Vite app, so Vercel builds `dist/` and serves it over HTTPS. That's all the microphone needs. `vercel.json` pins the settings: `npm ci`, `npm run build` (type check plus Vite build), output `dist`.

## Before you start: use a demo key

`VITE_ASSEMBLYAI_API_KEY` is baked into the JavaScript at build time. Anyone who opens the site can find it in the browser's developer tools.

- Create a separate key in the AssemblyAI dashboard for the public demo, and don't use your main key.
- Watch its usage during judging, and delete or rotate it afterwards.

## Steps (Vercel dashboard)

1. Go to <https://vercel.com> and sign in with GitHub, on the account that owns `thomasKissflow/assemblyAI_hackathon`.
2. Click **Add New… → Project**.
3. Find **assemblyAI_hackathon** in the list and click **Import**. If it's missing, click **Adjust GitHub App Permissions** and give Vercel access to that repo.
4. On **Configure Project**:
   - **Project Name:** e.g. `heard-chef`. This becomes `heard-chef.vercel.app` if it's free.
   - **Framework Preset:** Vite (detected).
   - **Root Directory:** `./`
   - **Build and Output Settings:** leave them alone; `vercel.json` sets them.
   - **Environment Variables:** add Key `VITE_ASSEMBLYAI_API_KEY`, Value = your demo key.
5. Click **Deploy**. The build takes about one to two minutes.
6. Open the URL Vercel shows, like `https://heard-chef.vercel.app`, in **Chrome** with headphones on:
   - The start screen must **not** say "Voice needs an AssemblyAI key". If it does, the variable was missing at build time; see below.
   - Pick a menu, then **Continue with voice**, then allow the microphone.
   - Say "Hey Chef". The ring turns green.
   - Then **Start cooking**.
7. Put the URL in the lablab form as the **Application URL**. For **Demo application platform**, use "Vercel (web app; desktop Chrome)". Also add it to the deck's closing slide (`[App URL]`) and to the README.

## Changing the key later

Vite reads the key at build time, so after changing it you have to rebuild:

1. Go to **Project → Settings → Environment Variables** and edit `VITE_ASSEMBLYAI_API_KEY`.
2. Go to **Deployments**, open the latest deployment's **⋯** menu and choose **Redeploy**.

## Alternative: the Vercel CLI

```bash
npm i -g vercel
vercel login
vercel link          # pick your scope, then create or link the project
vercel env add VITE_ASSEMBLYAI_API_KEY production
vercel --prod
```

## If something goes wrong

- **"Voice needs an AssemblyAI key" on the live site:** the variable was missing or misspelled when it built. Add it (exact name, Production environment), then redeploy.
- **The build fails on Node:** set **Settings → General → Node.js Version** to **22.x**. Vite 8 needs Node 20.19 or newer, or 22.12 or newer.
- **The mic doesn't work:** check the site's microphone permission (the lock icon in Chrome's address bar), and use Chrome on desktop.
- **"Lost the connection to Chef":** click **Reconnect**. If it keeps happening, check the key is valid and has credit.
- **Every push to `main` redeploys automatically.** Pull requests get preview URLs, which only have the key if you also ticked **Preview** for the variable.
