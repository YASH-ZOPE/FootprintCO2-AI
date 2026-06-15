/**
 * UI & Accessibility Module — FootprintCO2 AI
 * Registers cached DOM elements and manages UI, toasts, and modals (WCAG focus trap).
 */

"use strict";

window.App = window.App || {};

(function() {
    // Central DOM Elements Registry
    const DOM = {
        onboardingModal: document.getElementById('onboardingModal'),
        onboardingSteps: document.querySelectorAll('.onboarding-step'),
        onboardingForm: document.getElementById('onboardingForm'),
        btnPrevStep: document.getElementById('btnPrevStep'),
        btnNextStep: document.getElementById('btnNextStep'),
        onboardName: document.getElementById('onboardName'),
        onboardGoal: document.getElementById('onboardGoal'),

        apiKeyModal: document.getElementById('apiKeyModal'),
        apiKeyForm: document.getElementById('apiKeyForm'),
        btnApiKeyConfig: document.getElementById('btnApiKeyConfig'),
        btnApiKeyCancel: document.getElementById('btnApiKeyCancel'),
        btnApiKeySave: document.getElementById('btnApiKeySave'),
        geminiApiKeyInput: document.getElementById('geminiApiKeyInput'),

        welcomeUser: document.getElementById('welcomeUser'),
        userGoalDisplay: document.getElementById('userGoalDisplay'),
        navPointsDisplay: document.getElementById('navPointsDisplay'),
        navTierDisplay: document.getElementById('navTierDisplay'),
        valCurrentFootprint: document.getElementById('valCurrentFootprint'),
        valGoalFootprint: document.getElementById('valGoalFootprint'),
        valFootprintStatus: document.getElementById('valFootprintStatus'),

        calculatorForm: document.getElementById('calculatorForm'),
        calcCarMiles: document.getElementById('calcCarMiles'),
        calcEvMiles: document.getElementById('calcEvMiles'),
        calcTransitMiles: document.getElementById('calcTransitMiles'),
        calcFlightHours: document.getElementById('calcFlightHours'),
        calcElectricity: document.getElementById('calcElectricity'),
        calcSolar: document.getElementById('calcSolar'),
        calcGas: document.getElementById('calcGas'),
        calcHousehold: document.getElementById('calcHousehold'),
        calcDietType: document.getElementById('calcDietType'),
        calcLocalFood: document.getElementById('calcLocalFood'),
        calcShopping: document.getElementById('calcShopping'),
        calcRecycle: document.getElementById('calcRecycle'),

        barTransport: document.getElementById('barTransport'),
        barEnergy: document.getElementById('barEnergy'),
        barFood: document.getElementById('barFood'),
        barWaste: document.getElementById('barWaste'),

        labelTransportCo2: document.getElementById('labelTransportCo2'),
        labelTransportPct: document.getElementById('labelTransportPct'),
        labelEnergyCo2: document.getElementById('labelEnergyCo2'),
        labelEnergyPct: document.getElementById('labelEnergyPct'),
        labelFoodCo2: document.getElementById('labelFoodCo2'),
        labelFoodPct: document.getElementById('labelFoodPct'),
        labelWasteCo2: document.getElementById('labelWasteCo2'),
        labelWastePct: document.getElementById('labelWastePct'),

        recommendationsContainer: document.getElementById('recommendationsContainer'),

        coachAdviceBox: document.getElementById('coachAdviceBox'),
        btnRequestAiDeep: document.getElementById('btnRequestAiDeep'),
        cacheStatusBadge: document.getElementById('cacheStatusBadge'),

        historyChartContainer: document.getElementById('historyChartContainer'),
        btnClearHistory: document.getElementById('btnClearHistory'),

        srStepAnnouncer: document.getElementById('srStepAnnouncer'),
        srPledgeAnnouncer: document.getElementById('srPledgeAnnouncer'),
        
        appToast: document.getElementById('appToast')
    };

    App.DOM = DOM;

    // Toast helper
    const toastEl = (() => {
        let el = document.getElementById('appToast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'appToast';
            el.className = 'app-toast';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            document.body.appendChild(el);
        }
        return el;
    })();

    let toastTimer = null;

    /**
     * Shows a toast notification message on screen.
     *
     * @param {string} msg - Message to display inside toast notification
     * @returns {void}
     */
    function showToast(msg) {
        toastEl.textContent = msg;
        toastEl.classList.add('app-toast--visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toastEl.classList.remove('app-toast--visible');
        }, 3000);
    }

    /**
     * Updates the text content and visual state of the Cache Status Badge.
     *
     * @param {string} text - Label to show in badge
     * @param {string} stateClass - Style state class class names to apply
     * @returns {void}
     */
    function setBadgeState(text, stateClass) {
        DOM.cacheStatusBadge.textContent = text;
        DOM.cacheStatusBadge.classList.remove(
            'badge-uncached', 'badge-outdated', 'badge-cached',
            'badge-syncing', 'badge-local', 'badge-gemini', 'badge-error'
        );
        DOM.cacheStatusBadge.classList.add(stateClass);
    }

    /**
     * Announces a message to screen readers using accessibility live regions.
     *
     * @param {HTMLElement} regionEl - Target element containing the live region
     * @param {string} msg - Message to announce to assistive technologies
     * @returns {void}
     */
    function announceToSR(regionEl, msg) {
        if (!regionEl) return;
        regionEl.textContent = '';
        requestAnimationFrame(() => { regionEl.textContent = msg; });
    }

    const ModalManager = {
        activeModal: null,
        previousActiveElement: null,

        /**
         * Opens a WCAG accessible modal overlay and traps keyboard tab focus.
         *
         * @param {HTMLElement} modalEl - Target modal overlay element to reveal
         * @returns {void}
         */
        open(modalEl) {
            if (this.activeModal) this.close(this.activeModal);
            this.previousActiveElement = document.activeElement;
            this.activeModal = modalEl;
            modalEl.classList.add('active');
            requestAnimationFrame(() => {
                const focusables = modalEl.querySelectorAll('button, input, select, textarea, a');
                if (focusables.length > 0) focusables[0].focus();
            });
        },

        /**
         * Closes an active modal overlay and restores keyboard focus.
         *
         * @param {HTMLElement} modalEl - Target modal overlay element to close
         * @returns {void}
         */
        close(modalEl) {
            modalEl.classList.remove('active');
            if (this.activeModal === modalEl) {
                this.activeModal = null;
            }
            if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
                this.previousActiveElement.focus();
            }
        },

        /**
         * Handles keyboard keydowns to implement modal focus trapping loops.
         *
         * @param {KeyboardEvent} e - Keyboard event
         * @returns {void}
         */
        handleKeyDown(e) {
            if (!this.activeModal) return;
            if (e.key === 'Escape' && this.activeModal.id !== 'onboardingModal') {
                this.close(this.activeModal);
                e.preventDefault();
                return;
            }
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

    document.addEventListener('keydown', (e) => ModalManager.handleKeyDown(e));

    /**
     * Escapes HTML characters to secure insertions against XSS payloads.
     *
     * @param {string} str - Raw unsafe string to sanitise
     * @returns {string} Escaped safe string content
     */
    function escapeHtml(str) {
        if (typeof str !== 'string') return String(str);
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    App.UI = {
        showToast,
        setBadgeState,
        announceToSR,
        ModalManager,
        escapeHtml
    };
})();
