/**
 * Decision Engine
 * Implements logic rules to analyze category emission percentages
 * and prioritize categories requiring intervention.
 */

const DecisionEngine = {
    // Priority thresholds (percentages of total footprint)
    THRESHOLDS: {
        TRANSPORT: 40,
        ENERGY: 35,
        FOOD: 30,
        WASTE: 25
    },

    /**
     * Determines priority of emission categories based on thresholds
     * 
     * @param {Object} percentages - Category percentages { transport, energy, food, waste }
     * @returns {Array<string>} Prioritized list of category names
     */
    getPrioritizedCategories(percentages) {
        const flagged = [];
        
        // 1. Evaluate rules independently
        if (percentages.transport > this.THRESHOLDS.TRANSPORT) {
            flagged.push({ name: 'transport', percent: percentages.transport, threshold: this.THRESHOLDS.TRANSPORT });
        }
        if (percentages.energy > this.THRESHOLDS.ENERGY) {
            flagged.push({ name: 'energy', percent: percentages.energy, threshold: this.THRESHOLDS.ENERGY });
        }
        if (percentages.food > this.THRESHOLDS.FOOD) {
            flagged.push({ name: 'food', percent: percentages.food, threshold: this.THRESHOLDS.FOOD });
        }
        if (percentages.waste > this.THRESHOLDS.WASTE) {
            flagged.push({ name: 'waste', percent: percentages.waste, threshold: this.THRESHOLDS.WASTE });
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
