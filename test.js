/**
 * Automated Unit Test Suite for FOOTPRINTCO2 Core Engines
 * Runs natively in Node.js using assert.
 */

const assert = require('assert');

// Load modules
const CalcEngine = require('./assets/js/calc.js');
const DecisionEngine = require('./assets/js/decision.js');
const RecommendationEngine = require('./assets/js/recommendation.js');
const AICoach = require('./assets/js/ai.js');

console.log("==========================================");
console.log("   RUNNING FOOTPRINTCO2 AI ENGINE TESTS  ");
console.log("==========================================\n");

let passedTestsCount = 0;
function runTest(testName, testFn) {
    try {
        testFn();
        console.log(`✅ Passed: ${testName}`);
        passedTestsCount++;
    } catch (error) {
        console.error(`❌ Failed: ${testName}`);
        console.error(error);
        process.exit(1);
    }
}

// ----------------------------------------------------
// 1. Carbon Calculator Engine Tests
// ----------------------------------------------------
runTest("CalcEngine basic calculations with Indian standard inputs", () => {
    const inputs = {
        carKm: 150,
        evKm: 0,
        transitKm: 50,
        flightHours: 5,
        electricityKwh: 200,
        solarPercent: 0,
        lpgCylinders: 1,
        householdSize: 2,
        dietType: 'average',
        localFood: false,
        shoppingHabit: 'medium',
        recyclePercent: 50
    };

    const results = CalcEngine.calculate(inputs);

    // Assert overall properties
    assert.ok(results.total > 0, "Total carbon footprint should be greater than zero");
    assert.strictEqual(typeof results.total, 'number', "Total footprint should be a number");
    assert.ok(results.categories.transport >= 0, "Transport carbon should be >= 0");
    assert.ok(results.categories.energy >= 0, "Energy carbon should be >= 0");
    assert.ok(results.categories.food >= 0, "Food carbon should be >= 0");
    assert.ok(results.categories.waste >= 0, "Waste carbon should be >= 0");

    // Math verification (Indian factors):
    // Car = 150 * 52 * 0.00020 = 1.56 tonnes
    // Transit = 50 * 52 * 0.00004 = 0.104 tonnes
    // Flight = 5 * 0.09 = 0.45 tonnes
    // Transport Total = 1.56 + 0.104 + 0.45 = 2.114 -> ~2.11 tonnes
    assert.strictEqual(results.categories.transport, 2.11);

    // Electricity = 200 * 12 * 0.00082 = 1.968 tonnes
    // LPG = 1 * 12 * 0.0425 = 0.51 tonnes
    // Share = (1.968 + 0.51) / 2 = 1.239 tonnes -> ~1.24 tonnes
    assert.strictEqual(results.categories.energy, 1.24);
});

runTest("CalcEngine handles zero value boundary checks correctly", () => {
    const inputs = {
        carKm: 0, evKm: 0, transitKm: 0, flightHours: 0,
        electricityKwh: 0, solarPercent: 0, lpgCylinders: 0, householdSize: 4,
        dietType: 'vegan', localFood: true, shoppingHabit: 'low', recyclePercent: 100
    };
    const results = CalcEngine.calculate(inputs);

    // Diet: Vegan baseline = 1.0. Local organic reduces by 10% = 0.90 tonnes.
    assert.strictEqual(results.categories.food, 0.90);
    // Waste: Low shopping baseline = 0.4. Recycling 100% reduces by 0.4 = 0.0 tonnes (bounded to min 0.1)
    assert.strictEqual(results.categories.waste, 0.10);

    assert.strictEqual(results.categories.transport, 0);
    assert.strictEqual(results.categories.energy, 0);
    assert.strictEqual(results.total, 1.0); // 0.90 food + 0.10 waste
});

// ----------------------------------------------------
// 2. Decision Engine Priority Rule Tests
// ----------------------------------------------------
runTest("DecisionEngine prioritization rules work correctly", () => {
    // Case A: Transport dominates (percentages: transport=50%, energy=20%, food=20%, waste=10%)
    const p1 = { transport: 50, energy: 20, food: 20, waste: 10 };
    const priority1 = DecisionEngine.getPrioritizedCategories(p1);
    
    // Transport dominates (> 40% threshold check matches)
    assert.strictEqual(priority1[0], 'transport', "Transport should be ranked first");

    // Case B: Food dominates (percentages: transport=10%, energy=10%, food=60%, waste=20%)
    const p2 = { transport: 10, energy: 10, food: 60, waste: 20 };
    const priority2 = DecisionEngine.getPrioritizedCategories(p2);
    
    // Food is highest (> 30% threshold matches)
    assert.strictEqual(priority2[0], 'food', "Food should be ranked first");
});

// ----------------------------------------------------
// 3. Recommendation Selection Engine Tests
// ----------------------------------------------------
runTest("RecommendationEngine filters active pledges and respects Decision priorities", () => {
    const prioritized = ['food', 'transport', 'energy', 'waste'];
    
    // Get recommendations with no exclusions
    const recs1 = RecommendationEngine.getRecommendations(prioritized, []);
    assert.strictEqual(recs1.length, 3, "Should return exactly top 3 recommendations");
    // The top recommendation should belong to 'food' category because food is prioritized first.
    assert.strictEqual(recs1[0].category, 'food');

    // Exclude the top food pledge
    const topFoodId = recs1[0].id;
    const recs2 = RecommendationEngine.getRecommendations(prioritized, [topFoodId]);
    assert.strictEqual(recs2.length, 3);
    // Should not include the excluded ID
    assert.ok(recs2.every(r => r.id !== topFoodId), "Should exclude the active food pledge");
});

// ----------------------------------------------------
// 4. AI Coach Cache Threshold Tests
// ----------------------------------------------------
runTest("AICoach cache validation logic enforces 15% delta rules", () => {
    const cached = {
        lastCalculatedFootprint: 10.0,
        insights: "Some green advice"
    };

    // 10% increase (11.0 tonnes) -> should NOT refresh (under 15%)
    const refresh1 = AICoach.shouldRefresh(11.0, cached);
    assert.strictEqual(refresh1, false, "Should not refresh cache on 10% footprint delta");

    // 20% decrease (8.0 tonnes) -> should refresh (above 15%)
    const refresh2 = AICoach.shouldRefresh(8.0, cached);
    assert.strictEqual(refresh2, true, "Should refresh cache on 20% footprint delta");
});

console.log("\n==========================================");
console.log(`🎉 ALL ${passedTestsCount} TESTS COMPLETED SUCCESSFULLY!`);
console.log("==========================================\n");
