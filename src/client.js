import { formatPrice, formatLargeNumber } from './utils/formatters.js';
import { ChartRenderer } from './charts/chartRenderer.js';
import { ModalManager } from './ui/modalManager.js';

export let allMarketData = []; 
const chartRenderer = new ChartRenderer();
const modalElement = document.getElementById("coinModal");
const modalManager = modalElement ? new ModalManager(chartRenderer) : null; 

let carouselInterval = null;
const CAROUSEL_SPEED_MS = 30;
const CAROUSEL_COIN_COUNT = 10;

let chartQueue = [];

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("crypto-table-body")) {
        loadMarketData();
        setupTableListeners();
        startWebSocketForLivePrices();
    }
});

function startWebSocketForLivePrices() {
    const ws = new WebSocket('ws://localhost:4000');
    
    ws.onopen = () => {
    };

    ws.onmessage = (event) => {
        try {
            const updates = JSON.parse(event.data);
            if (Array.isArray(updates)) {
                updates.forEach(update => {
                    if (update && update.symbol && update.price) {
                        updateLivePrice(update.symbol, update.price, update.change24h);
                    }
                });
            }
        } catch (e) {
            console.error('Error at parsing WebSocket message:', e);
        }
    };

    ws.onclose = () => {
        console.warn('WebSocket connection closed. Attempting to reconnect in 5s...');
        setTimeout(startWebSocketForLivePrices, 5000);
    };

    ws.onerror = (error) => {
        console.error('Eroare WebSocket:', error);
    };
}

function updateLivePrice(symbol, newPrice, change24h) {
    const isPositive = change24h > 0;
    const trendClass = isPositive ? 'positive' : 'negative';
    
    const formattedPrice = `€${formatPrice(newPrice)}`;
    const formattedChange = `${change24h.toFixed(2)}%`;

    const tableRow = document.querySelector(`#crypto-table-body tr[data-symbol="${symbol}"]`);
    if (tableRow) {
        const priceCell = tableRow.querySelector('td:nth-child(3)');
        if (priceCell) priceCell.textContent = formattedPrice;

        const changeCell = tableRow.querySelector('td:nth-child(4)');
        if (changeCell) {
            changeCell.textContent = formattedChange;
            changeCell.className = trendClass;
        }
    }

    const carouselItem = document.querySelector(`#price-carousel-wrapper .carousel-item[data-symbol="${symbol}"]`);
    if (carouselItem) {
        carouselItem.querySelector('.price').textContent = formattedPrice;
        
        const changeElement = carouselItem.querySelector('.change');
        if (changeElement) {
             changeElement.textContent = formattedChange;
             changeElement.className = `change ${trendClass}`;
        }
    }
}


async function processChartQueue() {
    const request = chartQueue.shift();

    if (!request) {
        return;
    }

    const { symbol, chartId, isPositive } = request;

    const historyData = await chartRenderer.loadHistoryData(symbol, false); 
    
    if (historyData.length > 0) {
        chartRenderer.renderSparkline(chartId, historyData, isPositive);
    } else {
        const element = document.getElementById(chartId);
        if (element) element.innerHTML = '<span class="no-data">N/A</span>';
    }

    processChartQueue();
}


async function loadMarketData() {
    const marketUrl = 'http://localhost:3000/api/market';
    const tableBody = document.getElementById("crypto-table-body");
    const carouselContainer = document.getElementById("price-carousel"); 
    
    if (tableBody) tableBody.innerHTML = ''; 
    if (carouselContainer) carouselContainer.innerHTML = '';

    try {
        const response = await fetch(marketUrl);
        
        if (!response.ok) {
            throw new Error(`Proxy server did not respond correctly: ${response.status}. Make sure 'node server.js' is running.`);
        }
        
        const data = await response.json();
        const coins = data.Data;

        if (!Array.isArray(coins) || coins.length === 0) {
             throw new Error("Market data is empty. Check the CryptoCompare API key.");
        }
        
        const filteredCoins = coins.filter(coin => coin.RAW && coin.RAW.EUR);

        allMarketData = filteredCoins; 
        chartQueue = []; 

        if (carouselContainer) {
            renderPriceCarouselStructure(filteredCoins.slice(0, CAROUSEL_COIN_COUNT));
            const carouselCoins = filteredCoins.slice(0, CAROUSEL_COIN_COUNT);
            // Adăugăm grafice pentru prima jumătate
            carouselCoins.forEach((coin, index) => {
                chartQueue.push({ 
                    symbol: coin.CoinInfo.Name, 
                    chartId: `carousel-chart-${coin.CoinInfo.Name}-${index}`, 
                    isPositive: coin.RAW.EUR.CHANGEPCT24HOUR > 0 
                });
            });
            // Adăugăm grafice pentru a doua jumătate (duplicate)
            carouselCoins.forEach((coin, index) => {
                chartQueue.push({ 
                    symbol: coin.CoinInfo.Name, 
                    chartId: `carousel-chart-${coin.CoinInfo.Name}-${CAROUSEL_COIN_COUNT + index}`, 
                    isPositive: coin.RAW.EUR.CHANGEPCT24HOUR > 0 
                });
            });
        }

        filteredCoins.forEach((coin, index) => {
            const coinInfo = coin.CoinInfo;
            const displayData = coin.RAW.EUR; 

            const rank = index + 1; 
            const name = coinInfo.FullName;
            const symbol = coinInfo.Name;
            const iconUrl = `https://www.cryptocompare.com${coinInfo.ImageUrl}`; 
            
            const price = displayData.PRICE;
            const change24h = displayData.CHANGEPCT24HOUR;
            const volume24h = displayData.TOTALVOLUME24H;
            const marketCap = displayData.MKTCAP;
            
            const chartId = `chart-${symbol}`;

            const row = document.createElement('tr');
            row.setAttribute('data-symbol', symbol); 
            row.setAttribute('data-index', index);
            
            row.innerHTML = `
                <td>${rank}</td>
                <td>
                    <img src="${iconUrl}" alt="${name} logo" width="24" height="24" style="margin-right: 8px; vertical-align: middle;">
                    ${name} (${symbol})
                </td>
                
                <td>€${formatPrice(price)}</td>
                <td class="${change24h > 0 ? 'positive' : 'negative'}">${change24h.toFixed(2)}%</td>
                <td>€${formatLargeNumber(volume24h)}</td>
                <td>€${formatLargeNumber(marketCap)}</td>
                
                <td>
                    <div class="sparkline" id="${chartId}"></div>
                </td>
                
                <td>
                    <button class="trade-button" data-symbol="${symbol}">Trade</button>
                </td>
            `;
            
            if (tableBody) tableBody.appendChild(row);

            chartQueue.push({ 
                symbol: symbol, 
                chartId: chartId, 
                isPositive: change24h > 0 
            });
        });

        processChartQueue();


    } catch (error) {
            console.error("Error at loading market data:", error);
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="8">Error: ${error.message}. Check the proxy server.</td></tr>`;
    }
}


function renderPriceCarouselStructure(coins) {
    const carouselWrapper = document.getElementById("price-carousel");
    if (!carouselWrapper) return;

    const innerContainer = document.createElement('div');
    innerContainer.className = 'carousel-inner';
    carouselWrapper.appendChild(innerContainer);

    coins.forEach((coin, index) => {
        const coinInfo = coin.CoinInfo;
        const displayData = coin.RAW.EUR; 
        
        const price = displayData.PRICE;
        const change24h = displayData.CHANGEPCT24HOUR;
        const isPositive = change24h > 0;
        const trendClass = isPositive ? 'positive' : 'negative';
        
        const carouselItem = document.createElement('div');
        carouselItem.className = 'carousel-item';
        carouselItem.setAttribute('data-symbol', coinInfo.Name); 
        carouselItem.setAttribute('data-index', index); 
        
        const sparklineId = `carousel-chart-${coinInfo.Name}-${index}`;

        carouselItem.innerHTML = `
            <div class="coin-info">
                <img src="https://www.cryptocompare.com${coinInfo.ImageUrl}" alt="${coinInfo.Name} logo" width="20" height="20">
                <span class="symbol">${coinInfo.Name}</span>
            </div>
            <div class="price-info">
                <span class="price">€${formatPrice(price)}</span>
                <span class="change ${trendClass}">${change24h.toFixed(2)}%</span>
            </div>
            <div class="carousel-sparkline" id="${sparklineId}"></div>
        `;

        innerContainer.appendChild(carouselItem);
    });

    // Duplicăm conținutul și generăm ID-uri unice pentru duplicate
    const firstHalf = innerContainer.innerHTML;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = firstHalf;
    
    // Modificăm ID-urile pentru duplicate
    tempDiv.querySelectorAll('.carousel-sparkline').forEach((element, index) => {
        const originalId = element.id;
        const symbol = originalId.replace('carousel-chart-', '').split('-')[0];
        element.id = `carousel-chart-${symbol}-${coins.length + index}`;
    });
    
    innerContainer.innerHTML += tempDiv.innerHTML;

    startCarouselScroll(carouselWrapper);
    setupCarouselInteraction(carouselWrapper);
}

function startCarouselScroll(wrapper) {
    const inner = wrapper.querySelector('.carousel-inner');
    if (!inner) return;

    const scrollFunc = () => {
        if (wrapper.scrollLeft >= inner.scrollWidth / 2) {
            wrapper.scrollLeft -= inner.scrollWidth / 2;
        } else {
            wrapper.scrollLeft += 1;
        }
    };
    
    clearInterval(carouselInterval);
    carouselInterval = setInterval(scrollFunc, CAROUSEL_SPEED_MS);
}

function setupCarouselInteraction(wrapper) {
    wrapper.addEventListener('mouseenter', () => clearInterval(carouselInterval));
    wrapper.addEventListener('mouseleave', () => startCarouselScroll(wrapper));
    
    wrapper.addEventListener('click', function(event) {
        const item = event.target.closest('.carousel-item');
        if (item) {
            const index = item.getAttribute('data-index');
            
            if (allMarketData[index]) {
                 if (modalManager) {
                    modalManager.showModal(allMarketData[index]);
                 }
            }
        }
    });
}

function setupTableListeners() {
    const tableBody = document.getElementById("crypto-table-body");
    if (tableBody) {
        tableBody.addEventListener('click', function(event) {
            let row = event.target.closest('tr');
            
            const tradeButton = event.target.closest('.trade-button');
            if (tradeButton) {
                const symbol = tradeButton.getAttribute('data-symbol');
                handleTradeButtonClick(symbol);
                return;
            }
            
            if (row && !tradeButton) {
                const index = row.getAttribute('data-index');
                
                if (allMarketData[index]) {
                    const coinData = allMarketData[index];
                    if (modalManager) {
                       modalManager.showModal(coinData);
                    }
                }
            }
        });
    }
}

function handleTradeButtonClick(symbol) {
    const userData = localStorage.getItem('user');
    
    if (userData) {
        window.location.href = `/src/pages/trade/trade.html?symbol=${symbol}`;
    } else {
        window.location.href = '/src/pages/auth/login.html';
    }
}