# LinkedIn Connection Indexer

A Chrome extension + web app that indexes your LinkedIn connections to a searchable database using PocketBase.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Your Browser   │────▶│   Next.js App   │────▶│   PocketBase    │
│  + Extension    │     │   (Railway)     │     │   (Railway)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              ▲
                              │
                        ┌─────────────────┐
                        │  Dad's Browser  │
                        │  (Search UI)    │
                        └─────────────────┘
```

## Railway Setup

### 1. Deploy PocketBase
1. In Railway, create a new service from the `pocketbase/` folder
2. It will auto-detect the Dockerfile
3. After deploy, visit `https://your-pb-url.railway.app/_/` to create admin account
4. Create a collection called `connections` with fields:
   - `profile_url` (text, required, unique)
   - `name` (text, required)
   - `headline` (text)
   - `company` (text)
   - `title` (text)
   - `location` (text)
   - `image_url` (text)

### 2. Deploy Next.js App
1. In Railway, create another service from the `web/` folder
2. Set environment variables:
   - `NEXT_PUBLIC_POCKETBASE_URL` = your PocketBase Railway URL
   - `API_KEY` = create any secret string

### 3. Install Chrome Extension
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select `extension/` folder
4. Click extension icon → enter your Next.js URL + API key

## Usage

1. Log into LinkedIn in your browser
2. Go to My Network → Connections
3. Scroll through your connections - they auto-sync!
4. Share the web app URL with your dad to search

## Project Structure

```
├── web/              # Next.js search UI (Railway service 1)
├── pocketbase/       # PocketBase backend (Railway service 2)
└── extension/        # Chrome extension (local install)
```
