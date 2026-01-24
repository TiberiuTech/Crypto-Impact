import { formatPrice, formatLargeNumber } from '../utils/formatters.js';

export class ModalManager {
    constructor(chartRenderer) {
        this.modal = document.getElementById("coinModal");
        this.chartRenderer = chartRenderer;
        
        if (this.modal) {
            this.setupListeners();
        } else {
            console.warn('Modal element #coinModal not found in DOM');
        }
    }

    setupListeners() {
        const closeBtn = this.modal.querySelector(".close-button");
        if (closeBtn) {
            closeBtn.onclick = () => this.closeModal();
        }

        window.onclick = (event) => {
            if (event.target == this.modal) {
                this.closeModal();
            }
        };
    }

    closeModal() {
        this.modal.style.display = "none";
        this.chartRenderer.destroyModalChart();
    }

    async showModal(coinData) {
        const titleElement = document.getElementById("modal-coin-title");
        const statsElement = document.getElementById("modal-stats");
        const highLowElement = document.getElementById("high-low-data");
        const linksElement = document.getElementById("modal-links");
        const chartContainer = document.getElementById("modal-chart-container");
        
        const coinInfo = coinData.CoinInfo;
        const rawData = coinData.RAW.EUR;

        const name = coinInfo.FullName;
        const symbol = coinInfo.Name;
        const iconUrl = `https://www.cryptocompare.com${coinInfo.ImageUrl}`; 
        
        const price = rawData.PRICE;
        const high24h = rawData.HIGH24HOUR; 
        const low24h = rawData.LOW24HOUR;   
        const marketCap = rawData.MKTCAP;
        const volume24h = rawData.TOTALVOLUME24H;
        const change24h = rawData.CHANGEPCT24HOUR;
        const isPositive = change24h > 0;

        chartContainer.innerHTML = '<div id="modalChart"></div>';
        
        titleElement.innerHTML = `
            <img src="${iconUrl}" alt="${name} logo" width="36" height="36" style="vertical-align: middle;">
            ${name} (${symbol})
        `;

        statsElement.innerHTML = `
            <div class="stat-item">
                <div class="stat-label">Price</div>
                <div class="stat-value">€${formatPrice(price)}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Change 24h</div>
                <div class="stat-value ${isPositive ? 'positive' : 'negative'}">${change24h.toFixed(2)}%</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Market Cap</div>
                <div class="stat-value">€${formatLargeNumber(marketCap)}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Volume 24h</div>
                <div class="stat-value">€${formatLargeNumber(volume24h)}</div>
            </div>
        `;
        
                highLowElement.innerHTML = `
            <div class="stat-item">
                <div class="stat-label">High 24h (MAX)</div>
                <div class="stat-value positive">€${formatPrice(high24h)}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Low 24h (MIN)</div>
                <div class="stat-value negative">€${formatPrice(low24h)}</div>
            </div>
        `;

        const siteUrl = `https://www.cryptocompare.com/coins/${symbol.toLowerCase()}/overview`;
        linksElement.querySelector('.link-list').innerHTML = `
            <a href="${siteUrl}" target="_blank" class="simulated-link">Official Website</a>
        `;

        this.modal.style.display = "block";

        setTimeout(async () => {
            const historyData = await this.chartRenderer.loadHistoryData(symbol, true);
            if (historyData.length > 0) {
                this.chartRenderer.renderModalChart('modalChart', historyData, isPositive);
            } else {
                 document.getElementById('modalChart').innerHTML = '<p style="color: #8B949E; text-align: center;">Could not load historical data for 24 hours.</p>';
            }
        }, 50);
    }
}