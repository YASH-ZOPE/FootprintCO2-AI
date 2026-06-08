# FootprintCO2: AI-Powered Sustainability Coach & Carbon Tracker

FootprintCO2 is a modern, high-end, responsive client-side web application designed to help individuals understand, track, and reduce their carbon footprint. By combining a rule-based **Decision Engine** with a token-optimized **AI Sustainability Coach**, FootprintCO2 delivers instant, highly relevant, and actionable recommendations with minimal resource consumption.

## 🌿 Chosen Vertical & Solution Focus
*   **Vertical**: AI Sustainability Coach & Carbon Footprint Awareness
*   **Aspiration**: Empower users to transition from passive awareness to active footprint reduction. By providing sliding sandbox calculations, gamified pledges, and progress tracking, users receive personalized guidance tailormade for their daily lives.

---

## ⚡ How It Works & Architecture

FootprintCO2 separates operations into independent, highly maintainable layers:

```
User Interface Layer (HTML5/CSS3 Dashboard)
       ↓
Carbon Calculator Engine (Calculates emissions from inputs)
       ↓
Decision Engine (Evaluates category weights and sets priority routing)
       ↓
Recommendation Engine (Filters active pledges and picks top 3 actions)
       ↓
AI Deep Analysis Layer (Calls Gemini API using low-token payloads)
       ↓
LocalStorage Cache Layer (Saves user state, logs, and advice)
```

### 1. Carbon Calculator Engine (`assets/js/calc.js`)
Converts lifestyle habits (transport, energy, food, waste) into metric tonnes of CO₂ equivalent per year (tCO₂e/yr) using standard factors:
*   **Gasoline Vehicles**: `0.35 kg CO2e` per mile
*   **Electric Vehicles**: `0.08 kg CO2e` per mile (incorporating grid-mix charging)
*   **Public Transit**: `0.12 kg CO2e` per passenger mile
*   **Regional Flights**: `90.0 kg CO2e` per hour
*   **Electricity**: `0.40 kg CO2e` per kWh (with solar offset reduction)
*   **Natural Gas**: `5.30 kg CO2e` per therm

### 2. Decision Engine (`assets/js/decision.js`)
Instead of using expensive AI APIs to prioritize targets, FootprintCO2 uses a fast, rule-based logic framework:
*   **IF Transport > 40%** of footprint → Prioritize transport interventions.
*   **IF Energy > 35%** of footprint → Prioritize household energy optimizations.
*   **IF Food > 30%** of footprint → Prioritize diet modifications.
*   **IF Waste > 25%** of footprint → Prioritize recycling and reduction tasks.
Categories are sorted dynamically based on their percentage contributions so that the highest impact drivers are addressed first.

### 3. Recommendation Engine (`assets/js/recommendation.js`)
Matches prioritized categories with a database of realistic pledges (e.g. carpooling, adjusting thermostats, meatless eating). It filters out already active or completed pledges and yields exactly the top 3 highest-impact suggestions.

### 4. AI Deep Analysis Coach (`assets/js/ai.js`)
Provides advanced personalization. To remain cost-effective and token-efficient, the coach adheres to strict rules:
*   **Token Optimization**:
    *   AI requests contain only summarized carbon metrics (e.g. `{"transport": 2.1, "energy": 1.5, ...}`).
    *   No historical log lists or personally identifiable data are sent.
    *   All outputs are limited to 3-4 sentences of highly targeted advice.
*   **Caching Strategy**: Advice is saved to LocalStorage. It is only refreshed when user footprint total changes by **more than 15%** or when explicitly requested.
*   **Offline Fallback**: FootprintCO2 immediately generates detailed template-based coach recommendations locally if the API is offline or the user does not provide a key, ensuring 100% operational availability.

### 5. Storage Layer (`assets/js/storage.js`)
Maintains data persistence across page reloads entirely inside the browser's `LocalStorage`. It tracks:
*   `eco_profile`: General user metadata, total points, and tier rank.
*   `eco_emissions_history`: The last 10 carbon calculations to chart historical trends.
*   `eco_active_pledges`: Active and completed habit records.
*   `eco_ai_insights`: Cached AI coach advice and footprint hash.

---

## 🛠️ Testing & Verification
The platform includes an automated unit test suite (`test.js`) running directly in Node.js validating core algorithms without third-party test dependencies.

### Running Tests
Execute the test runner from the root workspace directory:
```bash
node test.js
```

---

## 🔒 Security & Privacy Considerations
*   **Zero Personal Data**: We do not collect or store emails, addresses, or private details.
*   **100% Client-Side**: All calculation data, history graphs, and user logs are kept locally on the user's computer.
*   **Safe AI Requests**: Transmitted payloads contain only numbers representing annual carbon aggregates.

## ♿ Accessibility Compliance
*   **Semantic HTML**: Adheres strictly to HTML5 landmarks (`<header>`, `<main>`, `<section>`, `<footer>`).
*   **Aria Labels**: Set on active controls, inputs, progress bars, and stats.
*   **High Contrast Themes**: Features deep forest backgrounds (`hsl(222, 47%, 4%)`) paired with stark white text, vibrant mint accents, and glowing borders (exceeding WCAG AAA contrast guidelines).
