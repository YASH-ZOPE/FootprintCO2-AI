/**
 * Recommendation Engine
 * Manages the database of sustainable actions (Pledges)
 * and ranks them based on Decision Engine priorities.
 */

const RecommendationEngine = {
    // Constant parameters to prevent magic numbers
    MAX_RECOMMENDATIONS: 3,

    // Database of pre-defined realistic actions
    DB: [
        // Transport Recommendations
        {
            id: 'p_bike_short',
            category: 'transport',
            title: 'Walk or Cycle Short Trips',
            description: 'Replace car/scooter trips under 2 km with walking or cycling. Saves fuel and cuts emission.',
            co2Reduction: 0.5, // tCO2e/yr
            points: 50,
            easeOfAdoption: 'easy'
        },
        {
            id: 'p_transit_weekly',
            category: 'transport',
            title: 'Weekly Metro/Bus Commute',
            description: 'Swap your personal vehicle ride for Metro or local bus transit just one day a week.',
            co2Reduction: 0.8,
            points: 80,
            easeOfAdoption: 'easy'
        },
        {
            id: 'p_carpool_share',
            category: 'transport',
            title: 'Carpool with Colleagues',
            description: 'Share your office commute or rides with colleagues to cut fuel costs and emissions.',
            co2Reduction: 1.1,
            points: 120,
            easeOfAdoption: 'medium'
        },
        {
            id: 'p_flight_limit',
            category: 'transport',
            title: 'Optimize Regional Travel',
            description: 'Choose train travel (like Vande Bharat) instead of regional flights whenever feasible.',
            co2Reduction: 0.6,
            points: 100,
            easeOfAdoption: 'medium'
        },

        // Energy Recommendations
        {
            id: 'p_led_bulbs',
            category: 'energy',
            title: 'Upgrade to BEE 5-Star LEDs',
            description: 'Replace traditional lights with energy-efficient 5-star rated LED bulbs in all rooms.',
            co2Reduction: 0.3,
            points: 40,
            easeOfAdoption: 'easy'
        },
        {
            id: 'p_thermostat_adjust',
            category: 'energy',
            title: 'Set AC Temperature to 24°C',
            description: 'Follow BEE guidelines: set your air conditioner to 24°C instead of 18°C. Saves ~6% power per degree.',
            co2Reduction: 0.5,
            points: 60,
            easeOfAdoption: 'easy'
        },
        {
            id: 'p_unplug_vampire',
            category: 'energy',
            title: 'Turn Off Appliance Switches',
            description: 'Always switch off wall plugs for chargers, TVs, and microwave units to stop standby power draw.',
            co2Reduction: 0.2,
            points: 30,
            easeOfAdoption: 'easy'
        },
        {
            id: 'p_green_tariff',
            category: 'energy',
            title: 'Adopt Rooftop Solar',
            description: 'Enroll in solar initiatives (like PM Surya Ghar Yojana) to produce renewable energy locally.',
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

        // 3. Return the top recommendations based on limit constant
        return available.slice(0, this.MAX_RECOMMENDATIONS);
    }
};

// Expose on window or export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecommendationEngine;
} else {
    window.RecommendationEngine = RecommendationEngine;
}
