# FootprintCO2 AI — AI-Powered Sustainability Coach & Carbon Tracker

> **Live Demo:** [https://yash-zope.github.io/FootprintCO2-AI/](https://yash-zope.github.io/FootprintCO2-AI/)

FootprintCO2 AI is a modern, client-side web application that helps individuals understand, track, and reduce their carbon footprint through a rule-based **Decision Engine** and a token-optimized **AI Sustainability Coach**.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Challenge Alignment](#challenge-alignment)
3. [Chosen Vertical](#chosen-vertical)
4. [Features](#features)
5. [Why LocalStorage](#why-localstorage)
6. [System Architecture](#system-architecture)
7. [Decision Engine](#decision-engine)
8. [Token Optimization Strategy](#token-optimization-strategy)
9. [Technology Stack](#technology-stack)
10. [Security & Privacy](#security--privacy)
11. [Accessibility](#accessibility)
12. [Testing](#testing)
13. [Screenshots](#screenshots)
14. [Live Demo](#live-demo)
15. [Assumptions](#assumptions)
16. [Future Enhancements](#future-enhancements)

---

## Problem Statement

Many individuals want to reduce their environmental impact but struggle to understand which daily habits contribute most to their carbon footprint.

Most carbon calculators only provide numbers without explaining:

- **What contributes most** to emissions
- **Which actions have the highest impact**
- **How users can track long-term improvement**

FootprintCO2 AI addresses this gap through intelligent recommendations, progress tracking, and personalized sustainability coaching — all designed for an Indian audience using Indian standards (km, kWh electricity units, LPG cylinders, Indian CEA grid factors).

---

## Challenge Alignment

| Challenge Requirement | How FootprintCO2 AI Meets It |
|---|---|
| **Smart, Dynamic Assistant** | AI Sustainability Coach delivers personalized, context-aware advice |
| **Logical Decision Making** | Rule-based Decision Engine prioritizes categories before invoking AI |
| **Practical Real-World Usability** | Recommendations are India-specific (Metro commute, BEE 5-star LEDs, PM Surya Ghar solar, 24°C AC) |
| **Token-Efficient AI Usage** | Rule-based logic runs first; AI is called only for deep personalization with summarized payloads |
| **Clean & Maintainable Code** | Modular architecture — each JS file has a single responsibility |
| **Accessibility-Focused Design** | Semantic HTML, ARIA labels, keyboard navigation, high-contrast dark theme |

---

## Chosen Vertical

**AI Sustainability Coach & Carbon Footprint Awareness**

**Target Audience:**

- 🎓 Students wanting to learn about sustainability
- 💼 Working professionals tracking commute and energy habits
- 🌿 Environment-conscious individuals seeking actionable change

---

## Features

| Feature | Description |
|---|---|
| **Carbon Footprint Calculator** | Converts transport (km), electricity (units), LPG cylinders, diet, and waste habits into annual tCO₂e using Indian CEA emission factors |
| **AI Sustainability Coach** | Gemini-powered personalized advice with local template fallback for offline use |
| **Decision Engine** | Rule-based priority routing (Transport >40%, Energy >35%, Food >30%, Waste >25%) |
| **Personalized Recommendations** | Top 3 highest-impact actions selected from a curated India-specific database |
| **Progress Tracking** | Historical bar chart showing footprint trends over time |
| **Pledge System** | Users commit to specific actions (e.g., "Weekly Metro Commute", "Set AC to 24°C") |
| **Eco Points & Gamification** | Points and tier ranks (Eco-Novice → Eco-Guardian) drive long-term engagement |
| **AI Response Caching** | Cached insights refresh only when footprint changes by >15% — reducing token usage |
| **Offline Support** | Local template-based coach advice works without an API key or network |

---

## Why LocalStorage?

FootprintCO2 AI is designed as a **personal sustainability coach**. Since carbon footprint data is user-specific and does not require multi-user collaboration, LocalStorage was chosen instead of a traditional database.

**Benefits:**

- ✅ **Privacy-first** — data never leaves the user's browser
- ✅ **Offline support** — works without internet after first load
- ✅ **Zero backend complexity** — no servers, no databases, no hosting costs
- ✅ **Fast performance** — instant read/write with no network latency
- ✅ **Easy deployment** — static files served via GitHub Pages

> The architecture allows future migration to Firebase, Supabase, or PostgreSQL without major structural changes.

---

## System Architecture

The platform separates responsibilities into independent, single-responsibility modules:

```
┌──────────────────────────────────────────┐
│          User Interface Layer            │
│     (HTML5 / CSS3 / Responsive UI)       │
└──────────────────┬───────────────────────┘
                   │
┌──────────────────▼───────────────────────┐
│       Carbon Calculator Engine           │
│  (Indian CEA factors, km, kWh, LPG)     │
└──────────────────┬───────────────────────┘
                   │
┌──────────────────▼───────────────────────┐
│          Decision Engine                 │
│  (Transport >40%, Energy >35%,           │
│   Food >30%, Waste >25%)                 │
└──────────────────┬───────────────────────┘
                   │
┌──────────────────▼───────────────────────┐
│       Recommendation Engine              │
│  (Top 3 highest-impact actions)          │
└──────────────────┬───────────────────────┘
                   │
┌──────────────────▼───────────────────────┐
│     AI Deep Analysis Layer               │
│  (Gemini API — summarized payloads only) │
└──────────────────┬───────────────────────┘
                   │
┌──────────────────▼───────────────────────┐
│      LocalStorage Cache Layer            │
│  (Profile, History, Pledges, AI Cache)   │
└──────────────────────────────────────────┘
```

### Module Mapping

| Module | File | Responsibility |
|---|---|---|
| Calculator Engine | `assets/js/calc.js` | Emission factor calculations |
| Decision Engine | `assets/js/decision.js` | Category prioritization rules |
| Recommendation Engine | `assets/js/recommendation.js` | Action database and ranking |
| AI Coach | `assets/js/ai.js` | LLM integration and caching |
| Storage Layer | `assets/js/storage.js` | LocalStorage persistence |
| App Controller | `assets/js/app.js` | UI bindings and state management |

---

## Decision Engine

The platform prioritizes recommendations using **rule-based logic before invoking AI**. This ensures instant responses with zero token cost for the majority of interactions.

### Priority Rules

| Rule | Threshold | Action |
|---|---|---|
| Transport dominates | > 40% of total | Prioritize transport recommendations |
| Energy dominates | > 35% of total | Prioritize energy optimization |
| Food dominates | > 30% of total | Prioritize dietary changes |
| Waste dominates | > 25% of total | Prioritize waste reduction |

- Categories are sorted by their actual percentage contribution (highest first)
- Flagged categories (exceeding thresholds) are always ranked above non-flagged ones
- Only the **top 3 highest-impact recommendations** are presented

### Indian Emission Factors

| Input | Factor | Source |
|---|---|---|
| Petrol/Diesel Car | 0.20 kg CO₂e per km | Indian automotive testing standards |
| Electric Vehicle | 0.12 kg CO₂e per km | Based on Indian grid mix intensity |
| Public Transit (Metro/Bus) | 0.04 kg CO₂e per passenger km | Shared transit averages |
| Electricity | 0.82 kg CO₂e per kWh (unit) | Indian CEA (Central Electricity Authority) |
| LPG Cylinder | 42.5 kg CO₂e per 14.2 kg cylinder | Standard domestic LPG combustion |
| Flights | 90 kg CO₂e per hour | IPCC aviation factors |

---

## Token Optimization Strategy

FootprintCO2 AI is designed with **efficiency and cost optimization as core principles**.

| Strategy | Implementation |
|---|---|
| **Rule-based first** | Decision Engine and Recommendation Engine run entirely client-side before any AI call |
| **Summarized payloads** | Only category totals and goal are sent to Gemini — never raw input logs |
| **Response caching** | AI advice is cached in LocalStorage and reused across sessions |
| **Change threshold** | Cache is refreshed only when footprint changes by **>15%** or on manual request |
| **Output limiting** | Gemini is instructed to produce 3–4 sentences (under 120 words) with `maxOutputTokens: 200` |
| **Offline fallback** | Template-based local advice serves immediately if API is unavailable |

**Result:** The average user triggers zero AI calls during normal calculator interactions. AI is invoked only for deep personalization on explicit request.

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, CSS3, JavaScript (ES6+) |
| **Typography** | Google Fonts (Outfit, Inter) |
| **Storage** | HTML5 LocalStorage |
| **AI** | Google Gemini 1.5 Flash API |
| **Hosting** | GitHub Pages |
| **Testing** | Node.js native `assert` module |

---

## Security & Privacy

- ❌ **No user accounts** — no signup, no login
- ❌ **No personal data collection** — no emails, names, or addresses stored remotely
- ✅ **Local-first storage** — all data stays in the user's browser
- ✅ **Summarized AI payloads** — only aggregated carbon numbers are transmitted
- ❌ **No transmission of historical logs** — activity history never leaves the device
- ✅ **Input validation** — all user inputs are sanitized with `parseFloat`/`parseInt` and bounded with `Math.max`/`Math.min`

---

## Accessibility

| Feature | Implementation |
|---|---|
| **Semantic HTML** | Proper use of `<header>`, `<main>`, `<section>`, `<footer>`, `<nav>`, `<form>`, `<label>` |
| **Keyboard Navigation** | All interactive elements (buttons, sliders, selects) are natively keyboard-accessible |
| **Responsive Design** | CSS Grid and Flexbox layouts adapt to mobile (375px), tablet (768px), and desktop (1024px+) |
| **High Contrast Colors** | Deep forest dark theme (`hsl(222, 47%, 4%)`) with white text and vibrant mint/cyan accents exceeding WCAG AA |
| **ARIA Labels** | Applied to navigation badges, point displays, rank indicators, and interactive controls |

---

## Testing

Automated unit tests validate all core engines. Run from the project root:

```bash
node test.js
```

### Test Coverage

| Test Suite | What It Validates |
|---|---|
| **Formula Validation** | Standard car km calculations (e.g., `150 km/week × 52 × 0.00020 = 1.56 tCO₂e/yr`) |
| **Boundary/Edge Cases** | Zero inputs, maximum values, single-person households |
| **Decision Engine Rules** | Transport at 45% → transport ranked first; Food at 60% → food ranked first |
| **Recommendation Filtering** | Active pledges excluded from results; exactly 3 recommendations returned |
| **AI Cache Threshold** | 10% change → cache hit (no refresh); 20% change → cache miss (refresh triggered) |

### Test Results

```
==========================================
   RUNNING FOOTPRINTCO2 AI ENGINE TESTS  
==========================================

✅ Passed: CalcEngine basic calculations with Indian standard inputs
✅ Passed: CalcEngine handles zero value boundary checks correctly
✅ Passed: CalcEngine clamps negative inputs and out-of-bounds percentages
✅ Passed: DecisionEngine prioritization rules work correctly
✅ Passed: RecommendationEngine filters active pledges and respects Decision priorities
✅ Passed: AICoach cache validation logic enforces 15% delta rules
✅ Passed: StorageLayer recovers and auto-resets corrupted profile keys
✅ Passed: StorageLayer handles QuotaExceededExceptions by dropping AI cache

==========================================
🎉 ALL 8 TESTS COMPLETED SUCCESSFULLY!
==========================================
```

---

## Screenshots

### Dashboard
![Dashboard showing carbon footprint metrics, progress bars, and recommendations](screenshots will be added after deployment)

### AI Sustainability Coach
![AI Coach panel showing personalized advice and cache status](screenshots will be added after deployment)

### Interactive Carbon Calculator
![Slider-based calculator with transport, energy, food, and waste inputs](screenshots will be added after deployment)

---

## Live Demo

🌐 **[https://yash-zope.github.io/FootprintCO2-AI/](https://yash-zope.github.io/FootprintCO2-AI/)**

---

## Assumptions

1. **India-centric design** — all units use km, electricity units (kWh), and LPG cylinders with Indian CEA emission factors
2. **Single-user application** — designed for personal use; no multi-user or collaborative features
3. **Browser support** — targets modern browsers (Chrome, Firefox, Edge, Safari) with LocalStorage support
4. **Gemini API key** — optional; the platform works fully without one using local template-based advice
5. **Annual estimation** — weekly/monthly inputs are annualized (×52 weeks or ×12 months) for consistency
6. **Indian national average** — baseline comparison uses ~1.9 tonnes CO₂e/year per capita

---

## Future Enhancements

- 🔄 Multi-device synchronization via cloud storage (Firebase/Supabase)
- 🌍 Country-specific emission factor selection
- 👥 Community sustainability challenges and leaderboards
- 📅 Weekly AI-generated personalized green action plans
- 🌱 Carbon offset marketplace integrations
- 📊 Export reports as PDF for sharing
- 🇮🇳 Hindi and regional language support

---

## Project Structure

```
FootprintCO2-AI/
├── index.html                  # Main application layout
├── assets/
│   ├── css/
│   │   └── style.css           # Premium glassmorphic dark theme
│   └── js/
│       ├── calc.js             # Carbon Calculator Engine (Indian factors)
│       ├── decision.js         # Decision Engine (rule-based prioritization)
│       ├── recommendation.js   # Recommendation Engine (India-specific actions)
│       ├── ai.js               # AI Sustainability Coach (Gemini + caching)
│       ├── storage.js          # LocalStorage persistence layer
│       └── app.js              # Main application controller
├── test.js                     # Automated unit test suite
└── README.md                   # This file
```

---

## How to Run Locally

```bash
# Clone the repository
git clone https://github.com/YASH-ZOPE/FootprintCO2-AI.git

# Open in browser
cd FootprintCO2-AI
# Open index.html in any modern browser
```

No build step, no dependencies, no `npm install` required. The application runs entirely from static files.

---

## License

This project was built for the Carbon Footprint Awareness Challenge.

FootprintCO2 AI © 2026. Made with ♥ for the Planet.
