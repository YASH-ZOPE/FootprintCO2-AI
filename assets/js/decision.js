/**
 * Decision Engine
 * Implements logic rules to analyze category emission percentages
 * and prioritize categories requiring intervention.
 */

const DecisionEngine = {
    /**
     * Determines priority of emission categories based on thresholds:
     * - Transport > 40%
     * - Energy > 35%
     * - Food > 30%
     * - Waste > 25%
     * 
     * @param {Object} percentages - Category percentages { transport, energy, food, waste }
     * @returns {Array<string>} Prioritized list of category names
     */
    getPrioritizedCategories(percentages) {
        const flagged = [];
        
        // 1. Evaluate rules independently
        if (percentages.transport > 40) {
            flagged.push({ name: 'transport', percent: percentages.transport, threshold: 40 });
        }
        if (percentages.energy > 35) {
            flagged.push({ name: 'energy', percent: percentages.energy, threshold: 35 });
        }
        if (percentages.food > 30) {
            flagged.push({ name: 'food', percent: percentages.food, threshold: 30 });
        }
        if (percentages.waste > 25) {
            flagged.push({ name: 'waste', percent: percentages.waste, threshold: 25 });
        }

        // 2. Sort flagged categories by their percentage contribution descending
        // so the actual largest driver gets top priority.
        flagged.sort((a, b) => b.percent - a.percent);
        
        const prioritized = flagged.map(f => f.name);
        
        // 3. Append non-flagged categories at the end, sorted by percentage contribution,
        // ensuring all categories are represented in order of footprint size.
        const allCategories = ['transport', 'energy', 'food', 'waste'];
        const remaining = allCategories
            .filter(cat => !prioritized.includes(cat))
            .map(cat => ({ name: cat, percent: percentages[cat] || 0 }))
            .sort((a, b) => b.percent - a.percent)
            .map(r => r.name);

        return [...prioritized, ...remaining];
    }
};

// Expose on window or export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DecisionEngine;
} else {
    window.DecisionEngine = DecisionEngine;
}
