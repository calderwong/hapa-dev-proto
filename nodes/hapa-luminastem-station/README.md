# Hapa LuminaStem Station

A 3D music visualization and stem separation application with integrated Gemini AI capabilities for the Hapa ecosystem.

## Overview

The LuminaStem Station provides:
- **3D Music Visualization**: Real-time audio-reactive 3D graphics using Three.js
- **Stem Separation**: AI-powered audio stem extraction and manipulation
- **Gemini Integration**: AI assistant for music analysis and generation
- **Secure Backend**: FastAPI node with bearer token authentication
- **Web Interface**: React + Three.js interactive 3D experience

## Components

- `luminastem-3d/`
  - Canonical Vite + React frontend
  - Dev proxy is configured for `__hapa/luminastem` and injects `Authorization: Bearer <token>` automatically
- `hapa_luminastem_node/`
  - Loopback-only FastAPI backend
  - Generates/persists `.node_token`
  - Exposes `GET /health` (public) and `GET /capabilities` (Bearer token)
  - Exposes `POST /v1/gemini/generateContent` (Bearer token)

## Quickstart (dev)

### 1) Start the backend

From this repo root:

- Install deps:
  - `python3 -m venv .venv`
  - `source .venv/bin/activate`
  - `pip install -r requirements.txt`
- Configure env:
  - `cp .env.example .env`
  - Set `GEMINI_API_KEY` in `.env`
- Run:
  - `python3 -m hapa_luminastem_node`

On first run, the node writes a `.node_token` file in this folder.

### 2) Start the frontend

From `luminastem-3d/`:

- `npm install`
- `npm run dev`

The frontend calls the backend via Vite proxy at:

- `/__hapa/luminastem/v1/gemini/generateContent`

## Self-test

After the backend is running:

- Basic (health + capabilities; skips Gemini if not configured):
  - `python3 -m hapa_luminastem_node.self_test`

- Require Gemini proxy to succeed:
  - `python3 -m hapa_luminastem_node.self_test --require-gemini`

## API summary

- `GET /health` (public)
- `GET /capabilities` (Bearer token)
- `POST /v1/gemini/generateContent` (Bearer token)

## Notes

- The Gemini API key is **backend-only**. Don’t add it to any Vite `define` block or frontend `.env.local`.
