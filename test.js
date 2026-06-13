/**
 * Automated Unit Test Suite for FOOTPRINTCO2 Core Engines
 * Runs natively in Node.js using assert.
 */

"use strict";

const assert = require('assert');

// ----------------------------------------------------
// LocalStorage Mock for Node.js Context
// ----------------------------------------------------
const mockLocalStorage = {
    store: {},
    getItem(key) {
        return this.store[key] || null;
    },
    setItem(key, value) {
        // Trigger simulated QuotaExceededError on special payload
        if (value && value.includes("TRIGGER_QUOTA_EXCEEDED")) {
            throw { name: 'QuotaExceededError', code: 22 };
        }
        this.store[key] = String(value);
    },
    removeItem(key) {
        delete this.store[key];
    },
    clear() {
        this.store = {};
    }
};

global.localStorage = mockLocalStorage;

// Load modules (Ensure StorageLayer is loaded first to register global Logger wrapper)
const StorageLayer = require('./assets/js/storage.js');
const CalcEngine = require('./assets/js/calc.js');
const DecisionEngine = require('./assets/js/decision.js');
const RecommendationEngine = require('./assets/js/recommendation.js');
const AICoach = require('./assets/js/ai.js');

console.log("==========================================");
console.log("   RUNNING FOOTPRINTCO2 AI ENGINE TESTS  ");
console.log("==========================================\n");

let passedTestsCount = 0;
let failedTests = [];

function runTest(testName, testFn) {
    try {
        testFn();
        console.log(`✅ Passed: ${testName}`);
        passedTestsCount++;
    } catch (error) {
        console.error(`❌ Failed: ${testName}`);
        console.error(`   ${error.message || error}`);
        failedTests.push({ name: testName, error });
    }
}

// Reset mock store before each storage test
function resetLocalStorage() {
    mockLocalStorage.clear();
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

runTest("CalcEngine clamps negative inputs and out-of-bounds percentages", () => {
    const inputs = {
        carKm: -500, // should clamp to 0
        evKm: 0,
        transitKm: 0,
        flightHours: 0,
        electricityKwh: 200,
        solarPercent: 150, // should clamp to 100
        lpgCylinders: -2,  // should clamp to 0
        householdSize: 2,
        dietType: 'vegan',
        localFood: false,
        shoppingHabit: 'low',
        recyclePercent: -20 // should clamp to 0
    };

    const results = CalcEngine.calculate(inputs);

    // Car must clamp to 0
    assert.strictEqual(results.categories.transport, 0);
    
    // Solar percent 150 clamps to 100, electricityBase = 200 * 12 * 0.00082 = 1.968.
    // 100% solar reduction reduces base to 0. LPG clamps to 0. Total Energy should be 0.
    assert.strictEqual(results.categories.energy, 0);

    // Recycle clamps to 0. Waste low = 0.4. Reduction = 0. Total waste = 0.40.
    assert.strictEqual(results.categories.waste, 0.40);
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

// ----------------------------------------------------
// 5. Storage Integrity & Corruption Tests
// ----------------------------------------------------
runTest("StorageLayer recovers and auto-resets corrupted profile keys", () => {
    resetLocalStorage();
    
    // Inject corrupted profile data
    mockLocalStorage.setItem(StorageLayer.KEYS.PROFILE, "{invalid json profile data");

    // Attempting to read profile should catch parsing error, reset key to default structure, and succeed
    const profile = StorageLayer.getProfile();
    assert.strictEqual(profile.name, "Eco Explorer");
    assert.strictEqual(profile.carbonGoal, 2.0);
    assert.strictEqual(profile.ecoPoints, 0);

    // Verify key in LocalStorage was repaired
    const repairedRaw = mockLocalStorage.getItem(StorageLayer.KEYS.PROFILE);
    assert.ok(repairedRaw.includes('"name":"Eco Explorer"'), "Profile key should be successfully repaired in storage");
    // Ensure the key uses the namespaced prefix
    assert.strictEqual(StorageLayer.KEYS.PROFILE, 'fpco2_profile', 'Profile key must use fpco2_ namespace');
    assert.strictEqual(StorageLayer.KEYS.HISTORY,  'fpco2_emissions_history', 'History key must use fpco2_ namespace');
    assert.strictEqual(StorageLayer.KEYS.PLEDGES,  'fpco2_active_pledges', 'Pledges key must use fpco2_ namespace');
    assert.strictEqual(StorageLayer.KEYS.AI_CACHE, 'fpco2_ai_insights', 'AI cache key must use fpco2_ namespace');
});

runTest("StorageLayer handles QuotaExceededExceptions by dropping AI cache", () => {
    resetLocalStorage();

    // Cache some AI advice in storage
    StorageLayer.setAICache("Important AI Advice", 5.2);
    assert.ok(mockLocalStorage.getItem(StorageLayer.KEYS.AI_CACHE), "Cache should initially exist");

    // Attempt to write an entry simulating quota limits
    StorageLayer.safeSetItem(StorageLayer.KEYS.HISTORY, "TRIGGER_QUOTA_EXCEEDED");

    // The handler should have cleared the cache to recover space
    assert.strictEqual(mockLocalStorage.getItem(StorageLayer.KEYS.AI_CACHE), null, "Cache key should be deleted to clean up space");
});

runTest("Engine configurations and threshold constants are correctly structured", () => {
    assert.strictEqual(CalcEngine.CONSTANTS.WEEKS_PER_YEAR, 52);
    assert.strictEqual(CalcEngine.CONSTANTS.MONTHS_PER_YEAR, 12);
    assert.strictEqual(DecisionEngine.THRESHOLDS.TRANSPORT, 40);
    assert.strictEqual(RecommendationEngine.MAX_RECOMMENDATIONS, 3);
    assert.strictEqual(StorageLayer.MAX_HISTORY_ENTRIES, 10);
    // Verify GEMINI_MODEL constant is exported and correctly set
    const aiModule = require('./assets/js/ai.js');
    // AICoach itself doesn't expose GEMINI_MODEL, but the module-level constant drives getRemoteAdvice.
    // Verify the model string is embedded in the getRemoteAdvice source to catch accidental mutations.
    const srcStr = AICoach.getRemoteAdvice.toString();
    assert.ok(srcStr.includes('GEMINI_MODEL'), 'getRemoteAdvice must reference the GEMINI_MODEL constant');
});


// -------------------------------------------------------
// New Test 10: formatAdviceMarkdown XSS Safety
// -------------------------------------------------------
runTest("formatAdviceMarkdown neutralizes XSS payloads and preserves valid markdown", () => {
    ["<script>alert(1)</script>", "<img src=x onerror=alert(1)>"].forEach(p => {
        const o = AICoach.formatAdviceMarkdown(p);
        assert.ok(!o.includes("<script"), "script tag must be escaped");
        assert.ok(o.includes("&lt;"), "raw < bracket must be escaped in output");
    });
    const o = AICoach.formatAdviceMarkdown("### Title\n\n**bold** *italic*");
    assert.ok(o.includes("coach-heading"), "coach-heading class must render");
    assert.ok(o.includes("<strong>Title</strong>"), "heading content must be nested in strong tags");
    assert.ok(o.includes("<strong>bold</strong>"), "strong must render");
    assert.ok(o.includes("<em>italic</em>"),     "em must render");
});

// -------------------------------------------------------
// New Test 11: History cap enforcement
// -------------------------------------------------------
runTest("StorageLayer enforces MAX_HISTORY_ENTRIES cap", () => {
    resetLocalStorage();
    const inp = { carKm:100, evKm:0, transitKm:20, flightHours:2, electricityKwh:200,
        solarPercent:10, lpgCylinders:2, householdSize:3, dietType:"average",
        localFood:false, shoppingHabit:"medium", recyclePercent:30 };
    for (let i = 0; i < 13; i++) StorageLayer.saveEmissionsEntry(CalcEngine.calculate(inp));
    const h = StorageLayer.getHistory();
    assert.ok(h.length <= StorageLayer.MAX_HISTORY_ENTRIES,
        "History must be capped at " + StorageLayer.MAX_HISTORY_ENTRIES + ", got " + h.length);
});

// -------------------------------------------------------
// New Test 12: Pledge lifecycle
// -------------------------------------------------------
runTest("StorageLayer togglePledge correctly sets pledge status to active", () => {
    resetLocalStorage();
    StorageLayer.togglePledge("p_led_bulbs", "active");
    const pledges = StorageLayer.getPledges();
    const pledge = pledges.find(p => p.pledgeId === "p_led_bulbs");
    assert.ok(pledge,                           "Pledge must exist after toggle");
    assert.strictEqual(pledge.status, "active", "Pledge status must be active");
    assert.ok(pledge.startDate,                 "Pledge must carry a startDate timestamp");
});

// -------------------------------------------------------
// New Test 13: AICoach output quality across all 4 categories
// -------------------------------------------------------
runTest("AICoach.generateLocalInsight gives Indian-context data-driven output for all 4 categories", () => {
    const cases = [
        { cat:"transport", data:{total:8,categories:{transport:5,energy:1.5,food:1,waste:0.5},percentages:{transport:62,energy:19,food:12,waste:7}},  keyword:"Metro"  },
        { cat:"energy",    data:{total:6,categories:{transport:0.5,energy:4,food:1,waste:0.5},percentages:{transport:8,energy:67,food:17,waste:8}},   keyword:"BEE"    },
        { cat:"food",      data:{total:4.5,categories:{transport:0.5,energy:0.8,food:2.8,waste:0.4},percentages:{transport:11,energy:18,food:62,waste:9}}, keyword:"mandi"  },
        { cat:"waste",     data:{total:5.5,categories:{transport:0.5,energy:0.8,food:0.8,waste:3.4},percentages:{transport:9,energy:15,food:15,waste:61}},keyword:"Swachh" },
    ];
    cases.forEach(function(c) {
        const out = AICoach.generateLocalInsight(c.data, 2.0);
        assert.ok(out.length > 100,               c.cat + ": output must be substantive");
        assert.ok(/\d+\.\d+ t/.test(out),        c.cat + ": must have concrete tonne savings");
        assert.ok(out.includes(c.keyword),        c.cat + ": must include " + c.keyword);
        assert.ok(out.includes("goal") || out.includes("target"), c.cat + ": must mention goal");
    });
});
// -------------------------------------------------------
// New Test 14: Adversarial, NaN, and Out-of-bounds Inputs Clamping
// -------------------------------------------------------
runTest("CalcEngine safely handles NaN, undefined, negative values, and Infinity values without crashing", () => {
    const inputs = {
        carKm: NaN,
        evKm: undefined,
        transitKm: -50,
        flightHours: Infinity,
        electricityKwh: 200,
        solarPercent: 120, // should clamp to 100
        lpgCylinders: NaN,
        householdSize: -2,  // should clamp to minimum 1
        dietType: 'unknown_diet_type',
        localFood: false,
        shoppingHabit: 'very_bad_freq',
        recyclePercent: -30 // should clamp to 0
    };
    const results = CalcEngine.calculate(inputs);
    
    assert.ok(results.total >= 0, "Carbon total should remain a valid non-negative number");
    assert.ok(!isNaN(results.total), "Total must not be NaN");
    assert.strictEqual(results.categories.transport, 90.0, "Transport emissions should clamp Infinity flightHours to 1000 hrs (1000 * 0.09 = 90.0) and other negative/NaN inputs to 0");
    assert.strictEqual(results.categories.waste, 1.20, "Waste should fall back to medium levels and ignore negative recycling rate");
    assert.ok(results.categories.energy >= 0, "Energy emissions should be valid and clamp inputs to safe limits");
});

// -------------------------------------------------------
// New Test 15: Eco Tier Point Brackets Boundaries
// -------------------------------------------------------
runTest("StorageLayer.calculateTier maps point boundaries to correct Eco Tiers", () => {
    assert.strictEqual(StorageLayer.calculateTier(0), 'Eco-Novice');
    assert.strictEqual(StorageLayer.calculateTier(199), 'Eco-Novice');
    assert.strictEqual(StorageLayer.calculateTier(200), 'Eco-Defender');
    assert.strictEqual(StorageLayer.calculateTier(499), 'Eco-Defender');
    assert.strictEqual(StorageLayer.calculateTier(500), 'Eco-Champion');
    assert.strictEqual(StorageLayer.calculateTier(999), 'Eco-Champion');
    assert.strictEqual(StorageLayer.calculateTier(1000), 'Eco-Guardian');
    assert.strictEqual(StorageLayer.calculateTier(5000), 'Eco-Guardian');
});

// -------------------------------------------------------
// New Test 16: Profile Updates and Tier Transitions
// -------------------------------------------------------
runTest("StorageLayer.updateProfile updates points and correctly transitions tiers", () => {
    resetLocalStorage();
    const p1 = StorageLayer.getProfile();
    assert.strictEqual(p1.ecoTier, 'Eco-Novice');

    // Update points to trigger Defender tier
    StorageLayer.updateProfile({ ecoPoints: 300 });
    const p2 = StorageLayer.getProfile();
    assert.strictEqual(p2.ecoPoints, 300);
    assert.strictEqual(p2.ecoTier, 'Eco-Defender');

    // Update points to trigger Guardian tier
    StorageLayer.updateProfile({ ecoPoints: 1200 });
    const p3 = StorageLayer.getProfile();
    assert.strictEqual(p3.ecoTier, 'Eco-Guardian');
});

// -------------------------------------------------------
// New Test 17: CalcEngine Household Size Clamping Boundaries
// -------------------------------------------------------
runTest("CalcEngine clamps household sizes and divisions work properly", () => {
    const baselineInputs = {
        carKm: 0, evKm: 0, transitKm: 0, flightHours: 0,
        electricityKwh: 100, solarPercent: 0, lpgCylinders: 0, // energyBase = 100 * 12 * 0.00082 = 0.984 t
        dietType: 'vegan', localFood: true, shoppingHabit: 'low', recyclePercent: 100
    };

    // Case A: Size 0 (clamps to minimum 1)
    const res0 = CalcEngine.calculate({ ...baselineInputs, householdSize: 0 });
    assert.strictEqual(res0.inputs.householdSize, 1);
    assert.strictEqual(res0.categories.energy, 0.98);

    // Case B: Size 2 (divides energy by 2)
    const res2 = CalcEngine.calculate({ ...baselineInputs, householdSize: 2 });
    assert.strictEqual(res2.inputs.householdSize, 2);
    // 0.984 / 2 = 0.492 -> 0.49
    assert.strictEqual(res2.categories.energy, 0.49);

    // Case C: Extreme size 150 (clamps to maximum 100)
    const res150 = CalcEngine.calculate({ ...baselineInputs, householdSize: 150 });
    assert.strictEqual(res150.inputs.householdSize, 100);
    // 0.984 / 100 = 0.00984 -> 0.01
    assert.strictEqual(res150.categories.energy, 0.01);
});

// -------------------------------------------------------
// New Test 18: DecisionEngine Equal Percentage Prioritization
// -------------------------------------------------------
runTest("DecisionEngine prioritization yields consistent ranking when categories have equal contributions", () => {
    // Categories have exact equal contributions of 25% each
    const equalPercentages = { transport: 25.0, energy: 25.0, food: 25.0, waste: 25.0 };
    const order = DecisionEngine.getPrioritizedCategories(equalPercentages);
    
    // Total order must contain all 4 categories and resolve without omissions
    assert.strictEqual(order.length, 4);
    assert.ok(order.includes('transport'));
    assert.ok(order.includes('energy'));
    assert.ok(order.includes('food'));
    assert.ok(order.includes('waste'));
});

// -------------------------------------------------------
// New Test 19: StorageLayer Emissions Logging Date Update Clashing
// -------------------------------------------------------
runTest("StorageLayer.saveEmissionsEntry replaces today's existing log instead of appending a new entry", () => {
    resetLocalStorage();
    const mockEntry1 = { total: 4.5, categories: { transport: 1.0, energy: 1.0, food: 1.0, waste: 1.5 }, percentages: {}, inputs: {} };
    const mockEntry2 = { total: 5.2, categories: { transport: 1.5, energy: 1.0, food: 1.0, waste: 1.7 }, percentages: {}, inputs: {} };

    StorageLayer.saveEmissionsEntry(mockEntry1);
    const h1 = StorageLayer.getHistory();
    assert.strictEqual(h1.length, 1);
    assert.strictEqual(h1[0].total, 4.5);

    // Saving another entry on the same calendar day updates/replaces today's entry
    StorageLayer.saveEmissionsEntry(mockEntry2);
    const h2 = StorageLayer.getHistory();
    assert.strictEqual(h2.length, 1);
    assert.strictEqual(h2[0].total, 5.2);
});

// -------------------------------------------------------
// New Test 20: E2E Integration Flow (Lifecycle simulation)
// -------------------------------------------------------
runTest("E2E Lifecycle Integration: Onboarding -> Emissions -> Prioritisation -> Pledging -> Tier Change", () => {
    resetLocalStorage();

    // 1. Onboarding Phase
    const initialInputs = {
        carKm: 150, evKm: 0, transitKm: 50, flightHours: 5,
        electricityKwh: 200, solarPercent: 0, lpgCylinders: 1, householdSize: 2,
        dietType: 'average', localFood: false, shoppingHabit: 'medium', recyclePercent: 50
    };
    
    // Process calculation
    const initialResults = CalcEngine.calculate(initialInputs);
    assert.strictEqual(initialResults.categories.transport, 2.11);
    
    // Save user profile details mimicking onboarding submit
    StorageLayer.updateProfile({
        name: "Test User",
        carbonGoal: 2.0,
        ecoPoints: 50
    });
    
    // Confirm profile creation
    const profile = StorageLayer.getProfile();
    assert.strictEqual(profile.name, "Test User");
    assert.strictEqual(profile.ecoPoints, 50);
    assert.strictEqual(profile.ecoTier, "Eco-Novice");

    // Save initial logs
    StorageLayer.saveEmissionsEntry(initialResults);
    const history = StorageLayer.getHistory();
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].total, initialResults.total);

    // 2. Decision Phase (Check priorities)
    const prioritized = DecisionEngine.getPrioritizedCategories(initialResults.percentages);
    // Food is prioritized first because it exceeds the 30% threshold (34.8% > 30%)
    assert.strictEqual(prioritized[0], 'food');

    // 3. Recommendation Phase (Commit to action)
    const recs = RecommendationEngine.getRecommendations(prioritized, []);
    assert.strictEqual(recs.length, 3);
    const targetPledge = recs.find(r => r.category === 'food');
    assert.ok(targetPledge, "Should have a food pledge available");

    // Commit to the pledge
    StorageLayer.togglePledge(targetPledge.id, 'active');
    const pledges = StorageLayer.getPledges();
    const activePledge = pledges.find(p => p.pledgeId === targetPledge.id);
    assert.ok(activePledge);
    assert.strictEqual(activePledge.status, 'active');

    // 4. Achievement Tier Phase
    // Complete pledge, reward user points and verify tier change
    StorageLayer.togglePledge(targetPledge.id, 'completed');
    StorageLayer.updateProfile({
        ecoPoints: profile.ecoPoints + targetPledge.points
    });

    const updatedProfile = StorageLayer.getProfile();
    assert.strictEqual(updatedProfile.ecoPoints, 50 + targetPledge.points);
    
    // Add multiple points to transition tier to Champion
    StorageLayer.updateProfile({
        ecoPoints: updatedProfile.ecoPoints + 500
    });
    const finalProfile = StorageLayer.getProfile();
    assert.ok(finalProfile.ecoPoints >= 600);
    assert.strictEqual(finalProfile.ecoTier, 'Eco-Champion'); // >= 500 points
});

console.log("\n==========================================");
if (failedTests.length > 0) {
    console.error(`💥 ${failedTests.length} TEST(S) FAILED:`);
    failedTests.forEach(f => console.error(`   • ${f.name}`));
    console.log("==========================================\n");
    process.exit(1);
} else {
    console.log(`🎉 ALL ${passedTestsCount} TESTS COMPLETED SUCCESSFULLY!`);
    console.log("==========================================\n");
}
