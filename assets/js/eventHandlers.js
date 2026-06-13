/**
 * Event Listeners & Input Bindings Module — FootprintCO2 AI
 */

"use strict";

window.App = window.App || {};

(function() {
    const SANDBOX_DEBOUNCE_MS = 50;

    /**
     * Binds input and change events to carbon calculator sandbox fields.
     * Updates field labels instantly and debounces real-time calculations.
     *
     * @returns {void}
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

        const DOM = App.DOM;
        if (DOM.calculatorForm) {
            DOM.calculatorForm.addEventListener('input', (e) => {
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

            DOM.calculatorForm.addEventListener('change', (e) => {
                const target = e.target;
                if (target.id === 'calcDietType' || target.id === 'calcLocalFood' || target.id === 'calcShopping') {
                    debouncedSandboxChange();
                }
            });
        }
    }

    let sandboxChangeTimeout = null;
    /**
     * Debounces real-time calculation pipeline to prevent performance degradation
     * on slider drag events.
     *
     * @returns {void}
     */
    function debouncedSandboxChange() {
        clearTimeout(sandboxChangeTimeout);
        sandboxChangeTimeout = setTimeout(() => {
            if (App.State.isCalculating) return;
            App.State.isCalculating = true;

            const inputs = App.Dashboard.getSandboxInputs();
            const results = CalcEngine.calculate(inputs);

            StorageLayer.saveEmissionsEntry(results);
            App.State.latestEmissions = results;
            App.State.history = StorageLayer.getHistory();

            App.Dashboard.updateDashboard();
            App.State.isCalculating = false;
        }, SANDBOX_DEBOUNCE_MS);
    }

    /**
     * Binds general interaction click event handlers across navigation,
     * recommendations committing, wizard steps buttons, custom API modal,
     * and reset application data buttons.
     *
     * @returns {void}
     */
    function bindEvents() {
        const DOM = App.DOM;
        const UI = App.UI;

        document.getElementById('navLogo').addEventListener('click', () => {
            const profile = StorageLayer.getProfile();
            if (profile) {
                UI.showToast(`👤 ${profile.name}  ·  Tier: ${profile.ecoTier}  ·  🌿 ${profile.ecoPoints} pts`);
            }
        });

        DOM.recommendationsContainer.addEventListener('click', (event) => {
            const btn = event.target.closest('.pledge-action-btn');
            if (!btn) return;
            const pledgeId = btn.dataset.id;
            const rec = RecommendationEngine.DB.find(r => r.id === pledgeId);
            if (rec) {
                App.Dashboard.commitPledge(rec);
            }
        });

        DOM.btnPrevStep.addEventListener('click', () => {
            if (App.State.currentStep > 1) {
                App.State.currentStep--;
                App.Onboarding.updateStepView();
            }
        });

        DOM.btnNextStep.addEventListener('click', () => {
            if (App.State.currentStep < 5) {
                App.State.currentStep++;
                App.Onboarding.updateStepView();
            } else {
                App.Onboarding.processOnboardingSubmit();
            }
        });

        DOM.btnRequestAiDeep.addEventListener('click', () => {
            const latest = StorageLayer.getLatestEmissions();
            if (!latest) return;

            if (!App.hasApiKey()) {
                UI.ModalManager.open(DOM.apiKeyModal);
                DOM.geminiApiKeyInput.value = '';
            } else {
                App.triggerAICoach(latest.total, true);
            }
        });

        DOM.btnApiKeyConfig.addEventListener('click', () => {
            UI.ModalManager.open(DOM.apiKeyModal);
            DOM.geminiApiKeyInput.value = App.getApiKey();
        });

        DOM.btnApiKeyCancel.addEventListener('click', () => {
            UI.ModalManager.close(DOM.apiKeyModal);
        });

        DOM.btnApiKeySave.addEventListener('click', () => {
            App.setApiKey(DOM.geminiApiKeyInput.value.trim());
            UI.ModalManager.close(DOM.apiKeyModal);

            const latest = StorageLayer.getLatestEmissions();
            if (latest) {
                App.triggerAICoach(latest.total, true);
            }
        });

        DOM.btnClearHistory.addEventListener('click', () => {
            if (DOM.btnClearHistory.dataset.confirmPending === 'true') {
                StorageLayer.clearAll();
                App.setApiKey('');
                window.location.reload();
            } else {
                DOM.btnClearHistory.dataset.confirmPending = 'true';
                DOM.btnClearHistory.textContent = 'Tap again to confirm erase';
                DOM.btnClearHistory.classList.add('btn-danger-confirm');
                UI.showToast('⚠️ Click “Tap again to confirm erase” to permanently delete all data.');
                setTimeout(() => {
                    DOM.btnClearHistory.dataset.confirmPending = 'false';
                    DOM.btnClearHistory.textContent = 'Reset Data';
                    DOM.btnClearHistory.classList.remove('btn-danger-confirm');
                }, 5000);
            }
        });
    }

    App.EventHandlers = {
        bindSliderSync,
        bindEvents
    };
})();
