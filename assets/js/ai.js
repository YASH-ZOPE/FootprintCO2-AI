/**
 * AI Sustainability Coach & Deep Analysis Layer
 * Manages personalized insights, token-optimized LLM calls, and smart caching.
 */

/** Single source of truth for the Gemini model identifier. */
const GEMINI_MODEL = 'gemini-1.5-flash';

const AICoach = {
    // Threshold to trigger recalculation of AI advice
    CHANGE_THRESHOLD_PERCENT: 15,

    /**
     * Checks if cached advice is valid or needs to be refreshed.
     * Cache is refreshed if it doesn't exist, or if footprint has changed by > 15%.
     * 
     * @param {number} currentTotal - Current total emissions in tCO2e/yr
     * @param {Object} cached - Cached AI insight object
     * @returns {boolean} True if cache must be refreshed
     */
    shouldRefresh(currentTotal, cached) {
        if (!cached || !cached.insights || !cached.lastCalculatedFootprint) {
            return true;
        }
        
        const diff = Math.abs(currentTotal - cached.lastCalculatedFootprint);
        const percentChange = (diff / cached.lastCalculatedFootprint) * 100;
        
        return percentChange > this.CHANGE_THRESHOLD_PERCENT;
    },

    /**
     * Generates a template-based local insight fallback.
     * Serves as an immediate response when offline or without an API key,
     * maintaining high usability and zero API cost.
     * 
     * @param {Object} data - Summarized emissions data
     * @param {number} goal - User's carbon footprint goal
     * @returns {string} Highly structured, personalized advice
     */
    generateLocalInsight(data, goal) {
        const { categories, total, percentages } = data;

        // Find largest contributor
        let maxCategory = 'transport';
        let maxVal = percentages.transport;
        for (const [cat, val] of Object.entries(percentages)) {
            if (val > maxVal) { maxVal = val; maxCategory = cat; }
        }

        // Goal progress
        const goalDiff = total - goal;
        const goalText = goalDiff <= 0
            ? `Congratulations! You are meeting your target of **${goal} t/yr** — you are **${Math.abs(goalDiff).toFixed(1)} t** under budget. Keep it up!`
            : `You are **${goalDiff.toFixed(1)} t** above your annual goal of **${goal} t** (${((goalDiff / goal) * 100).toFixed(0)}% over target). The actions below can close this gap.`;

        // Dynamic, data-driven advice with concrete savings numbers
        const transportSaving = +(categories.transport * 0.20).toFixed(2); // 20% shift to transit
        const energySaving    = +(categories.energy    * 0.15).toFixed(2); // AC +2°C + LED = ~15%
        const foodSaving      = +(categories.food      * 0.18).toFixed(2); // 2 plant-based days/wk
        const wasteSaving     = +(categories.waste     * 0.30).toFixed(2); // composting + recycling

        const categoryAdvice = {
            transport: `Your transport footprint (**${percentages.transport}%** of total, ${categories.transport.toFixed(2)} t/yr) is your largest driver. Replacing **20% of car trips** with shared transit, Metro, or cycling could save approximately **${transportSaving} t CO₂/yr**. Consider carpooling for commutes over 10 km, or using BEST/DTC bus passes for daily routes.`,
            energy:    `Household energy (**${percentages.energy}%** of total, ${categories.energy.toFixed(2)} t/yr) is your primary driver. Raising AC temperature by just 2°C (to 24°C per BEE guidelines) and switching to 5-star LED lighting could cut this by roughly **${energySaving} t CO₂/yr**. Exploring PM Surya Ghar Yojana for rooftop solar can reduce your CEA grid dependency significantly.`,
            food:      `Your diet choices (**${percentages.food}%** of total, ${categories.food.toFixed(2)} t/yr) are your biggest lever. Adopting **2 plant-based days per week** using dals, legumes, and seasonal vegetables from your local mandi could save approximately **${foodSaving} t CO₂/yr**. Buying FSSAI-certified local and organic produce further reduces embedded transport emissions.`,
            waste:     `Shopping and waste habits (**${percentages.waste}%** of total, ${categories.waste.toFixed(2)} t/yr) offer quick wins. Following Swachh Bharat's **wet-dry waste segregation** and composting organic kitchen scraps could reduce this by ~**${wasteSaving} t CO₂/yr**. Prioritising second-hand purchases and repairable electronics avoids embedded production emissions.`
        };

        const advice = categoryAdvice[maxCategory] || categoryAdvice['transport'];

        return `### AI Sustainability Coach Recommendation\n\n${goalText}\n\n**Key Area for Improvement:** ${advice}\n\n*Tip:* Head to the Pledge Center to commit to specific actions and start earning Eco-Points!`;
    },

    /**
     * Calls the Gemini API with a token-optimized, summarized payload.
     * 
     * @param {string} apiKey - Gemini API Key provided by user
     * @param {Object} data - Summarized emissions data
     * @param {number} goal - Target goal in tCO2e/yr
     * @returns {Promise<string>} Custom AI generated advice
     */
    async getRemoteAdvice(apiKey, data, goal) {
        const { categories, total } = data;
        
        // Optimize payload: Only transmit summarized categories, total and goal
        const prompt = `You are an AI Sustainability Coach. Analyze this user's carbon footprint summary and write a concise, encouraging, personalized green action plan in markdown.
Inputs:
- Total Footprint: ${total} tonnes CO2e/year
- Target Goal: ${goal} tonnes CO2e/year
- Breakdown: Transport: ${categories.transport} t, Energy: ${categories.energy} t, Food: ${categories.food} t, Waste: ${categories.waste} t.

Rules:
1. Provide a brief analysis of where they stand relative to their goal.
2. Identify the single largest contributor.
3. Recommend 2 highly specific, realistic daily actions to reduce that contributor.
4. Keep the response to 3-4 sentences total (under 120 words). Do not output general introductory fluff or standard copy-paste tips. Format using markdown.`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 200
                    }
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API error: ${response.status} - ${errText}`);
            }

            const json = await response.json();
            const resultText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (!resultText) {
                throw new Error("Invalid response format from Gemini API");
            }
            
            return resultText.trim();
        } catch (error) {
            Logger.error("AI Coach API call failed:", error);
            throw error; // Let app handle fallback display
        }
    },

    /**
     * Escapes HTML special characters to prevent XSS.
     * Pure function that does not rely on browser DOM, ensuring testability in Node.js.
     *
     * @param {string} str - Raw string to escape
     * @returns {string} Escaped safe string
     */
    escapeHtml(str) {
        if (typeof str !== 'string') return String(str);
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    /**
     * Converts basic markdown formatting to safe HTML.
     * Sanitizes the input string first, then applies safe transformations.
     *
     * @param {string} markdown - Markdown text to format
     * @returns {string} Sanitized HTML string
     */
    formatAdviceMarkdown(markdown) {
        if (!markdown) return '';

        // First sanitize the raw string to prevent XSS
        let safe = this.escapeHtml(markdown);

        // Apply safe markdown transformations on escaped content
        safe = safe
            .replace(/### (.*)/g, '<div class="coach-heading"><strong>$1</strong></div>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '<br><br>');

        return safe;
    }
};

// Expose on window or export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AICoach;
} else {
    window.AICoach = AICoach;
}
