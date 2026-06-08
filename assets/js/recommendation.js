/**
 * Recommendation Engine
 * Manages the database of sustainable actions (Pledges)
 * and ranks them based on Decision Engine priorities.
 */

const RecommendationEngine = {
    // Database of pre-defined realistic actions
    DB: [
        // Transport Recommendations
        {
            id: 'p_bike_short',
            category: 'transport',
            title: 'Walk or Cycle Short Trips',
            description: 'Replace car trips under 2 miles with walking or biking. Saves fuel and promotes health.',
            co2Reduction: 0.5, // tCO2e/yr
            points: 50,
            easeOfAdoption: 'easy'
        },
        {
            id: 'p_transit_weekly',
            category: 'transport',
            title: 'Weekly Public Transit Commute',
            description: 'Swap your car commute for bus or train transit just one day a week.',
            co2Reduction: 0.8,
            points: 80,
            easeOfAdoption: 'easy'
        },
        {
            id: 'p_carpool_share',
            category: 'transport',
            title: 'Carpool with Coworkers',
            description: 'Share your daily commute with at least one other person to cut transit footprints in half.',
            co2Reduction: 1.1,
            points: 120,
            easeOfAdoption: 'medium'
        },
        {
            id: 'p_flight_limit',
            category: 'transport',
            title: 'Replace One Short Flight',
            description: 'Choose train travel or virtual meetings instead of taking a regional flight.',
            co2Reduction: 0.6,
            points: 100,
            easeOfAdoption: 'medium'
        },

        // Energy Recommendations
        {
            id: 'p_led_bulbs',
            category: 'energy',
            title: 'Upgrade to LED Bulbs',
            description: 'Replace standard incandescent bulbs with energy-efficient LEDs throughout your home.',
            co2Reduction: 0.3,
            points: 40,
            easeOfAdoption: 'easy'
        },
        {
            id: 'p_thermostat_adjust',
            category: 'energy',
            title: 'Optimize Thermostat Settings',
            description: 'Lower heating by 2°F in winter or raise AC by 2°F in summer to slash energy loads.',
            co2Reduction: 0.5,
            points: 60,
            easeOfAdoption: 'easy'
        },
        {
            id: 'p_unplug_vampire',
            category: 'energy',
            title: 'Banish Vampire Energy Draw',
            description: 'Unplug chargers, electronics, and appliances when not in use or use smart power strips.',
            co2Reduction: 0.2,
            points: 30,
            easeOfAdoption: 'easy'
        },
        {
            id: 'p_green_tariff',
            category: 'energy',
            title: 'Switch to Green Energy Tariffs',
            description: 'Enroll in your utility provider\'s 100% renewable/solar energy program.',
            co2Reduction: 1.8,
            points: 200,
            easeOfAdoption: 'medium'
        },

        // Food Recommendations
        {
            id: 'p_meatless_monday',
            category: 'food',
            title: 'Adopt Meatless Mondays',
            description: 'Skip meat for just one day a week, substituting beans, lentils, or vegetables.',
            co2Reduction: 0.4,
            points: 50,
            easeOfAdoption: 'easy'
        },
        {
            id: 'p_food_waste_zero',
            category: 'food',
            title: 'Minimize Household Food Waste',
            description: 'Plan meals, store food properly, and eat leftovers to prevent organic waste emissions.',
            co2Reduction: 0.3,
            points: 40,
            easeOfAdoption: 'easy'
        },
        {
            id: 'p_local_seasonal',
            category: 'food',
            title: 'Eat Local & Seasonal Produce',
            description: 'Buy groceries from farmers markets or choose local produce to save transport energy.',
            co2Reduction: 0.2,
            points: 40,
            easeOfAdoption: 'easy'
        },
        {
            id: 'p_plant_based_diet',
            category: 'food',
            title: 'Transition to Plant-Based Eating',
            description: 'Adopt a vegetarian or vegan diet to remove high-intensity livestock emissions.',
            co2Reduction: 1.3,
            points: 180,
            easeOfAdoption: 'hard'
        },

        // Waste & Consumption Recommendations
        {
            id: 'p_recycle_strict',
            category: 'waste',
            title: 'Strict Sorting & Recycling',
            description: 'Consistently sort glass, metal, paper, and clean plastics for your local recycle collection.',
            co2Reduction: 0.3,
            points: 40,
            easeOfAdoption: 'easy'
        },
        {
            id: 'p_compost_organic',
            category: 'waste',
            title: 'Compost Organic Scraps',
            description: 'Keep food waste and garden trimmings out of landfills by starting a backyard or curbside compost.',
            co2Reduction: 0.4,
            points: 60,
            easeOfAdoption: 'easy'
        },
        {
            id: 'p_thrift_first',
            category: 'waste',
            title: 'Shop Second-Hand First',
            description: 'Purchase clothes, books, and furniture second-hand instead of buying brand new items.',
            co2Reduction: 0.7,
            points: 90,
            easeOfAdoption: 'medium'
        },
        {
            id: 'p_no_single_use',
            category: 'waste',
            title: 'Eliminate Single-Use Plastics',
            description: 'Switch to reusable water bottles, shopping bags, and container storage.',
            co2Reduction: 0.2,
            points: 45,
            easeOfAdoption: 'easy'
        }
    ],

    /**
     * Recommends the top 3 actions based on prioritized categories
     * and filters out currently active/completed actions.
     * 
     * @param {Array<string>} prioritizedCategories - Ordered list of categories from Decision Engine
     * @param {Array<string>} excludedPledgeIds - Pledge IDs that are already completed or active
     * @returns {Array<Object>} List of top 3 recommended actions
     */
    getRecommendations(prioritizedCategories, excludedPledgeIds = []) {
        // 1. Filter out already pledged or active actions
        const available = this.DB.filter(rec => !excludedPledgeIds.includes(rec.id));
        
        // 2. Score and sort available actions
        // Sort order rules:
        // - Priority based on index in prioritizedCategories (lower index = higher priority)
        // - Secondary based on co2Reduction (highest reduction = higher priority)
        available.sort((a, b) => {
            const indexA = prioritizedCategories.indexOf(a.category);
            const indexB = prioritizedCategories.indexOf(b.category);
            
            // If they are in different categories, sort by category priority
            if (indexA !== indexB) {
                return indexA - indexB;
            }
            
            // If in same category, sort by co2 reduction descending
            return b.co2Reduction - a.co2Reduction;
        });

        // 3. Return the top 3 recommendations
        return available.slice(0, 3);
    }
};

// Expose on window or export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecommendationEngine;
} else {
    window.RecommendationEngine = RecommendationEngine;
}
