# Khabar CG22 Publish Center

A desktop-first, responsive publishing workspace prototype for the Khabar CG22 newsroom.

## Phase 1 features
- Overview dashboard and destination status
- News editor with headline, story, category and location
- Featured image upload (JPG/PNG/WEBP, up to 1.2 MB) or image URL
- Live article-card preview
- Destination selection for Blogger, Instagram, Facebook Page, YouTube, WhatsApp Channel and WhatsApp Broadcast
- Save, edit and delete local drafts
- Local demo publishing queue and demo history
- Browser localStorage persistence

## Run
Open `index.html` in a modern browser, or enable GitHub Pages for this repository (Settings → Pages → Deploy from a branch → main → /(root)).

## Important: demo mode
This project does **not** publish or send content to any external platform. Drafts and queue entries are stored only in the current browser on the current device. Clearing browser data may remove them. No API credentials are used.

## Roadmap
1. Phase 1 — editor, preview, local drafts and queue (current)
2. Phase 2 — secure official Blogger and Meta integrations
3. Phase 3 — YouTube Data API and WhatsApp sharing workflows

Never put API keys, OAuth client secrets or access tokens in public frontend files. Future automated integrations must use secure server-side storage and official platform APIs. WhatsApp Channel automation will be implemented only if the official supported API and permissions allow it; otherwise use a manual share workflow.

## Project
Khabar CG22 · आपकी खबर, आपकी आवाज़
