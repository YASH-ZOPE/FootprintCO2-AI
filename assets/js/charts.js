/**
 * History Chart Renderer Module — FootprintCO2 AI
 */

"use strict";

window.App = window.App || {};

(function() {
    // Setting immutable constants
    const CHART_MIN_HEIGHT_PERCENT = 8;
    const CHART_SCALE_FACTOR = 85;

    /**
     * Renders and updates the historical carbon footprint bar chart.
     * Uses document fragments for performance and caps height metrics.
     *
     * @returns {void}
     */
    function updateHistoryChart() {
        const history = App.State.history;
        const DOM = App.DOM;

        // If history length has not changed, update the last bar only (reduces layout thrashing on slide)
        if (history.length === App.State.lastRenderedHistoryLength && history.length > 0) {
            const lastEntry = history[history.length - 1];
            const maxCo2 = Math.max(1.0, ...history.map(h => h.total));
            const percentHeight = Math.max(
                CHART_MIN_HEIGHT_PERCENT,
                (lastEntry.total / maxCo2) * CHART_SCALE_FACTOR
            );

            const lastBarFill = DOM.historyChartContainer.querySelector('.chart-bar-wrapper:last-child .chart-bar-fill');
            if (lastBarFill) {
                lastBarFill.style.height = `${percentHeight}%`;
                const tooltip = lastBarFill.querySelector('.chart-bar-tooltip');
                if (tooltip) {
                    tooltip.textContent = `${lastEntry.total.toFixed(1)} tonnes`;
                }
            }
            return;
        }

        App.State.lastRenderedHistoryLength = history.length;
        DOM.historyChartContainer.innerHTML = '';

        if (history.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'chart-empty';
            emptyMsg.textContent = 'No logs available. Use sliders to record footprints.';
            DOM.historyChartContainer.appendChild(emptyMsg);
            return;
        }

        const maxCo2 = Math.max(1.0, ...history.map(h => h.total));

        // Create document fragment for optimal DOM performance
        const fragment = document.createDocumentFragment();

        const dateFormatter = new Intl.DateTimeFormat('en-IN', {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC'
        });

        for (const h of history) {
            const barWrapper = document.createElement('div');
            barWrapper.className = 'chart-bar-wrapper';
            barWrapper.setAttribute('tabindex', '0');

            const dateObj = new Date(h.date);
            const shortDate = dateFormatter.format(dateObj);

            const percentHeight = Math.max(
                CHART_MIN_HEIGHT_PERCENT,
                (h.total / maxCo2) * CHART_SCALE_FACTOR
            );

            const barFill = document.createElement('div');
            barFill.className = 'chart-bar-fill';
            barFill.style.height = `${percentHeight}%`;
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
            fragment.appendChild(barWrapper);
        }

        DOM.historyChartContainer.appendChild(fragment);
    }

    App.Charts = {
        updateHistoryChart
    };
})();
