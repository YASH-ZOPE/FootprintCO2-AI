/**
 * Carbon Calculator Engine
 * Handles client-side emissions calculations based on lifestyle factors.
 * Output values are in metric tonnes of CO2 equivalent per year (tCO2e/yr).
 */

const CalcEngine = {
    // Constant emission factors (derived from Indian CEA, standard automotive testing, and IPCC guidelines)
    FACTORS: {
        // Transport (per passenger km)
        GAS_CAR_PER_KM: 0.00020,         // 0.20 kg CO2e per km (average Indian petrol/diesel hatchback/sedan)
        EV_CAR_PER_KM: 0.00012,          // 0.12 kg CO2e per km (based on Indian grid mix carbon intensity)
        PUBLIC_TRANSIT_PER_KM: 0.00004,  // 0.04 kg CO2e per passenger km (heavily shared buses, local trains, metros)
        FLIGHT_PER_HOUR: 0.09,           // 90 kg CO2e per hour of flight

        // Energy
        ELECT_PER_KWH: 0.00082,          // 0.82 kg CO2e per kWh (official Indian Central Electricity Authority CEA grid factor)
        LPG_PER_CYLINDER: 0.0425,        // 42.5 kg CO2e per standard 14.2 kg domestic LPG cylinder

        // Food base annual emissions (tonnes CO2e/year)
        DIETS: {
            'meat-heavy': 2.8,
            'average': 2.0,
            'vegetarian': 1.4,
            'vegan': 1.0
        },

        // Waste base annual emissions (tonnes CO2e/year)
        SHOPPING: {
            'high': 2.5,
            'medium': 1.2,
            'low': 0.4
        }
    },

    // Standard scalar factors to prevent magic numbers in calculate()
    CONSTANTS: {
        WEEKS_PER_YEAR: 52,
        MONTHS_PER_YEAR: 12,
        LOCAL_FOOD_REDUCTION_FACTOR: 0.90,
        MAX_RECYCLING_REDUCTION_TONNES: 0.4,
        MIN_WASTE_FOOTPRINT_TONNES: 0.1
    },

    /**
     * Calculates emissions across all categories.
     * Inputs should be formatted with weekly/monthly metrics.
     * 
     * @param {Object} inputs 
     * @param {number} inputs.carKm - Weekly km driven in gasoline/diesel car
     * @param {number} inputs.evKm - Weekly km driven in EV car
     * @param {number} inputs.transitKm - Weekly km on public transit
     * @param {number} inputs.flightHours - Yearly flight hours
     * @param {number} inputs.electricityKwh - Monthly household electricity usage in units (kWh)
     * @param {number} inputs.solarPercent - Solar portion of household energy (0 - 100)
     * @param {number} inputs.lpgCylinders - Monthly LPG cylinders used
     * @param {number} inputs.householdSize - Number of occupants sharing energy bills
     * @param {string} inputs.dietType - 'meat-heavy', 'average', 'vegetarian', 'vegan'
     * @param {boolean} inputs.localFood - True if user buys mostly local/organic food
     * @param {string} inputs.shoppingHabit - 'high', 'medium', 'low'
     * @param {number} inputs.recyclePercent - Recycling rate percentage (0 - 100)
     * @returns {Object} Calculated metrics in tonnes/year
     */
    calculate(inputs) {
        // Default safe fallbacks
        const data = {
            carKm: Math.min(10000, Math.max(0, parseFloat(inputs.carKm) || 0)),
            evKm: Math.min(10000, Math.max(0, parseFloat(inputs.evKm) || 0)),
            transitKm: Math.min(10000, Math.max(0, parseFloat(inputs.transitKm) || 0)),
            flightHours: Math.min(1000, Math.max(0, parseFloat(inputs.flightHours) || 0)),
            electricityKwh: Math.min(100000, Math.max(0, parseFloat(inputs.electricityKwh) || 0)),
            solarPercent: Math.min(100, Math.max(0, parseFloat(inputs.solarPercent) || 0)),
            lpgCylinders: Math.min(100, Math.max(0, parseFloat(inputs.lpgCylinders) || 0)),
            householdSize: Math.min(100, Math.max(1, parseInt(inputs.householdSize) || 1)),
            dietType: inputs.dietType || 'average',
            localFood: !!inputs.localFood,
            shoppingHabit: inputs.shoppingHabit || 'medium',
            recyclePercent: Math.min(100, Math.max(0, parseFloat(inputs.recyclePercent) || 0))
        };

        // 1. Transportation (Annualized)
        // Weekly km * 52 weeks = annual km
        const carEmissions = data.carKm * this.CONSTANTS.WEEKS_PER_YEAR * this.FACTORS.GAS_CAR_PER_KM;
        const evEmissions = data.evKm * this.CONSTANTS.WEEKS_PER_YEAR * this.FACTORS.EV_CAR_PER_KM;
        const transitEmissions = data.transitKm * this.CONSTANTS.WEEKS_PER_YEAR * this.FACTORS.PUBLIC_TRANSIT_PER_KM;
        const flightEmissions = data.flightHours * this.FACTORS.FLIGHT_PER_HOUR;
        const transportTotal = carEmissions + evEmissions + transitEmissions + flightEmissions;

        // 2. Household Energy (Annualized, divided by household occupants)
        // Monthly * 12 months = annual
        const electricityBase = data.electricityKwh * this.CONSTANTS.MONTHS_PER_YEAR * this.FACTORS.ELECT_PER_KWH;
        const solarReduction = electricityBase * (data.solarPercent / 100);
        const electricityNet = Math.max(0, electricityBase - solarReduction);
        
        const gasEmissions = data.lpgCylinders * this.CONSTANTS.MONTHS_PER_YEAR * this.FACTORS.LPG_PER_CYLINDER;
        const energyTotal = (electricityNet + gasEmissions) / data.householdSize;

        // 3. Food
        let foodTotal = this.FACTORS.DIETS[data.dietType] || this.FACTORS.DIETS['average'];
        if (data.localFood) {
            foodTotal *= this.CONSTANTS.LOCAL_FOOD_REDUCTION_FACTOR; // 10% reduction for local/swadeshi organic foods
        }

        // 4. Waste & Consumption
        let wasteTotal = this.FACTORS.SHOPPING[data.shoppingHabit] || this.FACTORS.SHOPPING['medium'];
        // Recycling reduction: Max recycling (100%) reduces waste footprint by up to 0.4 tonnes CO2e/yr
        const recyclingReduction = (data.recyclePercent / 100) * this.CONSTANTS.MAX_RECYCLING_REDUCTION_TONNES;
        wasteTotal = Math.max(this.CONSTANTS.MIN_WASTE_FOOTPRINT_TONNES, wasteTotal - recyclingReduction);

        // Summation
        const total = transportTotal + energyTotal + foodTotal + wasteTotal;

        // Percentage breakdowns (handling potential zero total case gracefully)
        const transportPercent = total > 0 ? (transportTotal / total) * 100 : 0;
        const energyPercent = total > 0 ? (energyTotal / total) * 100 : 0;
        const foodPercent = total > 0 ? (foodTotal / total) * 100 : 0;
        const wastePercent = total > 0 ? (wasteTotal / total) * 100 : 0;

        return {
            categories: {
                transport: parseFloat(transportTotal.toFixed(2)),
                energy: parseFloat(energyTotal.toFixed(2)),
                food: parseFloat(foodTotal.toFixed(2)),
                waste: parseFloat(wasteTotal.toFixed(2))
            },
            percentages: {
                transport: parseFloat(transportPercent.toFixed(1)),
                energy: parseFloat(energyPercent.toFixed(1)),
                food: parseFloat(foodPercent.toFixed(1)),
                waste: parseFloat(wastePercent.toFixed(1))
            },
            total: parseFloat(total.toFixed(2)),
            inputs: data // return sanitized inputs
        };
    }
};

// Expose on window or export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CalcEngine;
} else {
    window.CalcEngine = CalcEngine;
}
