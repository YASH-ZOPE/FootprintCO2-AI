/**
 * Onboarding Wizard Module — FootprintCO2 AI
 * Handles onboarding wizard steps and submissions.
 */

"use strict";

window.App = window.App || {};

(function() {
    const TOTAL_ONBOARDING_STEPS = 5;
    const ONBOARDING_REWARD_POINTS = 50;
    const DEFAULT_CARBON_GOAL = 2.0;

    /**
     * Initializes and binds event listeners for the onboarding wizard input sliders
     * to dynamically update text displays.
     *
     * @returns {void}
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

        const DOM = App.DOM;
        if (DOM.onboardingForm) {
            DOM.onboardingForm.addEventListener('input', (e) => {
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
     * Updates the active onboarding step view, pagination indicator dots,
     * button labels, and accessibility step notifications.
     *
     * @returns {void}
     */
    function updateStepView() {
        const DOM = App.DOM;
        const UI = App.UI;

        DOM.onboardingSteps.forEach((step, idx) => {
            step.classList.toggle('active', idx + 1 === App.State.currentStep);
        });

        for (let i = 1; i <= TOTAL_ONBOARDING_STEPS; i++) {
            const dot = document.getElementById(`dot${i}`);
            if (!dot) continue;
            dot.classList.toggle('active', i === App.State.currentStep);
            dot.classList.toggle('completed', i < App.State.currentStep);
        }

        DOM.btnPrevStep.disabled = App.State.currentStep === 1;

        DOM.btnNextStep.textContent = App.State.currentStep === TOTAL_ONBOARDING_STEPS
            ? 'Finish & Calculate'
            : 'Continue';

        UI.announceToSR(DOM.srStepAnnouncer, `Step ${App.State.currentStep} of ${TOTAL_ONBOARDING_STEPS}`);
    }

    /**
     * Gathers onboarding questionnaire inputs, performs calculations, creates the user
     * profile, assigns points rewards, saves history, and closes the modal view.
     *
     * @returns {void}
     */
    function processOnboardingSubmit() {
        const DOM = App.DOM;
        const onboardInputs = App.Dashboard.readFormInputs('onboard');

        const username = (DOM.onboardName.value.trim() || 'Eco Pioneer').slice(0, 60);
        const carbonGoal = Math.max(0.1, parseFloat(DOM.onboardGoal.value) || DEFAULT_CARBON_GOAL);

        const results = CalcEngine.calculate(onboardInputs);

        StorageLayer.updateProfile({
            name: username,
            carbonGoal: carbonGoal,
            ecoPoints: ONBOARDING_REWARD_POINTS
        });

        StorageLayer.saveEmissionsEntry(results);
        App.Dashboard.restoreSandboxInputs(results.inputs);
        App.UI.ModalManager.close(DOM.onboardingModal);

        App.State.profile = StorageLayer.getProfile();
        App.State.latestEmissions = results;
        App.State.history = StorageLayer.getHistory();
        App.State.pledges = StorageLayer.getPledges();

        App.Dashboard.updateDashboard();
        App.triggerAICoach(results.total, true);
    }

    App.Onboarding = {
        setupOnboardingSliders,
        updateStepView,
        processOnboardingSubmit
    };
})();
