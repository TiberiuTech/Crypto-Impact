import { formatPrice, formatLargeNumber } from '../../utils/formatters.js';

let marketData = {};
let charts = {};
let ws = null;

const MARKET_URL = 'http://localhost:3000/api/market';
const HISTORY_URL = 'http://localhost:3000/api/history';
const WS_URL = 'ws://localhost:4000';

const ORIONIX_DATA = {
    price: 1.25,
    change24h: 5.43,
    volume24h: 345678,
    marketCap: 1250000,
    priceHistory: []
};

document.addEventListener('DOMContentLoaded', () => {
    initializeOrionixData();
    loadMarketData();
    startWebSocket();
});

window.navigateToTrade = function(symbol) {
    const userData = localStorage.getItem('user');
    
    if (userData) {
        window.location.href = `/src/pages/trade/trade.html?symbol=${symbol}`;
    } else {
        window.location.href = '/src/pages/auth/login.html';
    }
};

function initializeOrionixData() {
    const now = Date.now();
    const basePrice = 1.25;
    
    for (let i = 60; i >= 0; i--) {
        const timestamp = now - i * 60000;
        const wave = Math.sin(i / 10) * 0.05;
        const randomNoise = (Math.random() - 0.5) * 0.02;
        const price = basePrice + wave + randomNoise;
        
        ORIONIX_DATA.priceHistory.push(parseFloat(price.toFixed(4)));
    }
    
    updateOrionixDisplay();
    renderOrionixChart();
    
    setInterval(updateOrionixPrice, 3000);
}

function updateOrionixPrice() {
    const changeFactor = (Math.random() - 0.5) * 0.002;
    ORIONIX_DATA.price = ORIONIX_DATA.price * (1 + changeFactor);
    ORIONIX_DATA.change24h = ORIONIX_DATA.change24h + (Math.random() - 0.5) * 0.1;
    
    ORIONIX_DATA.priceHistory.push(ORIONIX_DATA.price);
    if (ORIONIX_DATA.priceHistory.length > 60) {
        ORIONIX_DATA.priceHistory.shift();
    }
    
    updateOrionixDisplay();
    updateOrionixChart();
}

function updateOrionixDisplay() {
    const priceElement = document.getElementById('orionix-price');
    const changeElement = document.getElementById('orionix-change');
    const volumeElement = document.getElementById('orionix-volume');
    const marketCapElement = document.getElementById('orionix-marketcap');
    
    if (priceElement) {
        priceElement.textContent = `€${formatPrice(ORIONIX_DATA.price)}`;
    }
    
    if (changeElement) {
        const isPositive = ORIONIX_DATA.change24h > 0;
        changeElement.textContent = `${isPositive ? '+' : ''}${ORIONIX_DATA.change24h.toFixed(2)}%`;
        changeElement.className = `price-change ${isPositive ? 'positive' : 'negative'}`;
    }
    
    if (volumeElement) {
        volumeElement.textContent = `€${formatLargeNumber(ORIONIX_DATA.volume24h)}`;
    }
    
    if (marketCapElement) {
        marketCapElement.textContent = `€${formatLargeNumber(ORIONIX_DATA.marketCap)}`;
    }
}

function renderOrionixChart() {
    const chartElement = document.getElementById('orionix-chart');
    if (!chartElement) return;
    
    const isPositive = ORIONIX_DATA.change24h > 0;
    const color = isPositive ? '#2EA043' : '#F85149';
    
    const options = {
        series: [{
            name: 'Price',
            data: ORIONIX_DATA.priceHistory
        }],
        chart: {
            type: 'area',
            height: 150,
            sparkline: {
                enabled: true
            },
            animations: {
                enabled: true,
                easing: 'linear',
                dynamicAnimation: {
                    speed: 1000
                }
            }
        },
        stroke: {
            curve: 'smooth',
            width: 2
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.45,
                opacityTo: 0.05,
                stops: [0, 100]
            }
        },
        colors: [color],
        tooltip: {
            enabled: true,
            theme: 'dark',
            y: {
                formatter: function(value) {
                    return '€' + formatPrice(value);
                }
            }
        }
    };
    
    if (charts['orionix']) {
        charts['orionix'].destroy();
    }
    
    charts['orionix'] = new ApexCharts(chartElement, options);
    charts['orionix'].render();
}

function updateOrionixChart() {
    if (charts['orionix']) {
        const isPositive = ORIONIX_DATA.change24h > 0;
        const color = isPositive ? '#2EA043' : '#F85149';
        
        charts['orionix'].updateOptions({
            colors: [color]
        });
        
        charts['orionix'].updateSeries([{
            data: ORIONIX_DATA.priceHistory
        }]);
    }
}

async function loadMarketData() {
    try {
        const response = await fetch(MARKET_URL);
        
        if (!response.ok) {
            throw new Error('Error at loading market data');
        }
        
        const data = await response.json();
        const coins = data.Data;
        
        if (!Array.isArray(coins) || coins.length === 0) {
            throw new Error('Market data is empty');
        }
        
        const filteredCoins = coins.filter(coin => 
            coin.RAW && coin.RAW.EUR && (coin.CoinInfo.Name === 'BTC' || coin.CoinInfo.Name === 'ETH')
        );
        
        for (const coin of filteredCoins) {
            const symbol = coin.CoinInfo.Name;
            const data = coin.RAW.EUR;
            
            marketData[symbol] = {
                symbol: symbol,
                name: coin.CoinInfo.FullName,
                price: data.PRICE,
                change24h: data.CHANGEPCT24HOUR,
                volume24h: data.TOTALVOLUME24H,
                marketCap: data.MKTCAP,
                iconUrl: `https://www.cryptocompare.com${coin.CoinInfo.ImageUrl}`
            };
            
            updateCoinDisplay(symbol);
            
            await loadAndRenderChart(symbol);
            
            await delay(1000);
        }
        
    } catch (error) {
        console.error('Error at loading market data:', error);
    }
}

function updateCoinDisplay(symbol) {
    const coin = marketData[symbol];
    if (!coin) return;
    
    const lowerSymbol = symbol.toLowerCase();
    
    const priceElement = document.getElementById(`${lowerSymbol}-price`);
    if (priceElement) {
        priceElement.textContent = `€${formatPrice(coin.price)}`;
    }
    
    const changeElement = document.getElementById(`${lowerSymbol}-change`);
    if (changeElement) {
        const isPositive = coin.change24h > 0;
        changeElement.textContent = `${isPositive ? '+' : ''}${coin.change24h.toFixed(2)}%`;
        changeElement.className = `price-change ${isPositive ? 'positive' : 'negative'}`;
    }
    
    const volumeElement = document.getElementById(`${lowerSymbol}-volume`);
    if (volumeElement) {
        volumeElement.textContent = `€${formatLargeNumber(coin.volume24h)}`;
    }
    
    const marketCapElement = document.getElementById(`${lowerSymbol}-marketcap`);
    if (marketCapElement) {
        marketCapElement.textContent = `€${formatLargeNumber(coin.marketCap)}`;
    }
    
    const iconElement = document.getElementById(`${lowerSymbol}-icon`);
    if (iconElement && coin.iconUrl) {
        iconElement.src = coin.iconUrl;
    }
}

async function loadAndRenderChart(symbol) {
    try {
        const response = await fetch(`${HISTORY_URL}?symbol=${symbol}&limit=59`);
        
        if (!response.ok) {
            throw new Error(`Error at loading historical data for ${symbol}`);
        }
        
        const historyData = await response.json();
        
        if (!Array.isArray(historyData) || historyData.length === 0) {
            console.warn(`No historical data available for ${symbol}`);
            return;
        }
        
        renderChart(symbol, historyData);
        
    } catch (error) {
        console.error(`Error at loading chart for ${symbol}:`, error);
    }
}

function renderChart(symbol, data) {
    const lowerSymbol = symbol.toLowerCase();
    const chartElement = document.getElementById(`${lowerSymbol}-chart`);
    if (!chartElement) return;
    
    const coin = marketData[symbol];
    const isPositive = coin && coin.change24h > 0;
    const color = isPositive ? '#2EA043' : '#F85149';
    
    const options = {
        series: [{
            name: 'Price',
            data: data
        }],
        chart: {
            type: 'area',
            height: 150,
            sparkline: {
                enabled: true
            },
            animations: {
                enabled: true,
                easing: 'linear',
                dynamicAnimation: {
                    speed: 1000
                }
            }
        },
        stroke: {
            curve: 'smooth',
            width: 2
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.45,
                opacityTo: 0.05,
                stops: [0, 100]
            }
        },
        colors: [color],
        tooltip: {
            enabled: true,
            theme: 'dark',
            y: {
                formatter: function(value) {
                    return '€' + formatPrice(value);
                }
            }
        }
    };
    
    if (charts[symbol]) {
        charts[symbol].destroy();
    }
    
    charts[symbol] = new ApexCharts(chartElement, options);
    charts[symbol].render();
}

function startWebSocket() {
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
        console.log('WebSocket connected');
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
        } catch (error) {
            console.error('Error at parsing WebSocket message:', error);
        }
    };
    
    ws.onclose = () => {
        console.warn('WebSocket connection closed. Reconnecting in 5s...');
        setTimeout(startWebSocket, 5000);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

function updateLivePrice(symbol, newPrice, change24h) {
    if (symbol !== 'BTC' && symbol !== 'ETH') return;
    
    if (marketData[symbol]) {
        marketData[symbol].price = newPrice;
        marketData[symbol].change24h = change24h;
        
        updateCoinDisplay(symbol);
        
        if (charts[symbol]) {
            const isPositive = change24h > 0;
            const color = isPositive ? '#2EA043' : '#F85149';
            
            charts[symbol].updateOptions({
                colors: [color]
            });
        }
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}



