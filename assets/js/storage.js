/**
 * Storage Layer — FootprintCO2 AI
 * Manages client-side persistence using HTML5 LocalStorage.
 * Handles state updates, historical logging, and AI recommendation caching.
 */

"use strict";

/**
 * Global Logger Utility to abstract console logging references
 */
const Logger = {
    /**
     * Logs error messages.
     *
     * @param {string} msg - Message to log
     * @param {any} [err] - Error object or details
     * @returns {void}
     */
    error(msg, err) {
        console.error(`[FootprintCO2 AI Error]: ${msg}`, err || '');
    },
    /**
     * Logs warning messages.
     *
     * @param {string} msg - Message to log
     * @param {any} [extra] - Extra details
     * @returns {void}
     */
    warn(msg, extra) {
        console.warn(`[FootprintCO2 AI Warning]: ${msg}`, extra || '');
    },
    /**
     * Logs general messages.
     *
     * @param {string} msg - Message to log
     * @returns {void}
     */
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
    KEYS: Object.freeze({
        PROFILE:  'fpco2_profile',
        HISTORY:  'fpco2_emissions_history',
        PLEDGES:  'fpco2_active_pledges',
        AI_CACHE: 'fpco2_ai_insights'
    }),

    /**
     * Creates a fresh default profile with the current timestamp.
     * Using a factory function ensures `joinedDate` reflects the actual
     * account creation time, not the module parse time.
     *
     * @returns {Object} Default profile object
     */
    createDefaultProfile() {
        return {
            name: 'Eco Explorer',
            country: 'IN',
            joinedDate: new Date().toISOString(),
            carbonGoal: 2.0, // target footprint in tCO2e/yr
            ecoPoints: 0,
            ecoTier: 'Eco-Novice'
        };
    },

    // Constant parameters to prevent magic numbers
    TIER_LIMITS: Object.freeze({
        GUARDIAN: 1000,
        CHAMPION: 500,
        DEFENDER: 200
    }),

    MAX_HISTORY_ENTRIES: 10,

    /**
     * Safely sets item in LocalStorage, trapping QuotaExceededError and trying to recover by clearing cache.
     *
     * @param {string} key - LocalStorage key string
     * @param {string} value - Stringified JSON or value to write
     * @returns {void}
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
     *
     * @returns {Object} User profile object
     */
    getProfile() {
        let profile = localStorage.getItem(this.KEYS.PROFILE);
        if (!profile) {
            const fallback = this.createDefaultProfile();
            this.setProfile(fallback);
            return fallback;
        }
        try {
            return JSON.parse(profile);
        } catch (e) {
            Logger.error(`Failed to parse ${this.KEYS.PROFILE}, resetting`, e);
            const fallback = this.createDefaultProfile();
            this.setProfile(fallback);
            return fallback;
        }
    },

    /**
     * Sets user profile in LocalStorage.
     *
     * @param {Object} profile - User profile object to persist
     * @returns {void}
     */
    setProfile(profile) {
        this.safeSetItem(this.KEYS.PROFILE, JSON.stringify(profile));
    },

    /**
     * Updates profile values partially and adjusts eco tier based on points.
     *
     * @param {Object} updates - Partially updated fields for the user profile
     * @returns {Object} The updated user profile object
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
     * Determines the eco tier title based on point brackets.
     *
     * @param {number} points - Total Eco-Points of the user
     * @returns {string} The appropriate Eco-Tier title string
     */
    calculateTier(points) {
        if (points >= this.TIER_LIMITS.GUARDIAN) return 'Eco-Guardian';
        if (points >= this.TIER_LIMITS.CHAMPION) return 'Eco-Champion';
        if (points >= this.TIER_LIMITS.DEFENDER) return 'Eco-Defender';
        return 'Eco-Novice';
    },

    /**
     * Retrieves all historical emission logs from storage.
     *
     * @returns {Array<Object>} List of historical emissions entry logs
     */
    getHistory() {
        const history = localStorage.getItem(this.KEYS.HISTORY);
        if (!history) return [];
        try {
            return JSON.parse(history);
        } catch (e) {
            Logger.error(`Failed to parse ${this.KEYS.HISTORY}, resetting`, e);
            this.safeSetItem(this.KEYS.HISTORY, JSON.stringify([]));
            return [];
        }
    },

    /**
     * Saves a new calculation record to emissions history.
     * Keeps only the latest 10 items to prevent bloat and keep LocalStorage clean.
     *
     * @param {Object} entry - Emissions result object from CalcEngine
     * @returns {void}
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
     * Retrieves the latest emissions calculations log from history.
     *
     * @returns {Object|null} The most recent emissions record or null if empty
     */
    getLatestEmissions() {
        const history = this.getHistory();
        if (history.length === 0) return null;
        return history[history.length - 1];
    },

    /**
     * Gets user-pledged habits and tasks state from LocalStorage.
     *
     * @returns {Array<Object>} List of pledged action records
     */
    getPledges() {
        const pledges = localStorage.getItem(this.KEYS.PLEDGES);
        if (!pledges) return [];
        try {
            return JSON.parse(pledges);
        } catch (e) {
            Logger.error(`Failed to parse ${this.KEYS.PLEDGES}, resetting`, e);
            this.safeSetItem(this.KEYS.PLEDGES, JSON.stringify([]));
            return [];
        }
    },

    /**
     * Saves list of pledges to LocalStorage.
     *
     * @param {Array<Object>} pledges - Complete list of active/completed pledge records
     * @returns {void}
     */
    savePledges(pledges) {
        this.safeSetItem(this.KEYS.PLEDGES, JSON.stringify(pledges));
    },

    /**
     * Adds or updates a pledge status in LocalStorage.
     *
     * @param {string} pledgeId - The unique ID of the target pledge
     * @param {string} status - The new status of the pledge ('active' or 'completed')
     * @returns {void}
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
     * Gets cached AI Insights from LocalStorage.
     *
     * @returns {Object|null} Cached AI advice entry or null if missing or expired
     */
    getAICache() {
        const cache = localStorage.getItem(this.KEYS.AI_CACHE);
        if (!cache) return null;
        try {
            return JSON.parse(cache);
        } catch (e) {
            Logger.error(`Failed to parse ${this.KEYS.AI_CACHE}, resetting`, e);
            localStorage.removeItem(this.KEYS.AI_CACHE);
            return null;
        }
    },

    /**
     * Caches new AI insights results in LocalStorage.
     *
     * @param {string} insights - The generated AI coach recommendation text
     * @param {number} totalFootprint - Emissions total related to this advice
     * @returns {void}
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
     * Resets all application keys in LocalStorage.
     *
     * @returns {void}
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
