/**
 * Storage Layer — FootprintCO2 AI
 * Manages client-side persistence using HTML5 LocalStorage.
 * Handles state updates, historical logging, and AI recommendation caching.
 */

/**
 * Global Logger Utility to abstract console logging references
 */
const Logger = {
    error(msg, err) {
        console.error(`[FootprintCO2 AI Error]: ${msg}`, err || '');
    },
    warn(msg, extra) {
        console.warn(`[FootprintCO2 AI Warning]: ${msg}`, extra || '');
    },
    log(msg) {
        console.log(`[FootprintCO2 AI]: ${msg}`);
    }
};

if (typeof window !== 'undefined') {
    window.Logger = Logger;
} else if (typeof global !== 'undefined') {
    global.Logger = Logger;
}

const StorageLayer = {
    KEYS: {
        PROFILE:  'fpco2_profile',
        HISTORY:  'fpco2_emissions_history',
        PLEDGES:  'fpco2_active_pledges',
        AI_CACHE: 'fpco2_ai_insights'
    },

    // Default Profile
    DEFAULT_PROFILE: {
        name: 'Eco Explorer',
        country: 'IN',
        joinedDate: new Date().toISOString(),
        carbonGoal: 2.0, // target footprint in tCO2e/yr
        ecoPoints: 0,
        ecoTier: 'Eco-Novice'
    },

    // Constant parameters to prevent magic numbers
    TIER_LIMITS: {
        GUARDIAN: 1000,
        CHAMPION: 500,
        DEFENDER: 200
    },

    MAX_HISTORY_ENTRIES: 10,

    /**
     * Safely sets item in LocalStorage, trapping QuotaExceededError and trying to recover by clearing cache.
     */
    safeSetItem(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
                Logger.warn("LocalStorage quota exceeded! Attempting to free space by clearing AI insights cache.");
                try {
                    localStorage.removeItem(this.KEYS.AI_CACHE);
                    localStorage.setItem(key, value);
                } catch (retryError) {
                    Logger.error("LocalStorage write failed even after clearing AI insights cache.", retryError);
                }
            } else {
                Logger.error("Failed to write to LocalStorage due to unknown error:", e);
            }
        }
    },

    /**
     * Retrieves the user profile, initializing it if it doesn't exist.
     */
    getProfile() {
        let profile = localStorage.getItem(this.KEYS.PROFILE);
        if (!profile) {
            const fallback = { ...this.DEFAULT_PROFILE };
            this.setProfile(fallback);
            return fallback;
        }
        try {
            return JSON.parse(profile);
        } catch (e) {
            Logger.error("Failed to parse fpco2_profile, resetting", e);
            const fallback = { ...this.DEFAULT_PROFILE };
            this.setProfile(fallback);
            return fallback;
        }
    },

    /**
     * Sets user profile
     */
    setProfile(profile) {
        this.safeSetItem(this.KEYS.PROFILE, JSON.stringify(profile));
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
        if (points >= this.TIER_LIMITS.GUARDIAN) return 'Eco-Guardian';
        if (points >= this.TIER_LIMITS.CHAMPION) return 'Eco-Champion';
        if (points >= this.TIER_LIMITS.DEFENDER) return 'Eco-Defender';
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
            Logger.error("Failed to parse fpco2_emissions_history, resetting", e);
            this.safeSetItem(this.KEYS.HISTORY, JSON.stringify([]));
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

        // Limit size to max history entries constant
        if (history.length > this.MAX_HISTORY_ENTRIES) {
            history.shift();
        }

        this.safeSetItem(this.KEYS.HISTORY, JSON.stringify(history));
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
            Logger.error("Failed to parse fpco2_active_pledges, resetting", e);
            this.safeSetItem(this.KEYS.PLEDGES, JSON.stringify([]));
            return [];
        }
    },

    /**
     * Saves list of pledges
     */
    savePledges(pledges) {
        this.safeSetItem(this.KEYS.PLEDGES, JSON.stringify(pledges));
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
            Logger.error("Failed to parse fpco2_ai_insights, resetting", e);
            localStorage.removeItem(this.KEYS.AI_CACHE);
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
        this.safeSetItem(this.KEYS.AI_CACHE, JSON.stringify(cacheEntry));
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
