import { formatPrice, formatLargeNumber } from '../utils/formatters.js';

/**
 * Clasa pentru gestionarea ferestrei modale.
 */
export class ModalManager {
    constructor(chartRenderer) {
        this.modal = document.getElementById("coinModal");
        this.chartRenderer = chartRenderer;
        
        // Doar setup listeners dacă modalul existe
        if (this.modal) {
            this.setupListeners();
        } else {
            console.warn('Modal element #coinModal not found in DOM');
        }
    }

    setupListeners() {
        // Închide la click pe X
        const closeBtn = this.modal.querySelector(".close-button");
        if (closeBtn) {
            closeBtn.onclick = () => this.closeModal();
        }

        // Închide la click în afara modalului
        window.onclick = (event) => {
            if (event.target == this.modal) {
                this.closeModal();
            }
        };
    }

    closeModal() {
        this.modal.style.display = "none";
        this.chartRenderer.destroyModalChart(); // Curăță graficul
    }

    /**
     * Afișează modalul cu datele monedei selectate.
     * @param {object} coinData - Obiectul complet cu datele monedei.
     */
    async showModal(coinData) {
        const titleElement = document.getElementById("modal-coin-title");
        const statsElement = document.getElementById("modal-stats");
        const highLowElement = document.getElementById("high-low-data");
        const linksElement = document.getElementById("modal-links");
        const chartContainer = document.getElementById("modal-chart-container");
        
        // 1. Extrage date
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

        // Resetăm containerul de grafic 
        chartContainer.innerHTML = '<div id="modalChart"></div>';
        
        // 2. Populează Antet (Header)
        titleElement.innerHTML = `
            <img src="${iconUrl}" alt="${name} logo" width="36" height="36" style="vertical-align: middle;">
            ${name} (${symbol})
        `;

        // 3. Populează Statistici Cheie
        statsElement.innerHTML = `
            <div class="stat-item">
                <div class="stat-label">Preț</div>
                <div class="stat-value">€${formatPrice(price)}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Schimb 24h</div>
                <div class="stat-value ${isPositive ? 'positive' : 'negative'}">${change24h.toFixed(2)}%</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Market Cap.</div>
                <div class="stat-value">€${formatLargeNumber(marketCap)}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Volum 24h</div>
                <div class="stat-value">€${formatLargeNumber(volume24h)}</div>
            </div>
        `;
        
        // 4. Populează Vârf & Bază (High/Low)
        highLowElement.innerHTML = `
            <div class="stat-item">
                <div class="stat-label">Vârf 24h (MAX)</div>
                <div class="stat-value positive">€${formatPrice(high24h)}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Bază 24h (MIN)</div>
                <div class="stat-value negative">€${formatPrice(low24h)}</div>
            </div>
        `;

        // 5. Populează Link-uri Utile
        const siteUrl = `https://www.cryptocompare.com/coins/${symbol.toLowerCase()}/overview`;
        linksElement.querySelector('.link-list').innerHTML = `
            <a href="${siteUrl}" target="_blank" class="simulated-link">Website Oficial</a>
        `;

        // 6. Afișează modalul
        this.modal.style.display = "block";

        // 7. Încarcă Graficul (24H)
        // Folosim setTimeout pentru a ne asigura că modalul este vizibil și elementul DOM este gata
        setTimeout(async () => {
            const historyData = await this.chartRenderer.loadHistoryData(symbol, true);
            if (historyData.length > 0) {
                this.chartRenderer.renderModalChart('modalChart', historyData, isPositive);
            } else {
                 document.getElementById('modalChart').innerHTML = '<p style="color: #8B949E; text-align: center;">Nu s-au putut încărca datele istorice pentru 24 de ore.</p>';
            }
        }, 50);
    }
}