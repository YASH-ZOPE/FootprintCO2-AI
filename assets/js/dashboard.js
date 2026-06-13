/**
 * Dashboard & Recommendation Renderer Module — FootprintCO2 AI
 */

"use strict";

window.App = window.App || {};

(function() {
    /**
     * Reads all form inputs from the UI fields using the specified prefix.
     *
     * @param {string} prefix - The ID prefix of the input elements (e.g., 'calc' or 'onboard')
     * @returns {Object} Sanitized input fields object
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

    /**
     * Reads the current sandbox carbon calculator form inputs.
     *
     * @returns {Object} Carbon calculator input fields object
     */
    function getSandboxInputs() {
        return readFormInputs('calc');
    }

    /**
     * Restores carbon calculator inputs back to sandbox UI fields.
     * Updates slide indicators and selector values accordingly.
     *
     * @param {Object} inputs - Carbon calculator inputs to populate
     * @returns {void}
     */
    function restoreSandboxInputs(inputs) {
        if (!inputs) return;
        const DOM = App.DOM;

        const sliderMappings = [
            { element: DOM.calcCarMiles, display: 'valCarMiles', key: 'carKm' },
            { element: DOM.calcEvMiles, display: 'valEvMiles', key: 'evKm' },
            { element: DOM.calcTransitMiles, display: 'valTransitMiles', key: 'transitKm' },
            { element: DOM.calcFlightHours, display: 'valFlightHours', key: 'flightHours' },
            { element: DOM.calcElectricity, display: 'valElectricity', key: 'electricityKwh' },
            { element: DOM.calcSolar, display: 'valSolar', key: 'solarPercent' },
            { element: DOM.calcGas, display: 'valGas', key: 'lpgCylinders' },
            { element: DOM.calcHousehold, display: 'valHousehold', key: 'householdSize' },
            { element: DOM.calcRecycle, display: 'valRecycle', key: 'recyclePercent' }
        ];

        for (const { element, display, key } of sliderMappings) {
            if (!element) continue;
            element.value = inputs[key];
            const displayEl = document.getElementById(display);
            if (displayEl) displayEl.textContent = inputs[key];
        }

        DOM.calcDietType.value = inputs.dietType;
        DOM.calcLocalFood.checked = !!inputs.localFood;
        DOM.calcShopping.value = inputs.shoppingHabit;
    }

    /**
     * Refreshes the dashboard metrics, progress bars, charts, and recommendations.
     * Synchronizes presentation values from the global state.
     *
     * @returns {void}
     */
    function updateDashboard() {
        const profile = App.State.profile;
        const latest = App.State.latestEmissions;
        if (!profile || !latest) return;

        const DOM = App.DOM;
        const UI = App.UI;

        const welcomeText = `Welcome, ${profile.name}`;
        if (DOM.welcomeUser.textContent !== welcomeText) {
            DOM.welcomeUser.textContent = welcomeText;
        }

        const goalText = profile.carbonGoal.toFixed(1);
        if (DOM.userGoalDisplay.textContent !== goalText) {
            DOM.userGoalDisplay.textContent = goalText;
        }

        const currentFootprintHTML = `${UI.escapeHtml(latest.total.toFixed(1))} <span>t/yr</span>`;
        if (DOM.valCurrentFootprint.innerHTML !== currentFootprintHTML) {
            DOM.valCurrentFootprint.innerHTML = currentFootprintHTML;
        }

        const goalFootprintHTML = `${UI.escapeHtml(profile.carbonGoal.toFixed(1))} <span>t/yr</span>`;
        if (DOM.valGoalFootprint.innerHTML !== goalFootprintHTML) {
            DOM.valGoalFootprint.innerHTML = goalFootprintHTML;
        }

        const diff = latest.total - profile.carbonGoal;
        const targetClass = diff <= 0 ? 'metric-value tier-eco-champion' : 'metric-value status-over-target';
        const targetHTML = diff <= 0 
            ? '<span aria-hidden="true">✅</span><span class="sr-only">On Target</span> On Target'
            : '<span aria-hidden="true">⚠️</span><span class="sr-only">Over Target</span> Over Target';

        if (DOM.valFootprintStatus.className !== targetClass) {
            DOM.valFootprintStatus.className = targetClass;
        }
        if (DOM.valFootprintStatus.innerHTML !== targetHTML) {
            DOM.valFootprintStatus.innerHTML = targetHTML;
        }

        const pointsText = String(profile.ecoPoints);
        if (DOM.navPointsDisplay.textContent !== pointsText) {
            DOM.navPointsDisplay.textContent = pointsText;
        }

        const tierClass = `tier-text ${getTierClass(profile.ecoTier)}`;
        if (DOM.navTierDisplay.className !== tierClass) {
            DOM.navTierDisplay.className = tierClass;
        }
        if (DOM.navTierDisplay.textContent !== profile.ecoTier) {
            DOM.navTierDisplay.textContent = profile.ecoTier;
        }

        updateCategoryRow(latest.categories.transport, latest.percentages.transport, DOM.barTransport, DOM.labelTransportCo2, DOM.labelTransportPct, 'trackTransport');
        updateCategoryRow(latest.categories.energy,    latest.percentages.energy,    DOM.barEnergy,    DOM.labelEnergyCo2,    DOM.labelEnergyPct,    'trackEnergy');
        updateCategoryRow(latest.categories.food,      latest.percentages.food,      DOM.barFood,      DOM.labelFoodCo2,      DOM.labelFoodPct,      'trackFood');
        updateCategoryRow(latest.categories.waste,     latest.percentages.waste,     DOM.barWaste,     DOM.labelWasteCo2,     DOM.labelWastePct,     'trackWaste');

        updateRecommendations(latest.percentages);
        App.Charts.updateHistoryChart();

        if (App.State.history.length !== App.State.lastRenderedHistoryLength) {
            App.checkAICacheStatus(latest.total);
        }
    }

    /**
     * Synchronizes a single carbon category progress row in the UI.
     *
     * @param {number} co2 - Category emissions in tonnes CO2e/yr
     * @param {number} pct - Percentage contribution of the category
     * @param {HTMLElement} barEl - The category progress bar fill element
     * @param {HTMLElement} co2El - Element displaying target CO2 number
     * @param {HTMLElement} pctEl - Element displaying percentage share
     * @param {string} trackId - The category wrapper element ID for accessibility value updates
     * @returns {void}
     */
    function updateCategoryRow(co2, pct, barEl, co2El, pctEl, trackId) {
        if (!barEl || !co2El || !pctEl) return;
        const rounded = Math.round(pct);
        
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
     * Maps an Eco-Tier title string to its corresponding CSS styling class name.
     *
     * @param {string} tier - The Eco-Tier title string
     * @returns {string} CSS class name identifier
     */
    function getTierClass(tier) {
        const tierMap = {
            'Eco-Guardian': 'tier-eco-guardian',
            'Eco-Champion': 'tier-eco-champion',
            'Eco-Defender': 'tier-eco-defender'
        };
        return tierMap[tier] || 'tier-eco-novice';
    }

    /**
     * Identifies, filters, and displays the top 3 recommended pledges.
     * Utilizes rounded percentages hashing to cache layout updates.
     *
     * @param {Object} percentages - Category percentages { transport, energy, food, waste }
     * @returns {void}
     */
    function updateRecommendations(percentages) {
        const prioritizedCategories = DecisionEngine.getPrioritizedCategories(percentages);
        const prioritizedHash = prioritizedCategories.join(',');
        
        // Single-pass optimization: replace App.State.pledges.filter().map()
        const excludedPledgeIds = [];
        for (const p of App.State.pledges) {
            if (p.status === 'active' || p.status === 'completed') {
                excludedPledgeIds.push(p.pledgeId);
            }
        }
        excludedPledgeIds.sort();
        const pledgesHash = excludedPledgeIds.join(',');
        
        const roundedPercentages = prioritizedCategories.map(cat => Math.round(percentages[cat] || 0)).join(',');
        const cacheKey = `${prioritizedHash}|${pledgesHash}|${roundedPercentages}`;
        if (App.State.lastRecommendationsCacheKey === cacheKey) {
            return; // Cache hit: exit early to avoid recalculation/re-rendering
        }
        App.State.lastRecommendationsCacheKey = cacheKey;

        const topRecommendations = RecommendationEngine.getRecommendations(prioritizedCategories, excludedPledgeIds);

        const DOM = App.DOM;
        DOM.recommendationsContainer.innerHTML = '';

        if (topRecommendations.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'recommendations-empty';
            emptyMsg.textContent = '🌱 All recommended pledges active or completed! Keep up the amazing work!';
            DOM.recommendationsContainer.appendChild(emptyMsg);
            return;
        }

        for (const rec of topRecommendations) {
            DOM.recommendationsContainer.appendChild(createRecommendationCard(rec));
        }
    }

    /**
     * Compiles a single recommendation/pledge card DOM node.
     *
     * @param {Object} rec - The database recommendation entry object
     * @returns {HTMLElement} The card element node
     */
    function createRecommendationCard(rec) {
        const UI = App.UI;
        const card = document.createElement('div');
        card.className = 'pledge-card';

        const categoryBadge = document.createElement('span');
        categoryBadge.className = `pledge-category ${UI.escapeHtml(rec.category)}`;
        categoryBadge.textContent = rec.category;

        const title = document.createElement('h3');
        title.className = 'pledge-title';
        title.textContent = rec.title;

        const desc = document.createElement('p');
        desc.className = 'pledge-description';
        desc.textContent = rec.description;

        const impact = document.createElement('span');
        impact.className = 'pledge-impact';
        impact.innerHTML = `📉 Saves ~<b>${UI.escapeHtml(rec.co2Reduction.toFixed(1))}</b> t/yr &bull; 🪙 +<b>${UI.escapeHtml(String(rec.points))}</b> pts &bull; ⚡ Ease: <b>${UI.escapeHtml(rec.easeOfAdoption)}</b>`;

        const info = document.createElement('div');
        info.className = 'pledge-info';
        info.appendChild(categoryBadge);
        info.appendChild(title);
        info.appendChild(desc);
        info.appendChild(impact);

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
     * Commits to a recommendation, adding it to user's active pledges list.
     * Refreshes recommendations cache and updates accessibility live region.
     *
     * @param {Object} pledge - The recommendation entry being committed
     * @returns {void}
     */
    function commitPledge(pledge) {
        StorageLayer.togglePledge(pledge.id, 'active');
        App.State.pledges = StorageLayer.getPledges();

        if (App.State.latestEmissions) {
            updateRecommendations(App.State.latestEmissions.percentages);
        }
        App.DOM.navPointsDisplay.textContent = App.State.profile.ecoPoints;
        App.UI.announceToSR(App.DOM.srPledgeAnnouncer, `Pledge committed: ${pledge.title}. Eco-Points updated.`);
    }

    App.Dashboard = {
        readFormInputs,
        getSandboxInputs,
        restoreSandboxInputs,
        updateDashboard,
        commitPledge
    };
})();
