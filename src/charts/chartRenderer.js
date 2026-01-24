import { formatPrice } from '../utils/formatters.js';

export class ChartRenderer {
    constructor() {
        this.modalChart = null;
        this.HISTORY_URL = 'http://localhost:3000/api/history';
        this.LIMIT_1H = 59; 
        this.LIMIT_SPARKLINE = 59; 
    }

    /**
     * @param {number} ms 
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * @param {string} symbol 
     * @param {boolean} isModal 
     * @returns {Promise<Array<number>>} 
     */
    async loadHistoryData(symbol, isModal) {
        const delayMs = 1000;
        await this.delay(delayMs); 
        
        const limit = isModal ? this.LIMIT_1H : this.LIMIT_SPARKLINE;
        const historyUrl = `${this.HISTORY_URL}?symbol=${symbol}&limit=${limit}`;

        try {
            const response = await fetch(historyUrl);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Error at fetch (${symbol}): ${response.status} - ${errorText.substring(0, 100)}...`);
                return [];
            }
            
            const historyData = await response.json(); 
            
            if (!Array.isArray(historyData) || historyData.length === 0) {
                 console.warn(`No historical data available for ${symbol}.`);
                 return [];
            }
            return historyData;

        } catch (error) {
            console.error(`Error at loading history for ${symbol}:`, error);
            return [];
        }
    }

    /**
     * @param {string} chartId 
     * @param {Array<number>} data 
     * @param {boolean} isPositive 
     */
    renderSparkline(chartId, data, isPositive) {
        const color = isPositive ? '#34d399' : '#f87171';

        const options = {
            series: [{ data: data }],
            chart: {
                type: 'line',
                height: 60, 
                width: 100, 
                sparkline: { enabled: true }
            },
            stroke: { curve: 'smooth', width: 2 },
            colors: [color], 
            tooltip: {
                enabled: true, 
                theme: 'dark', 
                x: { show: false },
                y: {
                    formatter: (value) => '€' + formatPrice(value)
                },
                custom: ({ series, seriesIndex, dataPointIndex }) => {
                    const value = series[seriesIndex][dataPointIndex];
                    return `<div style="padding: 4px 8px; font-weight: bold; background-color: #1f252b; border-radius: 4px;">€${formatPrice(value)}</div>`;
                }
            },
            markers: { size: 0, hover: { size: 4 } }
        };

        if (chartId.startsWith('carousel-chart')) {
            options.chart.height = 30;
            options.chart.width = '100%';
        }


        const chartElement = document.getElementById(chartId);
        if (chartElement) {
            const chart = new ApexCharts(chartElement, options);
            chart.render();
        }
    }
    
    /**
     * Randează graficul mare (1H) în modal.
     * @param {string} containerId - ID-ul containerului 'modalChart'.
     * @param {Array<number>} data - Datele de preț.
     * @param {boolean} isPositive - Dacă trendul este pozitiv.
     */
    renderModalChart(containerId, data, isPositive) {
        // Graficul mare folosește acum date pe 1 oră.
        const color = isPositive ? '#34d399' : '#f87171';

        const options = {
            series: [{ name: "Preț", data: data }],
            chart: {
                type: 'area',
                height: 300, 
                toolbar: { show: false }, // Ascunde meniul/bara de instrumente
                id: 'modalChartInstance'
            },
            dataLabels: { enabled: false },
            stroke: { curve: 'smooth', width: 3 },
            fill: { type: 'gradient', gradient: { opacityFrom: 0.5, opacityTo: 0 } },
            colors: [color], 
            grid: { borderColor: '#30363D' },
            xaxis: { labels: { show: false } }, // Fără etichete pe axa X
            yaxis: {
                labels: {
                    formatter: (val) => '€' + formatPrice(val),
                    style: { colors: '#8B949E' }
                }
            },
            tooltip: {
                enabled: true, 
                theme: 'dark', 
                x: { show: false },
                y: { formatter: (value) => '€' + formatPrice(value) }
            }
        };

        const chartContainer = document.getElementById(containerId);
        if (chartContainer) {
            if (this.modalChart) {
                 this.modalChart.destroy();
            }
            this.modalChart = new ApexCharts(chartContainer, options);
            this.modalChart.render();
        }
    }

    /**
     * Distruge graficul modal pentru a preveni bug-uri de re-render.
     */
    destroyModalChart() {
        if (this.modalChart) {
            this.modalChart.destroy();
            this.modalChart = null;
        }
    }
}