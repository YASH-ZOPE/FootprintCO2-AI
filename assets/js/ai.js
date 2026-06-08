/**
 * AI Sustainability Coach & Deep Analysis Layer
 * Manages personalized insights, token-optimized LLM calls, and smart caching.
 */

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
            if (val > maxVal) {
                maxVal = val;
                maxCategory = cat;
            }
        }

        const goalDiff = total - goal;
        let goalText = '';
        if (goalDiff <= 0) {
            goalText = `Congratulations! You are currently meeting your target carbon goal of **${goal} tonnes/year**. Keep up this fantastic effort!`;
        } else {
            goalText = `You are currently **${goalDiff.toFixed(1)} tonnes** above your annual goal of **${goal} tonnes**. Bridging this gap will require targeted actions.`;
        }

        const categoryAdvice = {
            transport: `Your transport footprint is your largest driver, making up **${percentages.transport}%** of your total. Reducing short car trips by walking, or choosing public transit can trim your footprint substantially.`,
            energy: `Household electricity accounts for **${percentages.energy}%** of your footprint. Setting your AC to 24°C (BEE guideline), switching to 5-star rated appliances, and exploring rooftop solar under PM Surya Ghar Yojana can reduce this substantially.`,
            food: `Diet choices are your primary driver at **${percentages.food}%** of your emissions. Swapping high-impact meats (like beef) for poultry or legumes, even a few days a week, will make a major dent.`,
            waste: `Your shopping and waste habits comprise **${percentages.waste}%** of your carbon footprint. Focusing on composting organic scraps and buying second-hand items first will optimize your impact.`
        };

        const advice = categoryAdvice[maxCategory] || categoryAdvice['transport'];
        
        return `### AI Sustainability Coach Recommendation\n\n${goalText}\n\n**Key Area for Improvement:** ${advice}\n\n*Tip:* Check out the Pledge Center to commit to specific actions and earn Eco-Points!`;
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

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

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
    }
};

// Expose on window or export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AICoach;
} else {
    window.AICoach = AICoach;
}
