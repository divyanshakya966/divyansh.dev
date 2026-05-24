# Divyansh.dev

An interactive portfolio built to present my work, interests, and current focus through a strong visual identity and a lightweight, modern frontend stack.

This project is intentionally opinionated: it leans into a dark, terminal-inspired aesthetic, subtle motion, and focused section-based storytelling rather than a generic brochure layout.

## What This Project Shows

- A personal portfolio experience centered on projects, skills, experience, and current work
- A custom visual system with animated transitions, themed surfaces, and a tailored cursor treatment
- A compact content structure designed to keep the presentation clear without exposing unnecessary implementation detail

## Tech Stack

- React 19
- TypeScript
- TanStack Start / TanStack Router
- Vite
- Tailwind CSS v4
- Cloudflare Workers / Wrangler
- Radix UI primitives
- Lucide icons
- Recharts

## Architecture Snapshot

The app is organized as a section-driven portfolio with reusable UI and content modules.

- `src/components/portfolio` contains the branded portfolio sections and interaction pieces
- `src/components/ui` holds reusable UI primitives
- `src/routes` defines the route entry points
- `src/server.ts` acts as the Cloudflare server entry with SSR error normalization
- `src/styles.css` defines the theme, motion system, and global presentation layer

The structure keeps the visible portfolio content separate from the lower-level UI and runtime wiring, which makes the project easier to evolve while preserving the public-facing experience.

## Design Direction

The overall direction is modern, minimal, and technical:

- monochrome base palette with restrained accents
- terminal-like cursor and subtle hover responses
- layered glass and glow effects
- section-based narrative flow
- mobile-aware responsive layouts

## Focus

This repository is meant to represent my profile and work in a polished way, not to document every implementation detail. The emphasis is on presentation, clarity, and a strong first impression.