/**
 * Main Application Controller & Orchestrator — FootprintCO2 AI
 * Implements clean modular MVC design by coordinating submodules.
 */

"use strict";

window.App = window.App || {};

document.addEventListener('DOMContentLoaded', () => {
    let _geminiApiKey = '';
    App.getApiKey = () => _geminiApiKey;
    App.setApiKey = (key) => { _geminiApiKey = key; };
    App.hasApiKey = () => !!_geminiApiKey;

    // Initialize AppState (Single Source of Truth)
    App.State = {
        profile: null,
        latestEmissions: null,
        history: [],
        pledges: [],
        currentStep: 1,
        isCalculating: false,

        // Caching keys to prevent layout and sorting recalculations
        lastRecommendationsCacheKey: '',
        lastRenderedHistoryLength: 0
    };

    /**
     * Checks the validity of cached AI coach insights and updates the badge state.
     *
     * @param {number} currentTotal - Current carbon footprint total in tCO2e/yr
     * @returns {void}
     */
    function checkAICacheStatus(currentTotal) {
        const cache = StorageLayer.getAICache();

        if (!cache) {
            App.UI.setBadgeState('Uncached', 'badge-uncached');
            return;
        }

        const needsRefresh = AICoach.shouldRefresh(currentTotal, cache);
        if (needsRefresh) {
            App.UI.setBadgeState('Outdated advice', 'badge-outdated');
        } else {
            App.UI.setBadgeState('Cached', 'badge-cached');
            App.DOM.coachAdviceBox.innerHTML = AICoach.formatAdviceMarkdown(cache.insights);
        }
    }

    /**
     * Triggers the AI Coach pipeline. Performs a remote Gemini API request if an API Key
     * is loaded, otherwise falls back to local data-driven insights. Enforces a 3-second
     * button interaction cooldown period to comply with API quotas.
     *
     * @param {number} currentTotal - Current carbon footprint total in tCO2e/yr
     * @param {boolean} [forceRefresh=false] - If true, ignores change thresholds and refreshes
     * @returns {Promise<void>}
     */
    async function triggerAICoach(currentTotal, forceRefresh = false) {
        const cache = StorageLayer.getAICache();
        const needsRefresh = forceRefresh || AICoach.shouldRefresh(currentTotal, cache);
        const profile = App.State.profile;
        const latest = App.State.latestEmissions;

        if (!profile || !latest) return;

        if (!needsRefresh && cache) {
            App.DOM.coachAdviceBox.innerHTML = AICoach.formatAdviceMarkdown(cache.insights);
            App.UI.setBadgeState('Cached', 'badge-cached');
            return;
        }

        const localAdvice = AICoach.generateLocalInsight(latest, profile.carbonGoal);

        if (!App.hasApiKey()) {
            StorageLayer.setAICache(localAdvice, currentTotal);
            App.DOM.coachAdviceBox.innerHTML = AICoach.formatAdviceMarkdown(localAdvice);
            App.UI.setBadgeState('Local Sync', 'badge-local');
            return;
        }

        App.DOM.coachAdviceBox.textContent = '';
        const loadingWrapper = document.createElement('div');
        loadingWrapper.className = 'coach-loading';

        const spinner = document.createElement('span');
        spinner.className = 'spinner';
        loadingWrapper.appendChild(spinner);
        loadingWrapper.appendChild(document.createTextNode(' Generating AI advice...'));

        App.DOM.coachAdviceBox.appendChild(loadingWrapper);
        App.UI.setBadgeState('Syncing...', 'badge-syncing');

        // Disable button during active network sync to prevent spamming
        const btn = App.DOM.btnRequestAiDeep;
        if (btn) {
            btn.disabled = true;
            btn.classList.add('btn-cooldown');
        }

        try {
            const aiAdvice = await AICoach.getRemoteAdvice(App.getApiKey(), latest, profile.carbonGoal);
            StorageLayer.setAICache(aiAdvice, currentTotal);
            App.DOM.coachAdviceBox.innerHTML = AICoach.formatAdviceMarkdown(aiAdvice);
            App.UI.setBadgeState('Gemini Sync', 'badge-gemini');
        } catch (err) {
            Logger.error('Gemini API request failed, loading local advice:', err);
            StorageLayer.setAICache(localAdvice, currentTotal);
            App.DOM.coachAdviceBox.innerHTML = AICoach.formatAdviceMarkdown(localAdvice);

            const errMsg = err.message || String(err);
            if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
                App.UI.setBadgeState('Rate Limited', 'badge-error');
                App.UI.showToast('⚠️ API quota exceeded. Showing local advice. Try again in ~60s.');
            } else if (errMsg.includes('403') || errMsg.includes('API_KEY_INVALID')) {
                App.UI.setBadgeState('Invalid Key', 'badge-error');
                App.UI.showToast('❌ API key is invalid. Please re-enter in API Key settings.');
            } else if (errMsg.includes('404')) {
                App.UI.setBadgeState('Model Error', 'badge-error');
                App.UI.showToast('❌ AI model not found. Please report this issue.');
            } else {
                App.UI.setBadgeState('Offline Fallback', 'badge-error');
                App.UI.showToast('⚠️ AI Coach failed: ' + errMsg.slice(0, 80));
            }
        } finally {
            // Re-enable button after a 3-second cooldown to guarantee rate compliance
            setTimeout(() => {
                if (btn) {
                    btn.disabled = false;
                    btn.classList.remove('btn-cooldown');
                }
            }, 3000);
        }
    }

    App.checkAICacheStatus = checkAICacheStatus;
    App.triggerAICoach = triggerAICoach;

    /**
     * Initializes the carbon calculator controller. Registers listeners, restores state from
     * storage, and opens the onboarding questionnaire wizard if no profile exists.
     *
     * @returns {void}
     */
    function init() {
        App.EventHandlers.bindSliderSync();
        App.EventHandlers.bindEvents();

        App.State.profile = StorageLayer.getProfile();
        App.State.latestEmissions = StorageLayer.getLatestEmissions();
        App.State.history = StorageLayer.getHistory();
        App.State.pledges = StorageLayer.getPledges();

        if (!App.State.profile || !App.State.latestEmissions) {
            App.UI.ModalManager.open(App.DOM.onboardingModal);
            App.Onboarding.setupOnboardingSliders();
            App.Onboarding.updateStepView();
        } else {
            App.DOM.welcomeUser.textContent = `Welcome Back, ${App.State.profile.name}`;
            App.DOM.userGoalDisplay.textContent = App.State.profile.carbonGoal.toFixed(1);
            App.DOM.valGoalFootprint.innerHTML = `${App.UI.escapeHtml(App.State.profile.carbonGoal.toFixed(1))} <span>t/yr</span>`;

            App.Dashboard.restoreSandboxInputs(App.State.latestEmissions.inputs);
            App.Dashboard.updateDashboard();
        }
    }

    init();
});
