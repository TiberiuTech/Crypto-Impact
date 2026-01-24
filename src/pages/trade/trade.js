import { formatPrice } from '../../utils/formatters.js';
import { allMarketData } from '../../client.js';
import { ChartRenderer } from '../../charts/chartRenderer.js';

function getStorageKeys() {
    const userData = localStorage.getItem('user');
    let userId = 'anonymous';
    
    if (userData) {
        try {
            const user = JSON.parse(userData);
            userId = user.uid || 'anonymous';
        } catch (error) {
            console.error('Error at parsing user data:', error);
        }
    }
    
    return {
        balance: `orionix_wallet_balance_${userId}`,
        assets: `orionix_wallet_assets_${userId}`,
        limitOrders: `orionix_limit_orders_${userId}`,
        tradeHistory: `orionix_trade_history_${userId}`
    };
}

let currentBalance = 0;
let userAssets = [];
let limitOrders = [];
let tradeHistory = [];
let selectedCoin = null;
let chartInstance = null;
let chartRenderer = new ChartRenderer();
let priceUpdateInterval = null;

const MARKET_URL = 'http://localhost:3000/api/market';

document.addEventListener('DOMContentLoaded', () => {
    loadWalletData();
    loadLimitOrders();
    loadTradeHistory();
    setupEventListeners();
    loadMarketData();
    startPriceMonitoring();
    
    const urlParams = new URLSearchParams(window.location.search);
    const symbolParam = urlParams.get('symbol');
    if (symbolParam) {
        setTimeout(() => autoSelectCoin(symbolParam), 1000);
    }
});

window.addEventListener('storage', function(e) {
    if (e.key === 'user') {
        loadWalletData();
        loadLimitOrders();
        loadTradeHistory();
    }
});

let lastUserId = null;
function checkUserChange() {
    const userData = localStorage.getItem('user');
    let currentUserId = 'anonymous';
    
    if (userData) {
        try {
            const user = JSON.parse(userData);
            currentUserId = user.uid || 'anonymous';
        } catch (error) {
        }
    }
    
    if (lastUserId !== null && lastUserId !== currentUserId) {
        loadWalletData();
        loadLimitOrders();
        loadTradeHistory();
    }
    
    lastUserId = currentUserId;
}

checkUserChange();

setInterval(checkUserChange, 1000);

function loadWalletData() {
    const storageKeys = getStorageKeys();
    const storedBalance = localStorage.getItem(storageKeys.balance);
    if (storedBalance) {
        currentBalance = parseFloat(storedBalance);
    } else {
        currentBalance = 0;
    }
    
    const storedAssets = localStorage.getItem(storageKeys.assets);
    if (storedAssets) {
        userAssets = JSON.parse(storedAssets);
    } else {
        userAssets = [];
    }
    
    updateBalanceDisplay();
    renderAssetsList();
}

function updateBalanceDisplay() {
    const balanceElement = document.getElementById('trade-balance');
    if (balanceElement) {
        balanceElement.textContent = currentBalance.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
}

function renderAssetsList() {
    const assetsList = document.getElementById('trade-assets-list');
    if (!assetsList) return;
    
    assetsList.innerHTML = '';
    
    if (userAssets.length === 0) {
        assetsList.innerHTML = '<p style="color: #8B949E; text-align: center; padding: 20px;">You have no available assets</p>';
        return;
    }
    
    userAssets.forEach(asset => {
        const assetItem = document.createElement('div');
        assetItem.className = 'asset-item';
        assetItem.setAttribute('data-symbol', asset.symbol);
        
        const value = asset.quantity * asset.currentPrice;
        
        assetItem.innerHTML = `
            <img src="${asset.iconUrl}" alt="${asset.symbol}" onerror="this.src='https://placehold.co/32x32/161B22/FFFFFF?text=?'">
            <div class="asset-item-info">
                <div class="asset-item-name">${asset.symbol}</div>
                <div class="asset-item-quantity">${asset.quantity.toFixed(6)}</div>
            </div>
            <div class="asset-item-value">€${formatPrice(value)}</div>
        `;
        
        assetItem.addEventListener('click', () => {
            selectAsset(asset);
        });
        
        assetsList.appendChild(assetItem);
    });
}

function selectAsset(asset) {
    document.querySelectorAll('.asset-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const selectedItem = document.querySelector(`[data-symbol="${asset.symbol}"]`);
    if (selectedItem) {
        selectedItem.classList.add('active');
    }
    
    const coin = allMarketData.find(c => c.CoinInfo.Name === asset.symbol);
    if (coin) {
        selectCoin(coin);
    }
}

async function loadMarketData() {
    try {
        const response = await fetch(MARKET_URL);
        const data = await response.json();
        const coins = data.Data.filter(coin => coin.RAW && coin.RAW.EUR);
        
        populateCoinSelector(coins);
    } catch (error) {
        console.error('Error at loading market data:', error);
    }
}

function populateCoinSelector(coins) {
    const select = document.getElementById('trade-coin-select');
    const optionsContainer = document.getElementById('trade-coin-select-options');
    const wrapper = document.getElementById('trade-coin-select-wrapper');
    const selectedDisplay = document.getElementById('trade-coin-select-selected');
    const selectedText = selectedDisplay.querySelector('.custom-coin-dropdown-text');
    const iconPreview = document.getElementById('trade-coin-icon-preview');
    
    if (!select || !optionsContainer || !wrapper) return;
    
    while (select.options.length > 1) {
        select.remove(1);
    }
    optionsContainer.innerHTML = '';
    
    coins.forEach(coin => {
        const symbol = coin.CoinInfo.Name;
        const fullName = coin.CoinInfo.FullName;
        const iconUrl = `https://www.cryptocompare.com${coin.CoinInfo.ImageUrl}`;
        
        const option = document.createElement('option');
        option.value = symbol;
        option.textContent = `${symbol} - ${fullName}`;
        option.setAttribute('data-coin', JSON.stringify(coin));
        select.appendChild(option);
        
        const customOption = document.createElement('div');
        customOption.className = 'custom-coin-dropdown-option';
        customOption.setAttribute('data-value', symbol);
        customOption.setAttribute('data-coin', JSON.stringify(coin));
        
        customOption.innerHTML = `
            <img src="${iconUrl}" alt="${symbol} icon" onerror="this.src='https://placehold.co/24x24/161B22/FFFFFF?text=?'">
            <div class="custom-coin-dropdown-option-content">
                <div class="custom-coin-dropdown-option-name">${fullName}</div>
                <div class="custom-coin-dropdown-option-symbol">${symbol}</div>
            </div>
        `;
        
        customOption.addEventListener('click', () => {
            const coinData = JSON.parse(customOption.getAttribute('data-coin'));
            selectCoin(coinData);
            
            selectedText.textContent = `${symbol} - ${fullName}`;
            iconPreview.src = iconUrl;
            iconPreview.style.display = 'block';
            iconPreview.onerror = function() {
                this.src = 'https://placehold.co/24x24/161B22/FFFFFF?text=?';
            };
            
                select.value = symbol;
            
            wrapper.classList.remove('active');
        });
        
        optionsContainer.appendChild(customOption);
    });
    
    if (!selectedDisplay.hasAttribute('data-listener-added')) {
        selectedDisplay.setAttribute('data-listener-added', 'true');
        selectedDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            wrapper.classList.toggle('active');
        });
    }
    
    if (!wrapper.hasAttribute('data-document-listener-added')) {
        wrapper.setAttribute('data-document-listener-added', 'true');
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                wrapper.classList.remove('active');
            }
        });
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const symbolParam = urlParams.get('symbol');
    
    if (!symbolParam) {
        const btcCoin = coins.find(c => c.CoinInfo.Name === 'BTC');
        if (btcCoin) {
            selectCoin(btcCoin);
            const btcIconUrl = `https://www.cryptocompare.com${btcCoin.CoinInfo.ImageUrl}`;
            selectedText.textContent = `BTC - ${btcCoin.CoinInfo.FullName}`;
            iconPreview.src = btcIconUrl;
            iconPreview.style.display = 'block';
            iconPreview.onerror = function() {
                this.src = 'https://placehold.co/24x24/161B22/FFFFFF?text=?';
            };
            select.value = 'BTC';
        }
    }
}

function selectCoin(coin) {
    selectedCoin = coin;
    const coinInfo = coin.CoinInfo;
    const rawData = coin.RAW.EUR;
    
    const coinInfoElement = document.getElementById('selected-coin-info');
    if (coinInfoElement) {
        coinInfoElement.innerHTML = `
            <strong>${coinInfo.FullName}</strong> (${coinInfo.Name})<br>
            Price: ${formatPrice(rawData.PRICE)} | 
            <span class="${rawData.CHANGEPCT24HOUR >= 0 ? 'positive' : 'negative'}">
                ${rawData.CHANGEPCT24HOUR >= 0 ? '+' : ''}${rawData.CHANGEPCT24HOUR.toFixed(2)}%
            </span>
        `;
    }
    
    const selectedText = document.querySelector('#trade-coin-select-selected .custom-coin-dropdown-text');
    const iconPreview = document.getElementById('trade-coin-icon-preview');
    const select = document.getElementById('trade-coin-select');
    const iconUrl = `https://www.cryptocompare.com${coinInfo.ImageUrl}`;
    
    if (selectedText) {
        selectedText.textContent = `${coinInfo.Name} - ${coinInfo.FullName}`;
    }
    
    if (iconPreview) {
        iconPreview.src = iconUrl;
        iconPreview.style.display = 'block';
        iconPreview.onerror = function() {
            this.src = 'https://placehold.co/24x24/161B22/FFFFFF?text=?';
        };
    }
    
    if (select) {
        select.value = coinInfo.Name;
    }
    
    const currentPrice = rawData.PRICE;
    document.getElementById('buy-price').value = currentPrice.toFixed(2);
    document.getElementById('sell-price').value = currentPrice.toFixed(2);
    
    window.currentCoinPrice = currentPrice;
    
    loadChart(coinInfo.Name, currentPrice, rawData.CHANGEPCT24HOUR >= 0);
    
    updateBuyForm();
    updateSellForm();
}

function setLimitPriceWithPercent(percent) {
    if (!selectedCoin || !window.currentCoinPrice) {
        showCustomAlert('Select a coin first!');
        return;
    }
    
    const currentPrice = window.currentCoinPrice;
    const newPrice = currentPrice * (1 + percent / 100);
    
    const limitPriceInput = document.getElementById('limit-price');
    if (limitPriceInput) {
        limitPriceInput.value = newPrice.toFixed(2);
    }
}

async function loadChart(symbol, currentPrice, isPositive) {
    const chartContainer = document.getElementById('trade-chart');
    if (!chartContainer) return;
    
    try {
        const historyData = await chartRenderer.loadHistoryData(symbol, false);
        
        if (historyData.length > 0) {
            if (chartInstance) {
                chartInstance.destroy();
            }
            
            const color = isPositive ? '#34d399' : '#f87171';
            
            const options = {
                series: [{
                    name: 'price',
                    data: historyData
                }],
                chart: {
                    type: 'area',
                    height: 400,
                    toolbar: { show: false },
                    animations: { enabled: false }
                },
                dataLabels: { enabled: false },
                stroke: { curve: 'smooth', width: 2 },
                fill: { type: 'gradient', gradient: { opacityFrom: 0.5, opacityTo: 0 } },
                colors: [color],
                grid: { borderColor: '#30363D' },
                xaxis: { labels: { show: false } },
                yaxis: {
                    labels: {
                        formatter: (val) => '€' + formatPrice(val),
                        style: { colors: '#8B949E' }
                    }
                },
                tooltip: {
                    theme: 'dark',
                    y: { formatter: (value) => '€' + formatPrice(value) }
                }
            };
            
            chartInstance = new ApexCharts(chartContainer, options);
            chartInstance.render();
        }
    } catch (error) {
        console.error('Error at loading chart:', error);
    }   
}

function setupEventListeners() {
    document.getElementById('buy-now-btn').addEventListener('click', () => {
        showBuyModal();
    });
    
    document.getElementById('sell-now-btn').addEventListener('click', () => {
        showSellModal();
    });
    
    document.getElementById('close-buy-modal').addEventListener('click', () => {
        closeBuyModal();
    });
    
    document.getElementById('close-sell-modal').addEventListener('click', () => {
        closeSellModal();
    });
    
    window.addEventListener('click', (e) => {
        const buyModal = document.getElementById('buy-modal');
        const sellModal = document.getElementById('sell-modal');
        if (e.target === buyModal) {
            closeBuyModal();
        }
        if (e.target === sellModal) {
            closeSellModal();
        }
    });
    
    document.getElementById('buy-quantity').addEventListener('input', updateBuyForm);
    document.getElementById('confirm-buy-btn').addEventListener('click', handleBuy);
    
    document.getElementById('sell-quantity').addEventListener('input', updateSellForm);
    document.getElementById('confirm-sell-btn').addEventListener('click', handleSell);
    
    document.getElementById('create-limit-order-btn').addEventListener('click', createLimitOrder);
    
    document.getElementById('limit-order-buy-btn').addEventListener('click', () => {
        selectOrderType('buy');
    });
    
    document.getElementById('limit-order-sell-btn').addEventListener('click', () => {
        selectOrderType('sell');
    });
    
    document.getElementById('price-minus-1').addEventListener('click', () => {
        setLimitPriceWithPercent(-1);
    });
    
    document.getElementById('price-plus-1').addEventListener('click', () => {
        setLimitPriceWithPercent(1);
    });
}

function selectOrderType(type) {
    const buyBtn = document.getElementById('limit-order-buy-btn');
    const sellBtn = document.getElementById('limit-order-sell-btn');
    
    if (type === 'buy') {
        buyBtn.classList.add('active');
        sellBtn.classList.remove('active');
    } else {
        sellBtn.classList.add('active');
        buyBtn.classList.remove('active');
    }
}

function getSelectedOrderType() {
    const buyBtn = document.getElementById('limit-order-buy-btn');
    return buyBtn.classList.contains('active') ? 'buy' : 'sell';
}

function showCustomAlert(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'custom-alert';
    alertDiv.textContent = message;
    alertDiv.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #FF5733;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        z-index: 3000;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease-out;
    `;
    
    if (!document.getElementById('alert-style')) {
        const style = document.createElement('style');
        style.id = 'alert-style';
        style.innerHTML = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            alertDiv.remove();
        }, 300);
    }, 3000);
}

function showBuyModal() {
    if (!selectedCoin) {
        showCustomAlert('Select a coin first!');
        return;
    }
    const modal = document.getElementById('buy-modal');
    modal.classList.add('show');
    document.getElementById('buy-quantity').value = '';
    updateBuyForm();
}

function closeBuyModal() {
    const modal = document.getElementById('buy-modal');
    modal.classList.remove('show');
    document.getElementById('buy-quantity').value = '';
    updateBuyForm();
}

function showSellModal() {
    if (!selectedCoin) {
        showCustomAlert('Select a coin first!');
        return;
    }
    
    const asset = userAssets.find(a => a.symbol === selectedCoin.CoinInfo.Name);
    if (!asset) {
        showCustomAlert('You don\'t have this coin in your wallet!');
        return;
    }
    
    const modal = document.getElementById('sell-modal');
    modal.classList.add('show');
    document.getElementById('sell-quantity').value = '';
    updateSellForm();
}

function closeSellModal() {
    const modal = document.getElementById('sell-modal');
    modal.classList.remove('show');
    document.getElementById('sell-quantity').value = '';
    updateSellForm();
}

function updateBuyForm() {
    const quantity = parseFloat(document.getElementById('buy-quantity').value) || 0;
    const price = parseFloat(document.getElementById('buy-price').value) || 0;
    const total = quantity * price;
    
    document.getElementById('buy-total').textContent = `€${formatPrice(total)}`;
}

function updateSellForm() {
    const quantity = parseFloat(document.getElementById('sell-quantity').value) || 0;
    const price = parseFloat(document.getElementById('sell-price').value) || 0;
    const total = quantity * price;
    
    document.getElementById('sell-total').textContent = `€${formatPrice(total)}`;
}

function handleBuy() {
    if (!selectedCoin) {
        showCustomAlert('Select a coin!');
        return;
    }
    
    const quantity = parseFloat(document.getElementById('buy-quantity').value);
    const price = parseFloat(document.getElementById('buy-price').value);
    const total = quantity * price;
    
    if (!quantity || quantity <= 0) {
        showCustomAlert('Enter a valid quantity!');
        return;
    }
    
    if (currentBalance < total) {
        showCustomAlert(`Insufficient funds! You need €${formatPrice(total)}, but you only have €${formatPrice(currentBalance)}.`);
        return;
    }
    
    currentBalance -= total;
    const storageKeys = getStorageKeys();
    localStorage.setItem(storageKeys.balance, currentBalance);
    updateBalanceDisplay();
    
    const symbol = selectedCoin.CoinInfo.Name;
    const assetIndex = userAssets.findIndex(a => a.symbol === symbol);
    const rawData = selectedCoin.RAW.EUR;
    
    if (assetIndex >= 0) {
        const existingAsset = userAssets[assetIndex];
        const totalValue = (existingAsset.quantity * existingAsset.currentPrice) + (quantity * price);
        const totalQuantity = existingAsset.quantity + quantity;
        const averagePrice = totalValue / totalQuantity;
        
        userAssets[assetIndex] = {
            ...existingAsset,
            quantity: totalQuantity,
            purchasePrice: averagePrice,
            currentPrice: price,
            change24h: rawData.CHANGEPCT24HOUR || 0
        };
    } else {
        userAssets.push({
            symbol: symbol,
            fullName: selectedCoin.CoinInfo.FullName,
            quantity: quantity,
            purchasePrice: price,
            currentPrice: price,
            change24h: rawData.CHANGEPCT24HOUR || 0,
            iconUrl: `https://www.cryptocompare.com${selectedCoin.CoinInfo.ImageUrl}`,
            purchaseDate: new Date().toISOString()
        });
    }
    
    localStorage.setItem(storageKeys.assets, JSON.stringify(userAssets));
    renderAssetsList();
    
    addTradeHistory('buy', symbol, quantity, price, total);
    
    document.getElementById('buy-quantity').value = '';
    updateBuyForm();
    closeBuyModal();
    
        openVerifyModal(`Purchase successful! ${quantity} ${symbol} for €${formatPrice(total)}`);
}

function handleSell() {
    if (!selectedCoin) {
        showCustomAlert('Select a coin!');
        return;
    }
    
    const symbol = selectedCoin.CoinInfo.Name;
    const asset = userAssets.find(a => a.symbol === symbol);
        
    if (!asset) {
        showCustomAlert("You don't have this coin in your wallet!");
        return;
    }
    
    const quantity = parseFloat(document.getElementById('sell-quantity').value);
    const price = parseFloat(document.getElementById('sell-price').value);
    const total = quantity * price;
    
    if (!quantity || quantity <= 0) {
        showCustomAlert('Enter a valid quantity!');
        return;
    }
    
    if (quantity > asset.quantity) {
        showCustomAlert(`You don't have enough ${symbol}! Available: ${asset.quantity.toFixed(6)}`);
        return;
    }
    
    currentBalance += total;
    const storageKeys = getStorageKeys();
    localStorage.setItem(storageKeys.balance, currentBalance);
    updateBalanceDisplay();
    
    asset.quantity -= quantity;
    asset.quantity = parseFloat(asset.quantity.toFixed(6));
    
    if (asset.quantity <= 0) {
        userAssets = userAssets.filter(a => a.symbol !== symbol);
    }
    
    localStorage.setItem(storageKeys.assets, JSON.stringify(userAssets));
    renderAssetsList();
    
    addTradeHistory('sell', symbol, quantity, price, total);
    
    document.getElementById('sell-quantity').value = '';
    updateSellForm();
    closeSellModal();
    
    openVerifyModal(`Sale successful! ${quantity} ${symbol} for €${formatPrice(total)}`);
}

function createLimitOrder() {
    if (!selectedCoin) {
        showCustomAlert('Select a coin!');
        return;
    }
    
    const type = getSelectedOrderType();
    const quantity = parseFloat(document.getElementById('limit-quantity').value);
    const limitPrice = parseFloat(document.getElementById('limit-price').value);
    const symbol = selectedCoin.CoinInfo.Name;
    
    if (!quantity || quantity <= 0) {
        showCustomAlert('Enter a valid quantity!');
        return;
    }
    
    if (!limitPrice || limitPrice <= 0) {
        showCustomAlert('Enter a valid limit price!');
        return;
    }
    
    if (type === 'sell') {
        const asset = userAssets.find(a => a.symbol === symbol);
        if (!asset || asset.quantity < quantity) {
            showCustomAlert(`You don't have enough ${symbol}!`);
            return;
        }
    }
    
    if (type === 'buy') {
        const total = quantity * limitPrice;
        if (currentBalance < total) {
            showCustomAlert(`Insufficient funds! You need €${formatPrice(total)}.`);
            return;
        }
    }
    
    const order = {
        id: Date.now(),
        type: type,
        symbol: symbol,
        quantity: quantity,
        limitPrice: limitPrice,
        createdAt: new Date().toISOString(),
        status: 'pending',
        currentPriceAtCreation: window.currentCoinPrice || selectedCoin.RAW.EUR.PRICE
    };
    
    limitOrders.push(order);
    saveLimitOrders();
    renderPendingOrders();
    
    document.getElementById('limit-quantity').value = '';
    document.getElementById('limit-price').value = '';
}

function saveLimitOrders() {
    const storageKeys = getStorageKeys();
    localStorage.setItem(storageKeys.limitOrders, JSON.stringify(limitOrders));
}

function loadLimitOrders() {
    const storageKeys = getStorageKeys();
    const stored = localStorage.getItem(storageKeys.limitOrders);
    if (stored) {
        limitOrders = JSON.parse(stored);
    } else {
        limitOrders = [];
    }
    renderPendingOrders();
}

function renderPendingOrders() {
    const list = document.getElementById('pending-orders-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    const pendingOrders = limitOrders.filter(o => o.status === 'pending');
    
    if (pendingOrders.length === 0) {
        list.innerHTML = '<p style="color: #8B949E; text-align: center; padding: 20px;">You have no pending orders</p>';
        return;
    }
    
    pendingOrders.forEach(order => {
        const orderItem = document.createElement('div');
        orderItem.className = 'pending-order-item';
        
        orderItem.innerHTML = `
            <span class="order-type-badge order-type-${order.type}">${order.type.toUpperCase()}</span>
            <div class="order-details">
                <div class="order-price">€${formatPrice(order.limitPrice)}</div>
                <div class="order-quantity">${order.quantity.toFixed(6)} ${order.symbol}</div>
            </div>
            <button class="cancel-order-btn" data-order-id="${order.id}">Cancel</button>
        `;
        
        orderItem.querySelector('.cancel-order-btn').addEventListener('click', () => {
            cancelLimitOrder(order.id);
        });
        
        list.appendChild(orderItem);
    });
}

function cancelLimitOrder(orderId) {
    limitOrders = limitOrders.filter(o => o.id !== orderId);
    saveLimitOrders();
    renderPendingOrders();
}

function addTradeHistory(type, symbol, quantity, price, total) {
    const trade = {
        id: Date.now(),
        type: type,
        symbol: symbol,
        quantity: quantity,
        price: price,
        total: total,
        date: new Date().toISOString()
    };
    
    tradeHistory.unshift(trade);
    
    if (tradeHistory.length > 50) {
        tradeHistory = tradeHistory.slice(0, 50);
    }
    
    saveTradeHistory();
    renderTradeHistory();
}

function saveTradeHistory() {
    const storageKeys = getStorageKeys();
    localStorage.setItem(storageKeys.tradeHistory, JSON.stringify(tradeHistory));
}

function loadTradeHistory() {
    const storageKeys = getStorageKeys();
    const stored = localStorage.getItem(storageKeys.tradeHistory);
    if (stored) {
        tradeHistory = JSON.parse(stored);
    } else {
        tradeHistory = [];
    }
    renderTradeHistory();
}

function renderTradeHistory() {
    const list = document.getElementById('trade-history-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (tradeHistory.length === 0) {
        list.innerHTML = '<p style="color: #8B949E; text-align: center; padding: 20px;">You have no transactions</p>';
        return;
    }
    
    tradeHistory.forEach(trade => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        const date = new Date(trade.date);
        const formattedDate = date.toLocaleDateString('ro-RO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const typeColor = trade.type === 'buy' ? '#34d399' : '#f87171';
        const typeLabel = trade.type === 'buy' ? 'BUY' : 'SELL';
        
        historyItem.innerHTML = `
            <div>
                <span class="history-item-type" style="color: ${typeColor}">${typeLabel}</span>
                ${trade.quantity.toFixed(6)} ${trade.symbol} @ €${formatPrice(trade.price)}
            </div>
            <div style="color: #8B949E; font-size: 0.8em; margin-top: 5px;">
                ${formattedDate} | Total: €${formatPrice(trade.total)}
            </div>
        `;
        
        list.appendChild(historyItem);
    });
}

function startPriceMonitoring() {
    priceUpdateInterval = setInterval(() => {
        checkLimitOrders();
    }, 5000);
}

async function checkLimitOrders() {
    if (limitOrders.length === 0) return;
    
    try {
        const response = await fetch(MARKET_URL);
        const data = await response.json();
        const coins = data.Data.filter(coin => coin.RAW && coin.RAW.EUR);
        
        const pendingOrders = limitOrders.filter(o => o.status === 'pending');
        
        pendingOrders.forEach(order => {
            const coin = coins.find(c => c.CoinInfo.Name === order.symbol);
            if (!coin) return;
            
            const currentPrice = coin.RAW.EUR.PRICE;
            const priceAtCreation = order.currentPriceAtCreation;
            
            const orderAge = Date.now() - order.id;
            const isRecentlyCreated = orderAge < 30000;
            
            console.log(`[Order Check] ${order.type.toUpperCase()} ${order.symbol}:`, {
                limitPrice: order.limitPrice,
                currentPrice: currentPrice,
                priceAtCreation: priceAtCreation,
                orderAge: Math.floor(orderAge / 1000) + 's',
                isRecent: isRecentlyCreated
            });
            
            const isBuyAboveCreation = order.type === 'buy' && order.limitPrice > priceAtCreation;
            const isSellBelowCreation = order.type === 'sell' && order.limitPrice < priceAtCreation;
            
            if (isBuyAboveCreation) {
                if (currentPrice >= order.limitPrice) {
                    executeLimitOrder(order, currentPrice);
                }
            }
            else if (order.type === 'buy' && order.limitPrice <= priceAtCreation) {
                if (isRecentlyCreated && priceAtCreation) {
                    const priceChangePercent = Math.abs((currentPrice - priceAtCreation) / priceAtCreation) * 100;
                    if (priceChangePercent < 0.1 && currentPrice <= order.limitPrice) {
                        return;
                    }
                }
                if (currentPrice <= order.limitPrice) {
                    executeLimitOrder(order, currentPrice);
                }
            }
            else if (isSellBelowCreation) {
                if (currentPrice <= order.limitPrice) {
                    executeLimitOrder(order, currentPrice);
                }
            }
            else if (order.type === 'sell' && order.limitPrice >= priceAtCreation) {
                if (isRecentlyCreated && priceAtCreation) {
                    const priceChangePercent = Math.abs((currentPrice - priceAtCreation) / priceAtCreation) * 100;
                    if (priceChangePercent < 0.1 && currentPrice >= order.limitPrice) {
                        return;
                    }
                }
                if (currentPrice >= order.limitPrice) {
                    executeLimitOrder(order, currentPrice);
                }
            }
        });
    } catch (error) {
        console.error('Error at checking limit orders:', error);
    }
}

function executeLimitOrder(order, currentPrice) {
    console.log(`[Order Execution] Executing ${order.type.toUpperCase()} order for ${order.symbol} at €${currentPrice.toFixed(2)}`);
    
    const symbol = order.symbol;
    
    if (order.type === 'buy') {
        const total = order.quantity * order.limitPrice;
        
        if (currentBalance >= total) {
            currentBalance -= total;
            const storageKeys = getStorageKeys();
            localStorage.setItem(storageKeys.balance, currentBalance);
            updateBalanceDisplay();
            
            const assetIndex = userAssets.findIndex(a => a.symbol === symbol);
            const coin = allMarketData.find(c => c.CoinInfo.Name === symbol);
            
            if (assetIndex >= 0) {
                const existingAsset = userAssets[assetIndex];
                const totalValue = (existingAsset.quantity * existingAsset.currentPrice) + (order.quantity * order.limitPrice);
                const totalQuantity = existingAsset.quantity + order.quantity;
                const averagePrice = totalValue / totalQuantity;
                
                userAssets[assetIndex] = {
                    ...existingAsset,
                    quantity: totalQuantity,
                    purchasePrice: averagePrice,
                    currentPrice: order.limitPrice
                };
            } else if (coin) {
                userAssets.push({
                    symbol: symbol,
                    fullName: coin.CoinInfo.FullName,
                    quantity: order.quantity,
                    purchasePrice: order.limitPrice,
                    currentPrice: order.limitPrice,
                    change24h: coin.RAW.EUR.CHANGEPCT24HOUR || 0,
                    iconUrl: `https://www.cryptocompare.com${coin.CoinInfo.ImageUrl}`,
                    purchaseDate: new Date().toISOString()
                });
            }
            
            localStorage.setItem(storageKeys.assets, JSON.stringify(userAssets));
            renderAssetsList();
            
            addTradeHistory('buy', symbol, order.quantity, order.limitPrice, total);
            
            order.status = 'executed';
            order.executedAt = new Date().toISOString();
            order.executedPrice = currentPrice;
            saveLimitOrders();
            renderPendingOrders();
            
            showCustomAlert(`✓ Order BUY executat! ${order.quantity} ${symbol} la €${formatPrice(currentPrice)}`);
        }
    } else if (order.type === 'sell') {
        const asset = userAssets.find(a => a.symbol === symbol);
        
        if (asset && asset.quantity >= order.quantity) {
            const total = order.quantity * order.limitPrice;
            
            currentBalance += total;
            const storageKeys = getStorageKeys();
            localStorage.setItem(storageKeys.balance, currentBalance);
            updateBalanceDisplay();
            
            asset.quantity -= order.quantity;
            asset.quantity = parseFloat(asset.quantity.toFixed(6));
            
            if (asset.quantity <= 0) {
                userAssets = userAssets.filter(a => a.symbol !== symbol);
            }
            
            localStorage.setItem(storageKeys.assets, JSON.stringify(userAssets));
            renderAssetsList();
            
            addTradeHistory('sell', symbol, order.quantity, order.limitPrice, total);
            
            order.status = 'executed';
            order.executedAt = new Date().toISOString();
            order.executedPrice = currentPrice;
            saveLimitOrders();
            renderPendingOrders();
            
            showCustomAlert(`✓ Order SELL executat! ${order.quantity} ${symbol} la €${formatPrice(currentPrice)}`);
        }
    }
}

function openVerifyModal(successMessage) {
    const modal = document.getElementById('verifyModal');
    const loader = document.getElementById('verify-loader');
    const icon = document.getElementById('verify-icon');
    const message = document.getElementById('verify-message');
    
    if (!modal || !loader || !icon || !message) {
        console.error('The verification modal elements were not found!');
        return;
    }
    
    loader.style.display = 'flex';
    icon.style.display = 'none';
    message.textContent = 'We are processing the transaction. Please wait...';

    modal.style.display = 'flex';
    modal.classList.add('show');
    
    setTimeout(() => {
        loader.style.display = 'none';
        icon.style.display = 'flex';
        message.textContent = successMessage;
        
        setTimeout(() => {
            closeVerifyModal();
        }, 2000);
    }, 3000);
}

function closeVerifyModal() {
    const modal = document.getElementById('verifyModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
}

function autoSelectCoin(symbol) {
    const optionsContainer = document.getElementById('trade-coin-select-options');
    if (!optionsContainer) {
        console.warn('The dropdown is not ready yet');
        return;
    }
    
    const options = optionsContainer.querySelectorAll('.custom-coin-dropdown-option');
    let foundOption = null;
    
    options.forEach(option => {
        const optionSymbol = option.getAttribute('data-value');
        if (optionSymbol && optionSymbol.toUpperCase() === symbol.toUpperCase()) {
            foundOption = option;
        }
    });
    
    if (foundOption) {
        foundOption.click();
        console.log(`Auto-selected coin: ${symbol}`);
    } else {
        console.warn(`Coin ${symbol} was not found in the list`);
    }
}

window.addEventListener('beforeunload', () => {
    if (priceUpdateInterval) {
        clearInterval(priceUpdateInterval);
    }
});

