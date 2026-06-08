/**
 * Storage Layer
 * Manages client-side persistence using HTML5 LocalStorage.
 * Handles state updates, historical logging, and AI recommendation caching.
 */

const StorageLayer = {
    KEYS: {
        PROFILE: 'eco_profile',
        HISTORY: 'eco_emissions_history',
        PLEDGES: 'eco_active_pledges',
        AI_CACHE: 'eco_ai_insights'
    },

    // Default Profile
    DEFAULT_PROFILE: {
        name: 'Eco Explorer',
        country: 'US',
        joinedDate: new Date().toISOString(),
        carbonGoal: 2.0, // target footprint in tCO2e/yr
        ecoPoints: 0,
        ecoTier: 'Eco-Novice'
    },

    /**
     * Retrieves the user profile, initializing it if it doesn't exist.
     */
    getProfile() {
        let profile = localStorage.getItem(this.KEYS.PROFILE);
        if (!profile) {
            profile = { ...this.DEFAULT_PROFILE };
            this.setProfile(profile);
            return profile;
        }
        try {
            return JSON.parse(profile);
        } catch (e) {
            console.error("Failed to parse eco_profile, resetting", e);
            return { ...this.DEFAULT_PROFILE };
        }
    },

    /**
     * Sets user profile
     */
    setProfile(profile) {
        localStorage.setItem(this.KEYS.PROFILE, JSON.stringify(profile));
    },

    /**
     * Updates profile values partially and adjusts eco tier based on points
     */
    updateProfile(updates) {
        const profile = this.getProfile();
        const updated = { ...profile, ...updates };
        
        // Recalculate tier based on Eco-Points
        updated.ecoTier = this.calculateTier(updated.ecoPoints);
        
        this.setProfile(updated);
        return updated;
    },

    /**
     * Determines the eco tier title based on point brackets
     */
    calculateTier(points) {
        if (points >= 1000) return 'Eco-Guardian';
        if (points >= 500) return 'Eco-Champion';
        if (points >= 200) return 'Eco-Defender';
        return 'Eco-Novice';
    },

    /**
     * Retrieves all historical emission logs.
     */
    getHistory() {
        const history = localStorage.getItem(this.KEYS.HISTORY);
        if (!history) return [];
        try {
            return JSON.parse(history);
        } catch (e) {
            console.error("Failed to parse eco_emissions_history", e);
            return [];
        }
    },

    /**
     * Saves a new calculation record to emissions history.
     * Keeps only the latest 10 items to prevent bloat and keep LocalStorage clean.
     */
    saveEmissionsEntry(entry) {
        const history = this.getHistory();
        
        // entry format: { date: 'YYYY-MM-DD', categories: {...}, percentages: {...}, total: 8.3, inputs: {...} }
        // Ensure we don't have multiple entries for the exact same date
        const todayStr = new Date().toISOString().split('T')[0];
        const existingIdx = history.findIndex(h => h.date === todayStr);
        
        const newEntry = {
            date: todayStr,
            categories: entry.categories,
            percentages: entry.percentages,
            total: entry.total,
            inputs: entry.inputs
        };

        if (existingIdx >= 0) {
            history[existingIdx] = newEntry; // update today's log
        } else {
            history.push(newEntry);
        }

        // Limit size to 10 latest records
        if (history.length > 10) {
            history.shift();
        }

        localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(history));
    },

    /**
     * Retrieves the latest entry from history
     */
    getLatestEmissions() {
        const history = this.getHistory();
        if (history.length === 0) return null;
        return history[history.length - 1];
    },

    /**
     * Gets user-pledged habits and tasks state
     */
    getPledges() {
        const pledges = localStorage.getItem(this.KEYS.PLEDGES);
        if (!pledges) return [];
        try {
            return JSON.parse(pledges);
        } catch (e) {
            console.error("Failed to parse eco_active_pledges", e);
            return [];
        }
    },

    /**
     * Saves list of pledges
     */
    savePledges(pledges) {
        localStorage.setItem(this.KEYS.PLEDGES, JSON.stringify(pledges));
    },

    /**
     * Adds or updates a pledge
     */
    togglePledge(pledgeId, status) {
        const pledges = this.getPledges();
        const idx = pledges.findIndex(p => p.pledgeId === pledgeId);
        
        if (idx >= 0) {
            pledges[idx].status = status;
            if (status === 'completed') {
                pledges[idx].lastCompleted = new Date().toISOString();
                pledges[idx].completions = (pledges[idx].completions || 0) + 1;
            }
        } else {
            pledges.push({
                pledgeId,
                startDate: new Date().toISOString(),
                completions: status === 'completed' ? 1 : 0,
                lastCompleted: status === 'completed' ? new Date().toISOString() : null,
                status: status
            });
        }
        
        this.savePledges(pledges);
    },

    /**
     * Gets cached AI Insights
     */
    getAICache() {
        const cache = localStorage.getItem(this.KEYS.AI_CACHE);
        if (!cache) return null;
        try {
            return JSON.parse(cache);
        } catch (e) {
            console.error("Failed to parse eco_ai_insights", e);
            return null;
        }
    },

    /**
     * Caches new AI insights
     */
    setAICache(insights, totalFootprint) {
        const cacheEntry = {
            lastCalculatedFootprint: totalFootprint,
            timestamp: new Date().toISOString(),
            insights: insights
        };
        localStorage.setItem(this.KEYS.AI_CACHE, JSON.stringify(cacheEntry));
    },

    /**
     * Resets all storage
     */
    clearAll() {
        localStorage.removeItem(this.KEYS.PROFILE);
        localStorage.removeItem(this.KEYS.HISTORY);
        localStorage.removeItem(this.KEYS.PLEDGES);
        localStorage.removeItem(this.KEYS.AI_CACHE);
    }
};

// Expose on window or export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageLayer;
} else {
    window.StorageLayer = StorageLayer;
}
