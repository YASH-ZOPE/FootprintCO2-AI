/**
 * Main Application Controller — FootprintCO2 AI
 * Implements MVC design: AppState represents single source of truth,
 * debounced slider updates minimize visual recalculation lag,
 * event delegation limits listener overhead, sessionStorage keeps API keys ephemeral,
 * and ModalManager enforces WCAG focus trapping.
 *
 * @module AppController
 */

document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------
    // Constants
    // ----------------------------------------------------
    /** Debounce delay for slider input events (ms) to reduce draw cost */
    const SANDBOX_DEBOUNCE_MS = 50;

    /** Initial eco-points awarded upon completing onboarding */
    const ONBOARDING_REWARD_POINTS = 50;

    /** Total number of onboarding wizard steps */
    const TOTAL_ONBOARDING_STEPS = 5;

    /** Minimum bar height percentage in history chart for visibility */
    const CHART_MIN_HEIGHT_PERCENT = 8;

    /** Scale factor for history chart bar heights (relative to max) */
    const CHART_SCALE_FACTOR = 85;

    /** Default carbon goal if user leaves field empty */
    const DEFAULT_CARBON_GOAL = 2.0;

    // ----------------------------------------------------
    // Application State Store (Single Source of Truth)
    // ----------------------------------------------------
    const AppState = {
        profile: null,
        latestEmissions: null,
        history: [],
        pledges: [],
        geminiApiKey: '',   // In-memory ONLY — never persisted to storage
        currentStep: 1,
        isCalculating: false,

        // Rendering caching hashes to prevent layout recalculations
        lastRenderedRecommendationsHash: '',
        lastRenderedHistoryLength: 0
    };

    // ----------------------------------------------------
    // DOM Elements
    // ----------------------------------------------------
    // Onboarding Elements
    const onboardingModal = document.getElementById('onboardingModal');
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

    // Toast notification helper (replaces alert())
    const toastEl = (() => {
        const el = document.createElement('div');
        el.id = 'appToast';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.style.cssText = [
            'position:fixed', 'bottom:1.5rem', 'left:50%',
            'transform:translateX(-50%) translateY(20px)',
            'background:var(--bg-surface)', 'border:1px solid var(--border-color)',
            'color:var(--text-primary)', 'padding:0.65rem 1.25rem',
            'border-radius:10px', 'font-size:0.9rem', 'z-index:9999',
            'box-shadow:var(--shadow-md)', 'opacity:0',
            'transition:opacity 0.25s,transform 0.25s', 'pointer-events:none'
        ].join(';');
        document.body.appendChild(el);
        return el;
    })();
    let toastTimer = null;
    function showToast(msg) {
        toastEl.textContent = msg;
        toastEl.style.opacity = '1';
        toastEl.style.transform = 'translateX(-50%) translateY(0)';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toastEl.style.opacity = '0';
            toastEl.style.transform = 'translateX(-50%) translateY(20px)';
        }, 3000);
    }

    // Screen-reader live region helpers
    const srStepAnnouncer   = document.getElementById('srStepAnnouncer');
    const srPledgeAnnouncer = document.getElementById('srPledgeAnnouncer');
    function announceToSR(regionEl, msg) {
        if (!regionEl) return;
        regionEl.textContent = '';
        // Brief delay ensures AT picks up the change even when content is the same
        requestAnimationFrame(() => { regionEl.textContent = msg; });
    }
    // ----------------------------------------------------
    // WCAG Modal dialog & Focus Trap Management
    // ----------------------------------------------------
    const ModalManager = {
        activeModal: null,
        previousActiveElement: null,

        open(modalEl) {
            if (this.activeModal) this.close(this.activeModal);

            this.previousActiveElement = document.activeElement;
            this.activeModal = modalEl;
            modalEl.classList.add('active');

            // Use rAF to shift focus after the transition paint cycle
            requestAnimationFrame(() => {
                const focusables = modalEl.querySelectorAll('button, input, select, textarea, a');
                if (focusables.length > 0) focusables[0].focus();
            });
        },

        close(modalEl) {
            modalEl.classList.remove('active');
            if (this.activeModal === modalEl) {
                this.activeModal = null;
            }
            // Restore focus
            if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
                this.previousActiveElement.focus();
            }
        },

        handleKeyDown(e) {
            if (!this.activeModal) return;

            // ESC key closes configuration modals, onboarding is sticky
            if (e.key === 'Escape' && this.activeModal.id !== 'onboardingModal') {
                this.close(this.activeModal);
                e.preventDefault();
                return;
            }

            // Keyboard Focus trapping (Tab & Shift+Tab loop)
            if (e.key === 'Tab') {
                const focusables = Array.from(this.activeModal.querySelectorAll('button, input, select, textarea, a'))
                    .filter(el => !el.disabled && el.tabIndex !== -1);
                if (focusables.length === 0) return;

                const first = focusables[0];
                const last = focusables[focusables.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === first) {
                        last.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === last) {
                        first.focus();
                        e.preventDefault();
                    }
                }
            }
        }
    };

    // Attach global focus trap handlers
    document.addEventListener('keydown', (e) => ModalManager.handleKeyDown(e));

    // ----------------------------------------------------
    // Security Utilities
    // ----------------------------------------------------

    /**
     * Escapes HTML special characters to prevent XSS when injecting
     * strings into innerHTML templates.
     *
     * @param {string} str - Raw string to escape
     * @returns {string} HTML-safe string
     */
    function escapeHtml(str) {
        if (typeof str !== 'string') return String(str);
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Common utility to read and normalize input values from onboarding or sandbox calculator.
     * Reduces duplication and ensures unified parsing logic.
     *
     * @param {string} prefix - Field ID prefix ('onboard' or 'calc')
     * @returns {Object} Normalized input object for CalcEngine
     */
    function readFormInputs(prefix) {
        const getVal = (idSuffix) => {
            const el = document.getElementById(prefix + idSuffix);
            return el ? el.value : '';
        };
        const getChecked = (idSuffix) => {
            const el = document.getElementById(prefix + idSuffix);
            return el ? el.checked : false;
        };

        return {
            carKm: parseFloat(getVal('CarMiles')) || 0,
            evKm: parseFloat(getVal('EvMiles')) || 0,
            transitKm: parseFloat(getVal('TransitMiles')) || 0,
            flightHours: parseFloat(getVal('FlightHours')) || 0,
            electricityKwh: parseFloat(getVal('Electricity')) || 0,
            solarPercent: parseFloat(getVal('Solar')) || 0,
            lpgCylinders: parseFloat(getVal('Gas')) || 0,
            householdSize: parseInt(getVal('Household'), 10) || 1,
            dietType: getVal('DietType'),
            localFood: !!getChecked('LocalFood'),
            shoppingHabit: getVal('Shopping'),
            recyclePercent: parseFloat(getVal('Recycle')) || 0
        };
    }

    // ----------------------------------------------------
    // Initialization
    // ----------------------------------------------------

    /**
     * Bootstraps the application by checking for existing user data.
     * Shows onboarding wizard for first-time visitors, restores
     * dashboard state for returning users.
     */
    function init() {
        bindSliderSync();
        bindEvents();

        AppState.profile = StorageLayer.getProfile();
        AppState.latestEmissions = StorageLayer.getLatestEmissions();
        AppState.history = StorageLayer.getHistory();
        AppState.pledges = StorageLayer.getPledges();

        if (!AppState.profile || !AppState.latestEmissions) {
            // First time user or data corruption detected — show onboarding modal
            ModalManager.open(onboardingModal);
            setupOnboardingSliders();
            updateStepView();
        } else {
            // Restore dashboard state from stored values
            welcomeUser.textContent = `Welcome Back, ${AppState.profile.name}`;
            userGoalDisplay.textContent = AppState.profile.carbonGoal.toFixed(1);
            valGoalFootprint.innerHTML = `${escapeHtml(AppState.profile.carbonGoal.toFixed(1))} <span>t/yr</span>`;

            // Restore inputs into sandbox form
            restoreSandboxInputs(AppState.latestEmissions.inputs);

            // Recalculate and update displays
            updateDashboard();
        }
    }

    // ----------------------------------------------------
    // Onboarding Multi-step Wizard
    // ----------------------------------------------------

    /**
     * Binds input event listeners to all onboarding sliders
     * so their display values update in real time.
     */
    function setupOnboardingSliders() {
        const displayMappings = {
            'onboardCarMiles': 'valOnboardCar',
            'onboardEvMiles': 'valOnboardEv',
            'onboardTransitMiles': 'valOnboardTransit',
            'onboardFlightHours': 'valOnboardFlight',
            'onboardElectricity': 'valOnboardElect',
            'onboardSolar': 'valOnboardSolar',
            'onboardGas': 'valOnboardGas',
            'onboardHousehold': 'valOnboardHouse',
            'onboardRecycle': 'valOnboardRecycle'
        };

        const onboardingForm = document.getElementById('onboardingForm');
        if (onboardingForm) {
            onboardingForm.addEventListener('input', (e) => {
                const target = e.target;
                const displayId = displayMappings[target.id];
                if (displayId) {
                    const displayEl = document.getElementById(displayId);
                    if (displayEl) {
                        displayEl.textContent = target.value;
                    }
                }
            });
        }
    }

    /**
     * Updates which onboarding step is visible and manages
     * step indicator dot states (active, completed, pending).
     */
    function updateStepView() {
        // Hide all steps, show active
        onboardingSteps.forEach((step, idx) => {
            step.classList.toggle('active', idx + 1 === AppState.currentStep);
        });

        // Update step indicator dots
        for (let i = 1; i <= TOTAL_ONBOARDING_STEPS; i++) {
            const dot = document.getElementById(`dot${i}`);
            if (!dot) continue;

            dot.classList.toggle('active', i === AppState.currentStep);
            dot.classList.toggle('completed', i < AppState.currentStep);
        }

        // Toggle back button disabled state
        btnPrevStep.disabled = AppState.currentStep === 1;

        // Toggle continue button text on final step
        btnNextStep.textContent = AppState.currentStep === TOTAL_ONBOARDING_STEPS
            ? 'Finish & Calculate'
            : 'Continue';

        // Announce step to screen readers
        announceToSR(srStepAnnouncer, `Step ${AppState.currentStep} of ${TOTAL_ONBOARDING_STEPS}`);
    }

    /**
     * Collects all onboarding form values, runs the initial carbon
     * calculation, saves the profile, and transitions to the dashboard.
     */
    function processOnboardingSubmit() {
        const onboardInputs = readFormInputs('onboard');

        // Cap name to 60 chars to prevent oversized DOM text; strip leading/trailing whitespace
        const username = (document.getElementById('onboardName').value.trim() || 'Eco Pioneer').slice(0, 60);
        const carbonGoal = Math.max(0.1, parseFloat(document.getElementById('onboardGoal').value) || DEFAULT_CARBON_GOAL);

        // Calculate initial carbon values
        const results = CalcEngine.calculate(onboardInputs);

        // Update profile
        StorageLayer.updateProfile({
            name: username,
            carbonGoal: carbonGoal,
            ecoPoints: ONBOARDING_REWARD_POINTS
        });

        // Save emissions entry
        StorageLayer.saveEmissionsEntry(results);

        // Copy onboarding settings to sandbox inputs
        restoreSandboxInputs(results.inputs);

        // Close onboarding modal
        ModalManager.close(onboardingModal);

        // Update state cache
        AppState.profile = StorageLayer.getProfile();
        AppState.latestEmissions = results;
        AppState.history = StorageLayer.getHistory();
        AppState.pledges = StorageLayer.getPledges();

        // Update layouts
        updateDashboard();

        // Trigger initial Local AI advice
        triggerAICoach(results.total, true);
    }

    // ----------------------------------------------------
    // Sandbox Sliders Real-time Sync
    // ----------------------------------------------------

    /**
     * Binds real-time input listeners to all interactive calculator
     * sliders and dropdowns. Updates numeric indicators instantly for 
     * smooth feel, and debounces calculation logic.
     */
    function bindSliderSync() {
        const displayMappings = {
            'calcCarMiles': 'valCarMiles',
            'calcEvMiles': 'valEvMiles',
            'calcTransitMiles': 'valTransitMiles',
            'calcFlightHours': 'valFlightHours',
            'calcElectricity': 'valElectricity',
            'calcSolar': 'valSolar',
            'calcGas': 'valGas',
            'calcHousehold': 'valHousehold',
            'calcRecycle': 'valRecycle'
        };

        const calculatorForm = document.getElementById('calculatorForm');
        if (calculatorForm) {
            calculatorForm.addEventListener('input', (e) => {
                const target = e.target;
                const displayId = displayMappings[target.id];
                if (displayId) {
                    const displayEl = document.getElementById(displayId);
                    if (displayEl) {
                        displayEl.textContent = target.value;
                    }
                    debouncedSandboxChange();
                }
            });

            calculatorForm.addEventListener('change', (e) => {
                const target = e.target;
                if (target.id === 'calcDietType' || target.id === 'calcLocalFood' || target.id === 'calcShopping') {
                    debouncedSandboxChange();
                }
            });
        }
    }

    /**
     * Debounced handler for sandbox changes.
     * Avoids recalculation bottleneck and layout updates on every frame.
     */
    let sandboxChangeTimeout = null;
    function debouncedSandboxChange() {
        clearTimeout(sandboxChangeTimeout);
        sandboxChangeTimeout = setTimeout(() => {
            if (AppState.isCalculating) return;
            AppState.isCalculating = true;

            const inputs = getSandboxInputs();
            const results = CalcEngine.calculate(inputs);

            // Save state
            StorageLayer.saveEmissionsEntry(results);
            AppState.latestEmissions = results;
            AppState.history = StorageLayer.getHistory(); // Keep history cache synchronized

            // Render updates
            updateDashboard();
            AppState.isCalculating = false;
        }, SANDBOX_DEBOUNCE_MS);
    }

    /**
     * Reads current values from all sandbox calculator form elements.
     *
     * @returns {Object} Input object compatible with CalcEngine.calculate()
     */
    function getSandboxInputs() {
        return readFormInputs('calc');
    }

    /**
     * Restores sandbox form controls to previously saved input values.
     * Used when returning users reload the dashboard.
     *
     * @param {Object} inputs - Saved inputs object from StorageLayer
     */
    function restoreSandboxInputs(inputs) {
        if (!inputs) return;

        const sliderMappings = [
            { element: calcCarMiles, display: 'valCarMiles', key: 'carKm' },
            { element: calcEvMiles, display: 'valEvMiles', key: 'evKm' },
            { element: calcTransitMiles, display: 'valTransitMiles', key: 'transitKm' },
            { element: calcFlightHours, display: 'valFlightHours', key: 'flightHours' },
            { element: calcElectricity, display: 'valElectricity', key: 'electricityKwh' },
            { element: calcSolar, display: 'valSolar', key: 'solarPercent' },
            { element: calcGas, display: 'valGas', key: 'lpgCylinders' },
            { element: calcHousehold, display: 'valHousehold', key: 'householdSize' },
            { element: calcRecycle, display: 'valRecycle', key: 'recyclePercent' }
        ];

        sliderMappings.forEach(({ element, display, key }) => {
            if (!element) return;
            element.value = inputs[key];
            const displayEl = document.getElementById(display);
            if (displayEl) displayEl.textContent = inputs[key];
        });

        calcDietType.value = inputs.dietType;
        calcLocalFood.checked = !!inputs.localFood;
        calcShopping.value = inputs.shoppingHabit;
    }

    // ----------------------------------------------------
    // Dashboard Rendering
    // ----------------------------------------------------

    /**
     * Master dashboard update function. Syncs local caches and selectively
     * renders DOM nodes to minimize painting performance overheads.
     */
    function updateDashboard() {
        // Use already-loaded AppState — avoid redundant storage reads on hot render path
        const profile = AppState.profile;
        const latest  = AppState.latestEmissions;
        if (!profile || !latest) return;

        // Simple DOM guards to avoid unnecessary layout calculations and thrashing
        const welcomeText = `Welcome, ${profile.name}`;
        if (welcomeUser.textContent !== welcomeText) {
            welcomeUser.textContent = welcomeText;
        }

        const goalText = profile.carbonGoal.toFixed(1);
        if (userGoalDisplay.textContent !== goalText) {
            userGoalDisplay.textContent = goalText;
        }

        const currentFootprintHTML = `${escapeHtml(latest.total.toFixed(1))} <span>t/yr</span>`;
        if (valCurrentFootprint.innerHTML !== currentFootprintHTML) {
            valCurrentFootprint.innerHTML = currentFootprintHTML;
        }

        const goalFootprintHTML = `${escapeHtml(profile.carbonGoal.toFixed(1))} <span>t/yr</span>`;
        if (valGoalFootprint.innerHTML !== goalFootprintHTML) {
            valGoalFootprint.innerHTML = goalFootprintHTML;
        }

        // Status indicator — pure class toggle, no inline style
        const diff = latest.total - profile.carbonGoal;
        const targetClass = diff <= 0 ? 'metric-value tier-eco-champion' : 'metric-value status-over-target';
        const targetHTML = diff <= 0 
            ? '<span aria-hidden="true">✅</span><span class="sr-only">On Target</span> On Target'
            : '<span aria-hidden="true">⚠️</span><span class="sr-only">Over Target</span> Over Target';

        if (valFootprintStatus.className !== targetClass) {
            valFootprintStatus.className = targetClass;
        }
        if (valFootprintStatus.innerHTML !== targetHTML) {
            valFootprintStatus.innerHTML = targetHTML;
        }

        // Navigation Displays
        const pointsText = String(profile.ecoPoints);
        if (navPointsDisplay.textContent !== pointsText) {
            navPointsDisplay.textContent = pointsText;
        }

        const tierClass = `tier-text ${getTierClass(profile.ecoTier)}`;
        if (navTierDisplay.className !== tierClass) {
            navTierDisplay.className = tierClass;
        }
        if (navTierDisplay.textContent !== profile.ecoTier) {
            navTierDisplay.textContent = profile.ecoTier;
        }

        // Progress bars and Breakdown Category Labels
        updateCategoryRow(latest.categories.transport, latest.percentages.transport, barTransport, labelTransportCo2, labelTransportPct, 'trackTransport');
        updateCategoryRow(latest.categories.energy,    latest.percentages.energy,    barEnergy,    labelEnergyCo2,    labelEnergyPct,    'trackEnergy');
        updateCategoryRow(latest.categories.food,      latest.percentages.food,      barFood,      labelFoodCo2,      labelFoodPct,      'trackFood');
        updateCategoryRow(latest.categories.waste,     latest.percentages.waste,     barWaste,     labelWasteCo2,     labelWastePct,     'trackWaste');

        // Update recommendations list (uses smart DOM reconcile)
        updateRecommendations(latest.percentages);

        // Update History Chart (uses smart DOM reconcile)
        updateHistoryChart();

        // Check AI Cache status — but NOT during slider drag (history length changes = full load only)
        if (AppState.history.length !== AppState.lastRenderedHistoryLength) {
            checkAICacheStatus(latest.total);
        }
    }

    /**
     * Updates a single category row's progress bar and labels.
     *
     * @param {number} co2 - Category emissions in tonnes
     * @param {number} pct - Category percentage of total
     * @param {HTMLElement} barEl - Progress bar fill element
     * @param {HTMLElement} co2El - Tonnes display element
     * @param {HTMLElement} pctEl - Percentage display element
     */
    function updateCategoryRow(co2, pct, barEl, co2El, pctEl, trackId) {
        if (!barEl || !co2El || !pctEl) return;
        const rounded = Math.round(pct);
        
        // Simple DOM guards to avoid unnecessary layout calculations
        const co2Text = co2.toFixed(1);
        if (co2El.textContent !== co2Text) {
            co2El.textContent = co2Text;
        }

        const pctText = String(rounded);
        if (pctEl.textContent !== pctText) {
            pctEl.textContent = pctText;
        }

        const widthStyle = `${pct}%`;
        if (barEl.style.width !== widthStyle) {
            barEl.style.width = widthStyle;
        }

        if (trackId) {
            const track = document.getElementById(trackId);
            if (track && track.getAttribute('aria-valuenow') !== pctText) {
                track.setAttribute('aria-valuenow', pctText);
            }
        }
    }

    /**
     * Maps eco tier names to their corresponding CSS class names.
     *
     * @param {string} tier - Tier name from profile
     * @returns {string} CSS class name for styling
     */
    function getTierClass(tier) {
        const tierMap = {
            'Eco-Guardian': 'tier-eco-guardian',
            'Eco-Champion': 'tier-eco-champion',
            'Eco-Defender': 'tier-eco-defender'
        };
        return tierMap[tier] || 'tier-eco-novice';
    }

    // ----------------------------------------------------
    // Decision Engine & Recommendations
    // ----------------------------------------------------

    /**
     * Queries the Decision Engine for prioritized categories, filters
     * out active/completed pledges, and renders the top 3 recommendations.
     * Rebuilds DOM only when the recommendations list changes.
     *
     * @param {Object} percentages - Category percentages from CalcEngine
     */
    function updateRecommendations(percentages) {
        const prioritizedCategories = DecisionEngine.getPrioritizedCategories(percentages);
        const excludedPledgeIds = AppState.pledges
            .filter(p => p.status === 'active' || p.status === 'completed')
            .map(p => p.pledgeId);

        const topRecommendations = RecommendationEngine.getRecommendations(prioritizedCategories, excludedPledgeIds);

        // Render Diff Check
        const recsHash = topRecommendations.map(r => r.id).join(',');
        if (recsHash === AppState.lastRenderedRecommendationsHash) {
            return; // Exit early if layout remains same
        }
        AppState.lastRenderedRecommendationsHash = recsHash;

        recommendationsContainer.innerHTML = '';

        if (topRecommendations.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'recommendations-empty';
            emptyMsg.textContent = '🌱 All recommended pledges active or completed! Keep up the amazing work!';
            recommendationsContainer.appendChild(emptyMsg);
            return;
        }

        topRecommendations.forEach(rec => {
            recommendationsContainer.appendChild(createRecommendationCard(rec));
        });
    }

    /**
     * Creates a single recommendation card DOM element with XSS-safe content.
     *
     * @param {Object} rec - Recommendation object from RecommendationEngine
     * @returns {HTMLElement} Fully constructed card element
     */
    function createRecommendationCard(rec) {
        const card = document.createElement('div');
        card.className = 'pledge-card';

        // Category badge
        const categoryBadge = document.createElement('span');
        categoryBadge.className = `pledge-category ${escapeHtml(rec.category)}`;
        categoryBadge.textContent = rec.category;

        // Title — margin-top handled by .pledge-title CSS class (no inline style)
        const title = document.createElement('h3');
        title.className = 'pledge-title';
        title.textContent = rec.title;

        // Description
        const desc = document.createElement('p');
        desc.className = 'pledge-description';
        desc.textContent = rec.description;

        // Impact metrics
        const impact = document.createElement('span');
        impact.className = 'pledge-impact';
        impact.innerHTML = `📉 Saves ~<b>${escapeHtml(rec.co2Reduction.toFixed(1))}</b> t/yr &bull; 🪙 +<b>${escapeHtml(String(rec.points))}</b> pts &bull; ⚡ Ease: <b>${escapeHtml(rec.easeOfAdoption)}</b>`;

        // Info container
        const info = document.createElement('div');
        info.className = 'pledge-info';
        info.appendChild(categoryBadge);
        info.appendChild(title);
        info.appendChild(desc);
        info.appendChild(impact);

        // Commit button
        const commitBtn = document.createElement('button');
        commitBtn.className = 'pledge-action-btn';
        commitBtn.type = 'button';
        commitBtn.textContent = 'Commit';
        commitBtn.dataset.id = rec.id;
        commitBtn.setAttribute('aria-label', `Commit to pledge: ${rec.title}`);

        card.appendChild(info);
        card.appendChild(commitBtn);

        return card;
    }

    /**
     * Saves a pledge as active in storage and refreshes the display.
     *
     * @param {Object} pledge - Pledge object to commit
     */
    function commitPledge(pledge) {
        StorageLayer.togglePledge(pledge.id, 'active');

        // Only re-read pledges (the only thing that changed)
        AppState.pledges = StorageLayer.getPledges();

        if (AppState.latestEmissions) {
            updateRecommendations(AppState.latestEmissions.percentages);
        }
        navPointsDisplay.textContent = AppState.profile.ecoPoints;

        // Announce pledge commit to screen readers
        announceToSR(srPledgeAnnouncer, `Pledge committed: ${pledge.title}. Eco-Points updated.`);
    }

    // ----------------------------------------------------
    // History Chart Renderer
    // ----------------------------------------------------

    /**
     * Renders history chart. If history length hasn't changed, updates
     * only the last bar's style properties in place to prevent DOM thrashing.
     */
    function updateHistoryChart() {
        const history = AppState.history;

        // Direct node modification if length is unchanged (e.g. while dragging slider updates today's value)
        if (history.length === AppState.lastRenderedHistoryLength && history.length > 0) {
            const lastEntry = history[history.length - 1];
            const maxCo2 = Math.max(1.0, ...history.map(h => h.total));
            const percentHeight = Math.max(
                CHART_MIN_HEIGHT_PERCENT,
                (lastEntry.total / maxCo2) * CHART_SCALE_FACTOR
            );

            const lastBarFill = historyChartContainer.querySelector('.chart-bar-wrapper:last-child .chart-bar-fill');
            if (lastBarFill) {
                lastBarFill.style.height = `${percentHeight}%`;
                const tooltip = lastBarFill.querySelector('.chart-bar-tooltip');
                if (tooltip) {
                    tooltip.textContent = `${lastEntry.total.toFixed(1)} tonnes`;
                }
            }
            return;
        }

        AppState.lastRenderedHistoryLength = history.length;
        historyChartContainer.innerHTML = '';

        if (history.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'chart-empty';
            emptyMsg.textContent = 'No logs available. Use sliders to record footprints.';
            historyChartContainer.appendChild(emptyMsg);
            return;
        }

        const maxCo2 = Math.max(1.0, ...history.map(h => h.total));

        history.forEach(h => {
            const barWrapper = document.createElement('div');
            barWrapper.className = 'chart-bar-wrapper';

            const dateObj = new Date(h.date);
            const shortDate = dateObj.toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                timeZone: 'UTC'
            });

            const percentHeight = Math.max(
                CHART_MIN_HEIGHT_PERCENT,
                (h.total / maxCo2) * CHART_SCALE_FACTOR
            );

            const barFill = document.createElement('div');
            barFill.className = 'chart-bar-fill';
            barFill.style.height = `${percentHeight}%`;
            // Accessible label so AT reads each bar
            barWrapper.setAttribute('aria-label', `${shortDate}: ${h.total.toFixed(1)} tonnes CO₂e`);

            const tooltip = document.createElement('div');
            tooltip.className = 'chart-bar-tooltip';
            tooltip.setAttribute('aria-hidden', 'true');
            tooltip.textContent = `${h.total.toFixed(1)} tonnes`;
            barFill.appendChild(tooltip);

            const label = document.createElement('div');
            label.className = 'chart-label';
            label.setAttribute('aria-hidden', 'true');
            label.textContent = shortDate;

            barWrapper.appendChild(barFill);
            barWrapper.appendChild(label);
            historyChartContainer.appendChild(barWrapper);
        });
    }

    // ----------------------------------------------------
    // AI Caching & Integration
    // ----------------------------------------------------

    /**
     * Checks if the current AI cache is still valid and updates
     * the cache status badge accordingly.
     *
     * @param {number} currentTotal - Current total footprint
     */
    function checkAICacheStatus(currentTotal) {
        const cache = StorageLayer.getAICache();

        if (!cache) {
            cacheStatusBadge.textContent = 'Uncached';
            cacheStatusBadge.style.color = 'var(--warning)';
            return;
        }

        const needsRefresh = AICoach.shouldRefresh(currentTotal, cache);
        if (needsRefresh) {
            cacheStatusBadge.textContent = 'Outdated advice';
            cacheStatusBadge.style.color = 'var(--danger)';
        } else {
            cacheStatusBadge.textContent = 'Cached';
            cacheStatusBadge.style.color = 'var(--primary-light)';

            // Display cached advice
            coachAdviceBox.innerHTML = AICoach.formatAdviceMarkdown(cache.insights);
        }
    }

    /**
     * Triggers the AI Sustainability Coach — first checks cache,
     * then falls back to local template advice, and finally attempts
     * a Gemini API call if an API key is configured.
     *
     * @param {number} currentTotal - Current total footprint
     * @param {boolean} [forceRefresh=false] - Skip cache and regenerate
     */
    async function triggerAICoach(currentTotal, forceRefresh = false) {
        const cache = StorageLayer.getAICache();
        const needsRefresh = forceRefresh || AICoach.shouldRefresh(currentTotal, cache);
        const profile = AppState.profile;
        const latest = AppState.latestEmissions;

        if (!profile || !latest) return;

        if (!needsRefresh && cache) {
            coachAdviceBox.innerHTML = AICoach.formatAdviceMarkdown(cache.insights);
            cacheStatusBadge.textContent = 'Cached';
            cacheStatusBadge.style.color = 'var(--primary-light)';
            return;
        }

        const localAdvice = AICoach.generateLocalInsight(latest, profile.carbonGoal);

        if (!AppState.geminiApiKey) {
            StorageLayer.setAICache(localAdvice, currentTotal);
            coachAdviceBox.innerHTML = AICoach.formatAdviceMarkdown(localAdvice);
            cacheStatusBadge.textContent = 'Local Sync';
            cacheStatusBadge.style.color = 'var(--text-muted)';
            return;
        }

        coachAdviceBox.textContent = '';
        const loadingWrapper = document.createElement('div');
        loadingWrapper.className = 'coach-loading';

        const spinner = document.createElement('span');
        spinner.className = 'spinner';
        loadingWrapper.appendChild(spinner);
        loadingWrapper.appendChild(document.createTextNode(' Generating AI advice...'));

        coachAdviceBox.appendChild(loadingWrapper);
        cacheStatusBadge.textContent = 'Syncing...';
        cacheStatusBadge.style.color = 'var(--warning)';

        try {
            const aiAdvice = await AICoach.getRemoteAdvice(AppState.geminiApiKey, latest, profile.carbonGoal);
            StorageLayer.setAICache(aiAdvice, currentTotal);
            coachAdviceBox.innerHTML = AICoach.formatAdviceMarkdown(aiAdvice);
            cacheStatusBadge.textContent = 'Gemini Sync';
            cacheStatusBadge.style.color = 'var(--accent)';
        } catch (err) {
            Logger.error('Gemini API request failed, loading local advice:', err);
            StorageLayer.setAICache(localAdvice, currentTotal);
            coachAdviceBox.innerHTML = AICoach.formatAdviceMarkdown(localAdvice);
            cacheStatusBadge.textContent = 'Offline Fallback';
            cacheStatusBadge.style.color = 'var(--danger)';
        }
    }



    // ----------------------------------------------------
    // Event Bindings
    // ----------------------------------------------------

    /**
     * Registers click and interaction event listeners.
     */
    function bindEvents() {
        // Logo click — styled toast instead of alert()
        document.getElementById('navLogo').addEventListener('click', () => {
            const profile = StorageLayer.getProfile();
            if (profile) {
                showToast(`👤 ${profile.name}  ·  Tier: ${profile.ecoTier}  ·  🌿 ${profile.ecoPoints} pts`);
            }
        });

        // Event delegation for pledge commits
        recommendationsContainer.addEventListener('click', (event) => {
            const btn = event.target.closest('.pledge-action-btn');
            if (!btn) return;
            const pledgeId = btn.dataset.id;
            const rec = RecommendationEngine.DB.find(r => r.id === pledgeId);
            if (rec) {
                commitPledge(rec);
            }
        });

        // Onboarding Wizard - Prev Step
        btnPrevStep.addEventListener('click', () => {
            if (AppState.currentStep > 1) {
                AppState.currentStep--;
                updateStepView();
            }
        });

        // Onboarding Wizard - Next Step / Submit
        btnNextStep.addEventListener('click', () => {
            if (AppState.currentStep < TOTAL_ONBOARDING_STEPS) {
                AppState.currentStep++;
                updateStepView();
            } else {
                processOnboardingSubmit();
            }
        });

        // AI Advice Deep Analysis trigger
        btnRequestAiDeep.addEventListener('click', () => {
            const latest = StorageLayer.getLatestEmissions();
            if (!latest) return;

            if (!AppState.geminiApiKey) {
                ModalManager.open(apiKeyModal);
                geminiApiKeyInput.value = '';
            } else {
                triggerAICoach(latest.total, true);
            }
        });

        // API Key Settings Modal — Open
        btnApiKeyConfig.addEventListener('click', () => {
            ModalManager.open(apiKeyModal);
            geminiApiKeyInput.value = AppState.geminiApiKey;
        });

        // API Key Settings Modal — Cancel
        btnApiKeyCancel.addEventListener('click', () => {
            ModalManager.close(apiKeyModal);
        });

        // API Key Settings Modal — Save (in-memory only — no storage write)
        btnApiKeySave.addEventListener('click', () => {
            AppState.geminiApiKey = geminiApiKeyInput.value.trim();
            ModalManager.close(apiKeyModal);

            // Regenerate AI advice with new key
            const latest = StorageLayer.getLatestEmissions();
            if (latest) {
                triggerAICoach(latest.total, true);
            }
        });

        // History reset — in-page confirmation toast instead of confirm()
        btnClearHistory.addEventListener('click', () => {
            if (btnClearHistory.dataset.confirmPending === 'true') {
                // Second click confirms
                StorageLayer.clearAll();
                AppState.geminiApiKey = ''; // Clear in-memory key on data reset
                window.location.reload();
            } else {
                btnClearHistory.dataset.confirmPending = 'true';
                btnClearHistory.textContent = 'Tap again to confirm erase';
                btnClearHistory.classList.add('btn-danger-confirm');
                showToast('⚠️ Click “Tap again to confirm erase” to permanently delete all data.');
                setTimeout(() => {
                    btnClearHistory.dataset.confirmPending = 'false';
                    btnClearHistory.textContent = 'Reset Data';
                    btnClearHistory.classList.remove('btn-danger-confirm');
                }, 5000);
            }
        });
    }

    // Initialize the application
    init();
});
