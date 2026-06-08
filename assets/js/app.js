/**
 * Main Application Controller
 * Handles UI state, interactive event bindings, calculation updates,
 * history chart generation, pledge interactions, and AI caching.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------
    // State Variables
    // ----------------------------------------------------
    let currentStep = 1;
    let geminiApiKey = localStorage.getItem('gemini_api_key') || '';
    let isCalculating = false;

    // ----------------------------------------------------
    // DOM Elements
    // ----------------------------------------------------
    // Onboarding Elements
    const onboardingModal = document.getElementById('onboardingModal');
    const onboardingForm = document.getElementById('onboardingForm');
    const onboardingSteps = document.querySelectorAll('.onboarding-step');
    const btnPrevStep = document.getElementById('btnPrevStep');
    const btnNextStep = document.getElementById('btnNextStep');

    // API Modal Elements
    const apiKeyModal = document.getElementById('apiKeyModal');
    const btnApiKeyConfig = document.getElementById('btnApiKeyConfig');
    const btnApiKeyCancel = document.getElementById('btnApiKeyCancel');
    const btnApiKeySave = document.getElementById('btnApiKeySave');
    const geminiApiKeyInput = document.getElementById('geminiApiKeyInput');

    // Dashboard Header Elements
    const welcomeUser = document.getElementById('welcomeUser');
    const userGoalDisplay = document.getElementById('userGoalDisplay');
    const navPointsDisplay = document.getElementById('navPointsDisplay');
    const navTierDisplay = document.getElementById('navTierDisplay');
    const valCurrentFootprint = document.getElementById('valCurrentFootprint');
    const valGoalFootprint = document.getElementById('valGoalFootprint');
    const valFootprintStatus = document.getElementById('valFootprintStatus');

    // Dashboard Sliders Elements
    const calcCarMiles = document.getElementById('calcCarMiles');
    const calcEvMiles = document.getElementById('calcEvMiles');
    const calcTransitMiles = document.getElementById('calcTransitMiles');
    const calcFlightHours = document.getElementById('calcFlightHours');
    const calcElectricity = document.getElementById('calcElectricity');
    const calcSolar = document.getElementById('calcSolar');
    const calcGas = document.getElementById('calcGas');
    const calcHousehold = document.getElementById('calcHousehold');
    const calcDietType = document.getElementById('calcDietType');
    const calcLocalFood = document.getElementById('calcLocalFood');
    const calcShopping = document.getElementById('calcShopping');
    const calcRecycle = document.getElementById('calcRecycle');

    // Category displays
    const barTransport = document.getElementById('barTransport');
    const barEnergy = document.getElementById('barEnergy');
    const barFood = document.getElementById('barFood');
    const barWaste = document.getElementById('barWaste');

    const labelTransportCo2 = document.getElementById('labelTransportCo2');
    const labelTransportPct = document.getElementById('labelTransportPct');
    const labelEnergyCo2 = document.getElementById('labelEnergyCo2');
    const labelEnergyPct = document.getElementById('labelEnergyPct');
    const labelFoodCo2 = document.getElementById('labelFoodCo2');
    const labelFoodPct = document.getElementById('labelFoodPct');
    const labelWasteCo2 = document.getElementById('labelWasteCo2');
    const labelWastePct = document.getElementById('labelWastePct');

    // Pledge/Recommendations
    const recommendationsContainer = document.getElementById('recommendationsContainer');

    // AI Coach
    const coachAdviceBox = document.getElementById('coachAdviceBox');
    const btnRequestAiDeep = document.getElementById('btnRequestAiDeep');
    const cacheStatusBadge = document.getElementById('cacheStatusBadge');

    // History & Reset
    const historyChartContainer = document.getElementById('historyChartContainer');
    const btnClearHistory = document.getElementById('btnClearHistory');

    // ----------------------------------------------------
    // Initialization Checks
    // ----------------------------------------------------
    function init() {
        bindSliderSync();
        bindEvents();

        const profile = StorageLayer.getProfile();
        const latest = StorageLayer.getLatestEmissions();

        if (!latest) {
            // First time user, show onboarding modal
            onboardingModal.classList.add('active');
            setupOnboardingSliders();
            updateStepView();
        } else {
            // Restore dashboard state from stored values
            welcomeUser.textContent = `Welcome Back, ${profile.name}`;
            userGoalDisplay.textContent = profile.carbonGoal.toFixed(1);
            valGoalFootprint.innerHTML = `${profile.carbonGoal.toFixed(1)} <span>t/yr</span>`;

            // Restore inputs into sandbox form
            restoreSandboxInputs(latest.inputs);

            // Recalculate and update displays
            updateDashboard();
        }
    }

    // ----------------------------------------------------
    // Onboarding Multi-step Wizard
    // ----------------------------------------------------
    function setupOnboardingSliders() {
        const onboardSliders = [
            { slider: 'onboardCarMiles', display: 'valOnboardCar' },
            { slider: 'onboardEvMiles', display: 'valOnboardEv' },
            { slider: 'onboardTransitMiles', display: 'valOnboardTransit' },
            { slider: 'onboardFlightHours', display: 'valOnboardFlight' },
            { slider: 'onboardElectricity', display: 'valOnboardElect' },
            { slider: 'onboardSolar', display: 'valOnboardSolar' },
            { slider: 'onboardGas', display: 'valOnboardGas' },
            { slider: 'onboardHousehold', display: 'valOnboardHouse' },
            { slider: 'onboardRecycle', display: 'valOnboardRecycle' }
        ];

        onboardSliders.forEach(pair => {
            const sliderEl = document.getElementById(pair.slider);
            const displayEl = document.getElementById(pair.display);
            if (sliderEl && displayEl) {
                sliderEl.addEventListener('input', () => {
                    displayEl.textContent = sliderEl.value;
                });
            }
        });
    }

    function updateStepView() {
        // Hide all steps, show active
        onboardingSteps.forEach((step, idx) => {
            if (idx + 1 === currentStep) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });

        // Update step indicators dots
        for (let i = 1; i <= 5; i++) {
            const dot = document.getElementById(`dot${i}`);
            if (dot) {
                if (i === currentStep) {
                    dot.classList.add('active');
                    dot.classList.remove('completed');
                } else if (i < currentStep) {
                    dot.classList.remove('active');
                    dot.classList.add('completed');
                } else {
                    dot.classList.remove('active');
                    dot.classList.remove('completed');
                }
            }
        }

        // Toggle back button disabled
        btnPrevStep.disabled = currentStep === 1;

        // Toggle continue button text
        if (currentStep === 5) {
            btnNextStep.textContent = "Finish & Calculate";
        } else {
            btnNextStep.textContent = "Continue";
        }
    }

    function processOnboardingSubmit() {
        // Collect Inputs
        const onboardInputs = {
            carKm: parseFloat(document.getElementById('onboardCarMiles').value),
            evKm: parseFloat(document.getElementById('onboardEvMiles').value),
            transitKm: parseFloat(document.getElementById('onboardTransitMiles').value),
            flightHours: parseFloat(document.getElementById('onboardFlightHours').value),
            electricityKwh: parseFloat(document.getElementById('onboardElectricity').value),
            solarPercent: parseFloat(document.getElementById('onboardSolar').value),
            lpgCylinders: parseFloat(document.getElementById('onboardGas').value),
            householdSize: parseInt(document.getElementById('onboardHousehold').value),
            dietType: document.getElementById('onboardDietType').value,
            localFood: document.getElementById('onboardLocalFood').checked,
            shoppingHabit: document.getElementById('onboardShopping').value,
            recyclePercent: parseFloat(document.getElementById('onboardRecycle').value)
        };

        const username = document.getElementById('onboardName').value.trim() || 'Eco Pioneer';
        const carbonGoal = parseFloat(document.getElementById('onboardGoal').value) || 2.0;

        // Calculate initial carbon values
        const results = CalcEngine.calculate(onboardInputs);

        // Update profile
        StorageLayer.updateProfile({
            name: username,
            carbonGoal: carbonGoal,
            ecoPoints: 50 // initial reward points for onboarding
        });

        // Save emissions entry
        StorageLayer.saveEmissionsEntry(results);

        // Copy onboarding settings to sandbox inputs
        restoreSandboxInputs(results.inputs);

        // Close onboarding modal
        onboardingModal.classList.remove('active');

        // Update layout
        updateDashboard();

        // Trigger initial Local AI advice
        triggerAICoach(results.total, true);
    }

    // ----------------------------------------------------
    // Sandbox Sliders Real-time Sync
    // ----------------------------------------------------
    function bindSliderSync() {
        const sliders = [
            { slider: calcCarMiles, display: document.getElementById('valCarMiles') },
            { slider: calcEvMiles, display: document.getElementById('valEvMiles') },
            { slider: calcTransitMiles, display: document.getElementById('valTransitMiles') },
            { slider: calcFlightHours, display: document.getElementById('valFlightHours') },
            { slider: calcElectricity, display: document.getElementById('valElectricity') },
            { slider: calcSolar, display: document.getElementById('valSolar') },
            { slider: calcGas, display: document.getElementById('valGas') },
            { slider: calcHousehold, display: document.getElementById('valHousehold') },
            { slider: calcRecycle, display: document.getElementById('valRecycle') }
        ];

        sliders.forEach(pair => {
            pair.slider.addEventListener('input', () => {
                pair.display.textContent = pair.slider.value;
                onSandboxChange();
            });
        });

        calcDietType.addEventListener('change', onSandboxChange);
        calcLocalFood.addEventListener('change', onSandboxChange);
        calcShopping.addEventListener('change', onSandboxChange);
    }

    function onSandboxChange() {
        if (isCalculating) return;
        isCalculating = true;

        // Throttle slightly to optimize rendering
        setTimeout(() => {
            const inputs = getSandboxInputs();
            const results = CalcEngine.calculate(inputs);

            // Save current state
            StorageLayer.saveEmissionsEntry(results);

            // Render updates
            updateDashboard();
            isCalculating = false;
        }, 80);
    }

    function getSandboxInputs() {
        return {
            carKm: parseFloat(calcCarMiles.value),
            evKm: parseFloat(calcEvMiles.value),
            transitKm: parseFloat(calcTransitMiles.value),
            flightHours: parseFloat(calcFlightHours.value),
            electricityKwh: parseFloat(calcElectricity.value),
            solarPercent: parseFloat(calcSolar.value),
            lpgCylinders: parseFloat(calcGas.value),
            householdSize: parseInt(calcHousehold.value),
            dietType: calcDietType.value,
            localFood: calcLocalFood.checked,
            shoppingHabit: calcShopping.value,
            recyclePercent: parseFloat(calcRecycle.value)
        };
    }

    function restoreSandboxInputs(inputs) {
        if (!inputs) return;

        calcCarMiles.value = inputs.carKm;
        document.getElementById('valCarMiles').textContent = inputs.carKm;

        calcEvMiles.value = inputs.evKm;
        document.getElementById('valEvMiles').textContent = inputs.evKm;

        calcTransitMiles.value = inputs.transitKm;
        document.getElementById('valTransitMiles').textContent = inputs.transitKm;

        calcFlightHours.value = inputs.flightHours;
        document.getElementById('valFlightHours').textContent = inputs.flightHours;

        calcElectricity.value = inputs.electricityKwh;
        document.getElementById('valElectricity').textContent = inputs.electricityKwh;

        calcSolar.value = inputs.solarPercent;
        document.getElementById('valSolar').textContent = inputs.solarPercent;

        calcGas.value = inputs.lpgCylinders;
        document.getElementById('valGas').textContent = inputs.lpgCylinders;

        calcHousehold.value = inputs.householdSize;
        document.getElementById('valHousehold').textContent = inputs.householdSize;

        calcDietType.value = inputs.dietType;
        calcLocalFood.checked = !!inputs.localFood;

        calcShopping.value = inputs.shoppingHabit;
        calcRecycle.value = inputs.recyclePercent;
        document.getElementById('valRecycle').textContent = inputs.recyclePercent;
    }

    // ----------------------------------------------------
    // Dashboard Rendering
    // ----------------------------------------------------
    function updateDashboard() {
        const profile = StorageLayer.getProfile();
        const latest = StorageLayer.getLatestEmissions();
        if (!latest) return;

        // Welcome & Header Metrics
        welcomeUser.textContent = `Welcome, ${profile.name}`;
        userGoalDisplay.textContent = profile.carbonGoal.toFixed(1);
        valCurrentFootprint.innerHTML = `${latest.total.toFixed(1)} <span>t/yr</span>`;
        valGoalFootprint.innerHTML = `${profile.carbonGoal.toFixed(1)} <span>t/yr</span>`;

        // Status indicator
        const diff = latest.total - profile.carbonGoal;
        if (diff <= 0) {
            valFootprintStatus.className = 'metric-value tier-eco-champion';
            valFootprintStatus.textContent = 'On Target ✅';
        } else {
            valFootprintStatus.className = 'metric-value';
            valFootprintStatus.style.color = 'var(--warning)';
            valFootprintStatus.textContent = 'Over Target ⚠️';
        }

        // Navigation Displays
        navPointsDisplay.textContent = profile.ecoPoints;
        navTierDisplay.className = `tier-text ${getTierClass(profile.ecoTier)}`;
        navTierDisplay.textContent = profile.ecoTier;

        // Progress bars and Breakdown Category Labels
        updateCategoryRow('Transport', latest.categories.transport, latest.percentages.transport, barTransport, labelTransportCo2, labelTransportPct);
        updateCategoryRow('Energy', latest.categories.energy, latest.percentages.energy, barEnergy, labelEnergyCo2, labelEnergyPct);
        updateCategoryRow('Food', latest.categories.food, latest.percentages.food, barFood, labelFoodCo2, labelFoodPct);
        updateCategoryRow('Waste', latest.categories.waste, latest.percentages.waste, barWaste, labelWasteCo2, labelWastePct);

        // Update recommendations list based on Decision Engine Prioritization
        updateRecommendations(latest.percentages);

        // Update SVG History Chart
        updateHistoryChart();

        // Perform checks for AI Caching System
        checkAICacheStatus(latest.total);
    }

    function updateCategoryRow(name, co2, pct, barEl, co2El, pctEl) {
        co2El.textContent = co2.toFixed(1);
        pctEl.textContent = Math.round(pct);
        barEl.style.width = `${pct}%`;
    }

    function getTierClass(tier) {
        if (tier === 'Eco-Guardian') return 'tier-eco-guardian';
        if (tier === 'Eco-Champion') return 'tier-eco-champion';
        if (tier === 'Eco-Defender') return 'tier-eco-defender';
        return 'tier-eco-novice';
    }

    // ----------------------------------------------------
    // Decision Engine & Recommendations
    // ----------------------------------------------------
    function updateRecommendations(percentages) {
        // 1. Ask Decision Engine for priority order
        const prioritizedCategories = DecisionEngine.getPrioritizedCategories(percentages);

        // 2. Extract completed active pledges
        const activePledges = StorageLayer.getPledges();
        const excludedPledgeIds = activePledges
            .filter(p => p.status === 'active' || p.status === 'completed')
            .map(p => p.pledgeId);

        // 3. Extract recommendations from recommendation engine
        const topRecommendations = RecommendationEngine.getRecommendations(prioritizedCategories, excludedPledgeIds);

        // 4. Render recommendations
        recommendationsContainer.innerHTML = '';

        if (topRecommendations.length === 0) {
            recommendationsContainer.innerHTML = `
                <div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.9rem;">
                    🌱 All recommended pledges active or completed! Keep up the amazing work!
                </div>`;
            return;
        }

        topRecommendations.forEach(rec => {
            const card = document.createElement('div');
            card.className = 'pledge-card';
            card.innerHTML = `
                <div class="pledge-info">
                    <span class="pledge-category ${rec.category}">${rec.category}</span>
                    <h3 class="pledge-title" style="margin-top:0.35rem;">${rec.title}</h3>
                    <p style="font-size:0.8rem; color:var(--text-muted); margin:0.25rem 0 0.5rem 0;">${rec.description}</p>
                    <span class="pledge-impact">
                        📉 Saves ~<b>${rec.co2Reduction.toFixed(1)}</b> t/yr &bull; 🪙 +<b>${rec.points}</b> pts &bull; ⚡ Ease: <b>${rec.easeOfAdoption}</b>
                    </span>
                </div>
                <button class="pledge-action-btn" data-id="${rec.id}">Commit</button>
            `;

            // Listen to Commit actions
            card.querySelector('.pledge-action-btn').addEventListener('click', () => {
                commitPledge(rec);
            });

            recommendationsContainer.appendChild(card);
        });
    }

    function commitPledge(pledge) {
        // Save as active in storage
        StorageLayer.togglePledge(pledge.id, 'active');

        // Give visual confirmation
        updateRecommendationsDisplayList();
    }

    function updateRecommendationsDisplayList() {
        // Re-render recommendations section AND updates profile displays
        const latest = StorageLayer.getLatestEmissions();
        if (latest) {
            updateRecommendations(latest.percentages);
            renderHistoryAndPledgesSection();
        }
    }

    function renderHistoryAndPledgesSection() {
        // Redraw lists if any changes in points or actions
        const profile = StorageLayer.getProfile();
        navPointsDisplay.textContent = profile.ecoPoints;
    }

    // ----------------------------------------------------
    // History & Custom Charts Renderer
    // ----------------------------------------------------
    function updateHistoryChart() {
        const history = StorageLayer.getHistory();
        historyChartContainer.innerHTML = '';

        if (history.length === 0) {
            historyChartContainer.innerHTML = `
                <div style="width:100%; display:flex; align-items:center; justify-content:center; color:var(--text-muted); font-size:0.85rem; height:100px;">
                    No logs available. Use sliders to record footprints.
                </div>`;
            return;
        }

        // Find max footprint size for scaling
        let maxCo2 = 1.0;
        history.forEach(h => {
            if (h.total > maxCo2) maxCo2 = h.total;
        });

        // Inject dynamic columns
        history.forEach(h => {
            const barWrapper = document.createElement('div');
            barWrapper.className = 'chart-bar-wrapper';

            // Format short date (e.g., Jun 8)
            const dateObj = new Date(h.date);
            const shortDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

            // Percent height relative to maximum
            const percentHeight = Math.max(8, (h.total / maxCo2) * 85); // base height + relative scale

            barWrapper.innerHTML = `
                <div class="chart-bar-fill" style="height: ${percentHeight}%;">
                    <div class="chart-bar-tooltip">${h.total.toFixed(1)} tonnes</div>
                </div>
                <div class="chart-label">${shortDate}</div>
            `;

            historyChartContainer.appendChild(barWrapper);
        });
    }

    // ----------------------------------------------------
    // AI Caching & Integration
    // ----------------------------------------------------
    function checkAICacheStatus(currentTotal) {
        const cache = StorageLayer.getAICache();

        if (!cache) {
            cacheStatusBadge.textContent = "Uncached";
            cacheStatusBadge.style.color = "var(--warning)";
            return;
        }

        const needsRefresh = AICoach.shouldRefresh(currentTotal, cache);
        if (needsRefresh) {
            cacheStatusBadge.textContent = "Outdated advice";
            cacheStatusBadge.style.color = "var(--danger)";
        } else {
            cacheStatusBadge.textContent = "Cached";
            cacheStatusBadge.style.color = "var(--primary-light)";

            // Display cached advice
            coachAdviceBox.innerHTML = formatAdviceMarkdown(cache.insights);
        }
    }

    async function triggerAICoach(currentTotal, forceRefresh = false) {
        const cache = StorageLayer.getAICache();
        const needsRefresh = forceRefresh || AICoach.shouldRefresh(currentTotal, cache);
        const profile = StorageLayer.getProfile();
        const latest = StorageLayer.getLatestEmissions();

        if (!needsRefresh && cache) {
            coachAdviceBox.innerHTML = formatAdviceMarkdown(cache.insights);
            cacheStatusBadge.textContent = "Cached";
            cacheStatusBadge.style.color = "var(--primary-light)";
            return;
        }

        // Render Local fallback advice immediately
        const localAdvice = AICoach.generateLocalInsight(latest, profile.carbonGoal);

        if (!geminiApiKey) {
            // Save local advice to cache as default
            StorageLayer.setAICache(localAdvice, currentTotal);
            coachAdviceBox.innerHTML = formatAdviceMarkdown(localAdvice);
            cacheStatusBadge.textContent = "Local Sync";
            cacheStatusBadge.style.color = "var(--text-muted)";
            return;
        }

        // Remote AI Coach Call: loading states
        coachAdviceBox.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.5rem; justify-content:center; height:60px;">
                <span class="spinner"></span> Generating AI advice...
            </div>
        `;
        cacheStatusBadge.textContent = "Syncing...";
        cacheStatusBadge.style.color = "var(--warning)";

        try {
            // Low-token structured payload call
            const aiAdvice = await AICoach.getRemoteAdvice(geminiApiKey, latest, profile.carbonGoal);

            // Cache results
            StorageLayer.setAICache(aiAdvice, currentTotal);
            coachAdviceBox.innerHTML = formatAdviceMarkdown(aiAdvice);
            cacheStatusBadge.textContent = "Gemini Sync";
            cacheStatusBadge.style.color = "var(--accent)";
        } catch (err) {
            console.error("Gemini API request failed, loading local advice", err);

            // Graceful fallback to Local templates
            StorageLayer.setAICache(localAdvice, currentTotal);
            coachAdviceBox.innerHTML = formatAdviceMarkdown(localAdvice);
            cacheStatusBadge.textContent = "Offline Fallback";
            cacheStatusBadge.style.color = "var(--danger)";
        }
    }

    // Helper to format basic markdown to HTML safely
    function formatAdviceMarkdown(markdown) {
        if (!markdown) return '';
        return markdown
            .replace(/### (.*)/g, '<h3 style="margin-bottom:0.5rem;">$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '<br><br>');
    }

    // ----------------------------------------------------
    // Event Bindings
    // ----------------------------------------------------
    function bindEvents() {
        // Logo reset navigation
        document.getElementById('navLogo').addEventListener('click', () => {
            const profile = StorageLayer.getProfile();
            alert(`FootprintCO2 active profile: ${profile.name} (Tiers: ${profile.ecoTier})`);
        });

        // Onboarding flow buttons
        btnPrevStep.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                updateStepView();
            }
        });

        btnNextStep.addEventListener('click', () => {
            if (currentStep < 5) {
                currentStep++;
                updateStepView();
            } else {
                // Step 5: Process finish
                processOnboardingSubmit();
            }
        });

        // AI Advice Deep Analysis trigger
        btnRequestAiDeep.addEventListener('click', () => {
            const latest = StorageLayer.getLatestEmissions();
            if (!latest) return;

            if (!geminiApiKey) {
                // Open key configuration modal
                apiKeyModal.classList.add('active');
                geminiApiKeyInput.value = '';
            } else {
                // Force sync advice
                triggerAICoach(latest.total, true);
            }
        });

        // API Key Settings Modal
        btnApiKeyConfig.addEventListener('click', () => {
            apiKeyModal.classList.add('active');
            geminiApiKeyInput.value = geminiApiKey;
        });

        btnApiKeyCancel.addEventListener('click', () => {
            apiKeyModal.classList.remove('active');
        });

        btnApiKeySave.addEventListener('click', () => {
            geminiApiKey = geminiApiKeyInput.value.trim();
            if (geminiApiKey) {
                localStorage.setItem('gemini_api_key', geminiApiKey);
            } else {
                localStorage.removeItem('gemini_api_key');
            }
            apiKeyModal.classList.remove('active');

            // Recalculate AI advice
            const latest = StorageLayer.getLatestEmissions();
            if (latest) {
                triggerAICoach(latest.total, true);
            }
        });

        // History reset
        btnClearHistory.addEventListener('click', () => {
            if (confirm("Are you sure you want to clear your carbon history and profile? FootprintCO2 will reload.")) {
                StorageLayer.clearAll();
                localStorage.removeItem('gemini_api_key');
                window.location.reload();
            }
        });
    }

    // Initialize layout
    init();
});
