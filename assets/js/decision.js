/**
 * Decision Engine
 * Implements logic rules to analyze category emission percentages
 * and prioritize categories requiring intervention.
 */

"use strict";

const DecisionEngine = {
    // Priority thresholds (percentages of total footprint)
    THRESHOLDS: Object.freeze({
        TRANSPORT: 40,
        ENERGY: 35,
        FOOD: 30,
        WASTE: 25
    }),

    /**
     * Determines priority of emission categories based on thresholds
     * 
     * @param {Object} percentages - Category percentages { transport, energy, food, waste }
     * @returns {Array<string>} Prioritized list of category names
     */
    getPrioritizedCategories(percentages) {
        const flagged = [];

        // Data-driven evaluation: iterate threshold rules so adding a new category
        // to THRESHOLDS automatically includes it — no manual if-block duplication.
        for (const [key, threshold] of Object.entries(this.THRESHOLDS)) {
            const categoryName = key.toLowerCase();
            const percent = percentages[categoryName] || 0;
            if (percent > threshold) {
                flagged.push({ name: categoryName, percent, threshold });
            }
        }

        // Sort flagged categories by their percentage contribution descending
        // so the actual largest driver gets top priority.
        flagged.sort((a, b) => b.percent - a.percent);

        const prioritized = flagged.map(f => f.name);

        // Append non-flagged categories at the end, sorted by percentage contribution,
        // ensuring all categories are represented in order of footprint size.
        const allCategories = Object.keys(this.THRESHOLDS).map(k => k.toLowerCase());
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
