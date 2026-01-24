import { formatPrice } from '../../utils/formatters.js';
import { allMarketData } from '../../client.js';
import { ChartRenderer } from '../../charts/chartRenderer.js';

// Funcție pentru a obține cheile de stocare bazate pe UID-ul utilizatorului
function getStorageKeys() {
    const userData = localStorage.getItem('user');
    let userId = 'anonymous';
    
    if (userData) {
        try {
            const user = JSON.parse(userData);
            userId = user.uid || 'anonymous';
        } catch (error) {
            console.error('Eroare la parsarea datelor utilizatorului:', error);
        }
    }
    
    return {
        balance: `orionix_wallet_balance_${userId}`,
        assets: `orionix_wallet_assets_${userId}`,
        limitOrders: `orionix_limit_orders_${userId}`,
        tradeHistory: `orionix_trade_history_${userId}`
    };
}

// Variabile globale
let currentBalance = 0;
let userAssets = [];
let limitOrders = [];
let tradeHistory = [];
let selectedCoin = null;
let chartInstance = null;
let chartRenderer = new ChartRenderer();
let priceUpdateInterval = null;

const MARKET_URL = 'http://localhost:3000/api/market';

// Inițializare
document.addEventListener('DOMContentLoaded', () => {
    loadWalletData();
    loadLimitOrders();
    loadTradeHistory();
    setupEventListeners();
    loadMarketData(); // Aceasta va preselecta automat BTC când datele sunt încărcate
    startPriceMonitoring();
    
    // Verifică dacă există parametru symbol în URL (are prioritate față de BTC)
    const urlParams = new URLSearchParams(window.location.search);
    const symbolParam = urlParams.get('symbol');
    if (symbolParam) {
        // Așteaptă ca datele să se încarce, apoi selectează moneda specificată
        setTimeout(() => autoSelectCoin(symbolParam), 1000);
    }
});

// Ascultăm pentru schimbări în localStorage (când utilizatorul se loghează/înregistrează)
window.addEventListener('storage', function(e) {
    if (e.key === 'user') {
        // Utilizatorul s-a schimbat - reîncărcăm datele
        loadWalletData();
        loadLimitOrders();
        loadTradeHistory();
    }
});

// De asemenea, verificăm la fiecare încărcare a paginii dacă utilizatorul s-a schimbat
let lastUserId = null;
function checkUserChange() {
    const userData = localStorage.getItem('user');
    let currentUserId = 'anonymous';
    
    if (userData) {
        try {
            const user = JSON.parse(userData);
            currentUserId = user.uid || 'anonymous';
        } catch (error) {
            // Ignorăm eroarea
        }
    }
    
    if (lastUserId !== null && lastUserId !== currentUserId) {
        // Utilizatorul s-a schimbat - reîncărcăm datele
        loadWalletData();
        loadLimitOrders();
        loadTradeHistory();
    }
    
    lastUserId = currentUserId;
}

// Verificăm la încărcarea paginii
checkUserChange();

// Verificăm periodic (în cazul în care utilizatorul se schimbă în același tab)
setInterval(checkUserChange, 1000);

// Încarcă datele din wallet
function loadWalletData() {
    const storageKeys = getStorageKeys();
    const storedBalance = localStorage.getItem(storageKeys.balance);
    if (storedBalance) {
        currentBalance = parseFloat(storedBalance);
    } else {
        // Dacă nu există sold pentru utilizatorul curent, îl setăm la 0
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

// Actualizează afișarea balanței
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

// Renderizează lista de assets
function renderAssetsList() {
    const assetsList = document.getElementById('trade-assets-list');
    if (!assetsList) return;
    
    assetsList.innerHTML = '';
    
    if (userAssets.length === 0) {
        assetsList.innerHTML = '<p style="color: #8B949E; text-align: center; padding: 20px;">Nu ai assets disponibile</p>';
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

// Selectează un asset
function selectAsset(asset) {
    // Remove active class from all items
    document.querySelectorAll('.asset-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to selected item
    const selectedItem = document.querySelector(`[data-symbol="${asset.symbol}"]`);
    if (selectedItem) {
        selectedItem.classList.add('active');
    }
    
    // Find coin in market data
    const coin = allMarketData.find(c => c.CoinInfo.Name === asset.symbol);
    if (coin) {
        selectCoin(coin);
    }
}

// Încarcă datele de piață
async function loadMarketData() {
    try {
        const response = await fetch(MARKET_URL);
        const data = await response.json();
        const coins = data.Data.filter(coin => coin.RAW && coin.RAW.EUR);
        
        populateCoinSelector(coins);
    } catch (error) {
        console.error('Eroare la încărcarea datelor de piață:', error);
    }
}

// Populează selectorul de monede
function populateCoinSelector(coins) {
    const select = document.getElementById('trade-coin-select');
    const optionsContainer = document.getElementById('trade-coin-select-options');
    const wrapper = document.getElementById('trade-coin-select-wrapper');
    const selectedDisplay = document.getElementById('trade-coin-select-selected');
    const selectedText = selectedDisplay.querySelector('.custom-coin-dropdown-text');
    const iconPreview = document.getElementById('trade-coin-icon-preview');
    
    if (!select || !optionsContainer || !wrapper) return;
    
    // Ștergem opțiunile existente (except prima)
    while (select.options.length > 1) {
        select.remove(1);
    }
    optionsContainer.innerHTML = '';
    
    coins.forEach(coin => {
        const symbol = coin.CoinInfo.Name;
        const fullName = coin.CoinInfo.FullName;
        const iconUrl = `https://www.cryptocompare.com${coin.CoinInfo.ImageUrl}`;
        
        // Adăugăm în select-ul hidden
        const option = document.createElement('option');
        option.value = symbol;
        option.textContent = `${symbol} - ${fullName}`;
        option.setAttribute('data-coin', JSON.stringify(coin));
        select.appendChild(option);
        
        // Adăugăm în dropdown-ul custom cu iconiță
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
            
            // Actualizăm afișajul selectat
            selectedText.textContent = `${symbol} - ${fullName}`;
            iconPreview.src = iconUrl;
            iconPreview.style.display = 'block';
            iconPreview.onerror = function() {
                this.src = 'https://placehold.co/24x24/161B22/FFFFFF?text=?';
            };
            
            // Actualizăm select-ul hidden
            select.value = symbol;
            
            // Închidem dropdown-ul
            wrapper.classList.remove('active');
        });
        
        optionsContainer.appendChild(customOption);
    });
    
    // Event listener pentru a deschide/închide dropdown-ul (doar o singură dată)
    // Verificăm dacă nu a fost deja adăugat
    if (!selectedDisplay.hasAttribute('data-listener-added')) {
        selectedDisplay.setAttribute('data-listener-added', 'true');
        selectedDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            wrapper.classList.toggle('active');
        });
    }
    
    // Închidem dropdown-ul când se face click în afara lui (doar o singură dată)
    if (!wrapper.hasAttribute('data-document-listener-added')) {
        wrapper.setAttribute('data-document-listener-added', 'true');
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                wrapper.classList.remove('active');
            }
        });
    }
    
    // Preselectează BTC după ce s-au adăugat toate opțiunile
    // Verificăm dacă există parametru symbol în URL - are prioritate
    const urlParams = new URLSearchParams(window.location.search);
    const symbolParam = urlParams.get('symbol');
    
    // Dacă nu există parametru în URL, selectăm BTC automat
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

// Selectează o monedă pentru trading
function selectCoin(coin) {
    selectedCoin = coin;
    const coinInfo = coin.CoinInfo;
    const rawData = coin.RAW.EUR;
    
    // Update coin info display
    const coinInfoElement = document.getElementById('selected-coin-info');
    if (coinInfoElement) {
        coinInfoElement.innerHTML = `
            <strong>${coinInfo.FullName}</strong> (${coinInfo.Name})<br>
            Preț: €${formatPrice(rawData.PRICE)} | 
            <span class="${rawData.CHANGEPCT24HOUR >= 0 ? 'positive' : 'negative'}">
                ${rawData.CHANGEPCT24HOUR >= 0 ? '+' : ''}${rawData.CHANGEPCT24HOUR.toFixed(2)}%
            </span>
        `;
    }
    
    // Update dropdown display
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
    
    // Update price inputs
    const currentPrice = rawData.PRICE;
    document.getElementById('buy-price').value = currentPrice.toFixed(2);
    document.getElementById('sell-price').value = currentPrice.toFixed(2);
    
    // Store current price for limit orders
    window.currentCoinPrice = currentPrice;
    
    // Load chart
    loadChart(coinInfo.Name, currentPrice, rawData.CHANGEPCT24HOUR >= 0);
    
    // Update forms
    updateBuyForm();
    updateSellForm();
}

// Setează prețul limit cu un procentaj față de prețul curent
function setLimitPriceWithPercent(percent) {
    if (!selectedCoin || !window.currentCoinPrice) {
        showCustomAlert('Selectează o monedă mai întâi!');
        return;
    }
    
    const currentPrice = window.currentCoinPrice;
    const newPrice = currentPrice * (1 + percent / 100);
    
    const limitPriceInput = document.getElementById('limit-price');
    if (limitPriceInput) {
        limitPriceInput.value = newPrice.toFixed(2);
    }
}

// Încarcă graficul
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
                    name: 'Preț',
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
        console.error('Eroare la încărcarea graficului:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Buy/Sell Now buttons
    document.getElementById('buy-now-btn').addEventListener('click', () => {
        showBuyModal();
    });
    
    document.getElementById('sell-now-btn').addEventListener('click', () => {
        showSellModal();
    });
    
    // Close modal buttons
    document.getElementById('close-buy-modal').addEventListener('click', () => {
        closeBuyModal();
    });
    
    document.getElementById('close-sell-modal').addEventListener('click', () => {
        closeSellModal();
    });
    
    // Close modals when clicking outside
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
    
    // Buy form
    document.getElementById('buy-quantity').addEventListener('input', updateBuyForm);
    document.getElementById('confirm-buy-btn').addEventListener('click', handleBuy);
    
    // Sell form
    document.getElementById('sell-quantity').addEventListener('input', updateSellForm);
    document.getElementById('confirm-sell-btn').addEventListener('click', handleSell);
    
    // Limit order form
    document.getElementById('create-limit-order-btn').addEventListener('click', createLimitOrder);
    
    // Order type buttons (Buy/Sell)
    document.getElementById('limit-order-buy-btn').addEventListener('click', () => {
        selectOrderType('buy');
    });
    
    document.getElementById('limit-order-sell-btn').addEventListener('click', () => {
        selectOrderType('sell');
    });
    
    // Price shortcuts pentru limit orders
    document.getElementById('price-minus-1').addEventListener('click', () => {
        setLimitPriceWithPercent(-1);
    });
    
    document.getElementById('price-plus-1').addEventListener('click', () => {
        setLimitPriceWithPercent(1);
    });
}

// Selectează tipul de order (Buy/Sell)
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

// Obține tipul de order selectat
function getSelectedOrderType() {
    const buyBtn = document.getElementById('limit-order-buy-btn');
    return buyBtn.classList.contains('active') ? 'buy' : 'sell';
}

// Funcție pentru alert-uri custom
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
    
    // Adaugă animație CSS dacă nu există
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

// Afișează modalul de buy
function showBuyModal() {
    if (!selectedCoin) {
        showCustomAlert('Selectează o monedă mai întâi!');
        return;
    }
    const modal = document.getElementById('buy-modal');
    modal.classList.add('show');
    // Reset form
    document.getElementById('buy-quantity').value = '';
    updateBuyForm();
}

// Închide modalul de buy
function closeBuyModal() {
    const modal = document.getElementById('buy-modal');
    modal.classList.remove('show');
    // Reset form
    document.getElementById('buy-quantity').value = '';
    updateBuyForm();
}

// Afișează modalul de sell
function showSellModal() {
    if (!selectedCoin) {
        showCustomAlert('Selectează o monedă mai întâi!');
        return;
    }
    
    const asset = userAssets.find(a => a.symbol === selectedCoin.CoinInfo.Name);
    if (!asset) {
        showCustomAlert('Nu ai această monedă în portofel!');
        return;
    }
    
    const modal = document.getElementById('sell-modal');
    modal.classList.add('show');
    // Reset form
    document.getElementById('sell-quantity').value = '';
    updateSellForm();
}

// Închide modalul de sell
function closeSellModal() {
    const modal = document.getElementById('sell-modal');
    modal.classList.remove('show');
    // Reset form
    document.getElementById('sell-quantity').value = '';
    updateSellForm();
}

// Actualizează formularul de buy
function updateBuyForm() {
    const quantity = parseFloat(document.getElementById('buy-quantity').value) || 0;
    const price = parseFloat(document.getElementById('buy-price').value) || 0;
    const total = quantity * price;
    
    document.getElementById('buy-total').textContent = `€${formatPrice(total)}`;
}

// Actualizează formularul de sell
function updateSellForm() {
    const quantity = parseFloat(document.getElementById('sell-quantity').value) || 0;
    const price = parseFloat(document.getElementById('sell-price').value) || 0;
    const total = quantity * price;
    
    document.getElementById('sell-total').textContent = `€${formatPrice(total)}`;
}

// Gestionează cumpărarea
function handleBuy() {
    if (!selectedCoin) {
        showCustomAlert('Selectează o monedă!');
        return;
    }
    
    const quantity = parseFloat(document.getElementById('buy-quantity').value);
    const price = parseFloat(document.getElementById('buy-price').value);
    const total = quantity * price;
    
    if (!quantity || quantity <= 0) {
        showCustomAlert('Introdu o cantitate validă!');
        return;
    }
    
    if (currentBalance < total) {
        showCustomAlert(`Fonduri insuficiente! Ai nevoie de €${formatPrice(total)}, dar ai doar €${formatPrice(currentBalance)}.`);
        return;
    }
    
    // Actualizează balanța
    currentBalance -= total;
    const storageKeys = getStorageKeys();
    localStorage.setItem(storageKeys.balance, currentBalance);
    updateBalanceDisplay();
    
    // Adaugă sau actualizează asset-ul
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
    
    // Folosim aceeași variabilă storageKeys pentru assets
    localStorage.setItem(storageKeys.assets, JSON.stringify(userAssets));
    renderAssetsList();
    
    // Adaugă în istoric
    addTradeHistory('buy', symbol, quantity, price, total);
    
    // Reset form și închide modalul
    document.getElementById('buy-quantity').value = '';
    updateBuyForm();
    closeBuyModal();
    
    // Deschide modalul de verificare
    openVerifyModal(`Cumpărare reușită! ${quantity} ${symbol} pentru €${formatPrice(total)}`);
}

// Gestionează vânzarea
function handleSell() {
    if (!selectedCoin) {
        showCustomAlert('Selectează o monedă!');
        return;
    }
    
    const symbol = selectedCoin.CoinInfo.Name;
    const asset = userAssets.find(a => a.symbol === symbol);
    
    if (!asset) {
        showCustomAlert('Nu ai această monedă în portofel!');
        return;
    }
    
    const quantity = parseFloat(document.getElementById('sell-quantity').value);
    const price = parseFloat(document.getElementById('sell-price').value);
    const total = quantity * price;
    
    if (!quantity || quantity <= 0) {
        showCustomAlert('Introdu o cantitate validă!');
        return;
    }
    
    if (quantity > asset.quantity) {
        showCustomAlert(`Nu ai suficiente ${symbol}! Disponibil: ${asset.quantity.toFixed(6)}`);
        return;
    }
    
    // Actualizează balanța
    currentBalance += total;
    const storageKeys = getStorageKeys();
    localStorage.setItem(storageKeys.balance, currentBalance);
    updateBalanceDisplay();
    
    // Actualizează asset-ul
    asset.quantity -= quantity;
    asset.quantity = parseFloat(asset.quantity.toFixed(6));
    
    if (asset.quantity <= 0) {
        userAssets = userAssets.filter(a => a.symbol !== symbol);
    }
    
    // Folosim aceeași variabilă storageKeys pentru assets
    localStorage.setItem(storageKeys.assets, JSON.stringify(userAssets));
    renderAssetsList();
    
    // Adaugă în istoric
    addTradeHistory('sell', symbol, quantity, price, total);
    
    // Reset form și închide modalul
    document.getElementById('sell-quantity').value = '';
    updateSellForm();
    closeSellModal();
    
    // Deschide modalul de verificare
    openVerifyModal(`Vânzare reușită! ${quantity} ${symbol} pentru €${formatPrice(total)}`);
}

// Creează limit order
function createLimitOrder() {
    if (!selectedCoin) {
        showCustomAlert('Selectează o monedă!');
        return;
    }
    
    const type = getSelectedOrderType();
    const quantity = parseFloat(document.getElementById('limit-quantity').value);
    const limitPrice = parseFloat(document.getElementById('limit-price').value);
    const symbol = selectedCoin.CoinInfo.Name;
    
    if (!quantity || quantity <= 0) {
        showCustomAlert('Introdu o cantitate validă!');
        return;
    }
    
    if (!limitPrice || limitPrice <= 0) {
        showCustomAlert('Introdu un preț limit valid!');
        return;
    }
    
    // Verificări pentru sell orders
    if (type === 'sell') {
        const asset = userAssets.find(a => a.symbol === symbol);
        if (!asset || asset.quantity < quantity) {
            showCustomAlert(`Nu ai suficiente ${symbol}!`);
            return;
        }
    }
    
    // Verificări pentru buy orders
    if (type === 'buy') {
        const total = quantity * limitPrice;
        if (currentBalance < total) {
            showCustomAlert(`Fonduri insuficiente! Ai nevoie de €${formatPrice(total)}.`);
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
        currentPriceAtCreation: window.currentCoinPrice || selectedCoin.RAW.EUR.PRICE // Prețul curent când s-a creat order-ul
    };
    
    limitOrders.push(order);
    saveLimitOrders();
    renderPendingOrders();
    
    // Reset form
    document.getElementById('limit-quantity').value = '';
    document.getElementById('limit-price').value = '';
}

// Salvează limit orders
function saveLimitOrders() {
    const storageKeys = getStorageKeys();
    localStorage.setItem(storageKeys.limitOrders, JSON.stringify(limitOrders));
}

// Încarcă limit orders
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

// Renderizează orderele în așteptare
function renderPendingOrders() {
    const list = document.getElementById('pending-orders-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    const pendingOrders = limitOrders.filter(o => o.status === 'pending');
    
    if (pendingOrders.length === 0) {
        list.innerHTML = '<p style="color: #8B949E; text-align: center; padding: 20px;">Nu ai ordere în așteptare</p>';
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
            <button class="cancel-order-btn" data-order-id="${order.id}">Anulează</button>
        `;
        
        orderItem.querySelector('.cancel-order-btn').addEventListener('click', () => {
            cancelLimitOrder(order.id);
        });
        
        list.appendChild(orderItem);
    });
}

// Anulează limit order
function cancelLimitOrder(orderId) {
    limitOrders = limitOrders.filter(o => o.id !== orderId);
    saveLimitOrders();
    renderPendingOrders();
}

// Adaugă în istoricul de tranzacții
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
    
    // Păstrăm doar ultimele 50 de tranzacții
    if (tradeHistory.length > 50) {
        tradeHistory = tradeHistory.slice(0, 50);
    }
    
    saveTradeHistory();
    renderTradeHistory();
}

// Salvează istoricul de tranzacții
function saveTradeHistory() {
    const storageKeys = getStorageKeys();
    localStorage.setItem(storageKeys.tradeHistory, JSON.stringify(tradeHistory));
}

// Încarcă istoricul de tranzacții
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

// Renderizează istoricul de tranzacții
function renderTradeHistory() {
    const list = document.getElementById('trade-history-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (tradeHistory.length === 0) {
        list.innerHTML = '<p style="color: #8B949E; text-align: center; padding: 20px;">Nu ai tranzacții</p>';
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

// Pornește monitorizarea prețurilor pentru limit orders
function startPriceMonitoring() {
    // Verifică limit orders la fiecare 5 secunde
    priceUpdateInterval = setInterval(() => {
        checkLimitOrders();
    }, 5000);
}

// Verifică și execută limit orders
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
            
            // Verificăm dacă order-ul a fost creat recent (în ultimele 30 secunde)
            const orderAge = Date.now() - order.id;
            const isRecentlyCreated = orderAge < 30000; // 30 secunde
            
            // Logging pentru debugging
            console.log(`[Order Check] ${order.type.toUpperCase()} ${order.symbol}:`, {
                limitPrice: order.limitPrice,
                currentPrice: currentPrice,
                priceAtCreation: priceAtCreation,
                orderAge: Math.floor(orderAge / 1000) + 's',
                isRecent: isRecentlyCreated
            });
            
            // Determinăm direcția order-ului față de prețul de la creare
            const isBuyAboveCreation = order.type === 'buy' && order.limitPrice > priceAtCreation;
            const isSellBelowCreation = order.type === 'sell' && order.limitPrice < priceAtCreation;
            
            // Pentru buy orders cu preț limit MAI MARE decât prețul de la creare (ex: +1%)
            // Execută când prețul CREȘTE și ajunge la preț limit
            if (isBuyAboveCreation) {
                if (currentPrice >= order.limitPrice) {
                    executeLimitOrder(order, currentPrice);
                }
            }
            // Pentru buy orders cu preț limit MAI MIC decât prețul de la creare (ex: -1%)
            // Execută când prețul SCADE și ajunge la preț limit
            else if (order.type === 'buy' && order.limitPrice <= priceAtCreation) {
                // Prevenim execuția imediată pentru order-uri recent create
                if (isRecentlyCreated && priceAtCreation) {
                    const priceChangePercent = Math.abs((currentPrice - priceAtCreation) / priceAtCreation) * 100;
                    // Blocăm execuția dacă prețul nu s-a schimbat cu cel puțin 0.1%
                    if (priceChangePercent < 0.1 && currentPrice <= order.limitPrice) {
                        return;
                    }
                }
                // Execută când prețul scade la sau sub prețul limit
                if (currentPrice <= order.limitPrice) {
                    executeLimitOrder(order, currentPrice);
                }
            }
            // Pentru sell orders cu preț limit MAI MIC decât prețul de la creare (ex: -1%)
            // Execută când prețul SCADE și ajunge la preț limit
            else if (isSellBelowCreation) {
                if (currentPrice <= order.limitPrice) {
                    executeLimitOrder(order, currentPrice);
                }
            }
            // Pentru sell orders cu preț limit MAI MARE decât prețul de la creare (ex: +1%)
            // Execută când prețul CREȘTE și ajunge la preț limit
            else if (order.type === 'sell' && order.limitPrice >= priceAtCreation) {
                // Prevenim execuția imediată pentru order-uri recent create
                if (isRecentlyCreated && priceAtCreation) {
                    const priceChangePercent = Math.abs((currentPrice - priceAtCreation) / priceAtCreation) * 100;
                    // Blocăm execuția dacă prețul nu s-a schimbat cu cel puțin 0.1%
                    if (priceChangePercent < 0.1 && currentPrice >= order.limitPrice) {
                        return;
                    }
                }
                // Execută când prețul crește la sau peste prețul limit
                if (currentPrice >= order.limitPrice) {
                    executeLimitOrder(order, currentPrice);
                }
            }
        });
    } catch (error) {
        console.error('Eroare la verificarea limit orders:', error);
    }
}

// Execută un limit order
function executeLimitOrder(order, currentPrice) {
    console.log(`[Order Execution] Executing ${order.type.toUpperCase()} order for ${order.symbol} at €${currentPrice.toFixed(2)}`);
    
    const symbol = order.symbol;
    
    if (order.type === 'buy') {
        const total = order.quantity * order.limitPrice;
        
        if (currentBalance >= total) {
            // Actualizează balanța
            currentBalance -= total;
            const storageKeys = getStorageKeys();
            localStorage.setItem(storageKeys.balance, currentBalance);
            updateBalanceDisplay();
            
            // Adaugă sau actualizează asset-ul
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
            
            // Folosim aceeași variabilă storageKeys pentru assets (deja declarată mai sus)
            localStorage.setItem(storageKeys.assets, JSON.stringify(userAssets));
            renderAssetsList();
            
            // Adaugă în istoric
            addTradeHistory('buy', symbol, order.quantity, order.limitPrice, total);
            
            // Marchează order-ul ca executat
            order.status = 'executed';
            order.executedAt = new Date().toISOString();
            order.executedPrice = currentPrice;
            saveLimitOrders();
            renderPendingOrders();
            
            // Notificare de succes
            showCustomAlert(`✓ Order BUY executat! ${order.quantity} ${symbol} la €${formatPrice(currentPrice)}`);
        }
    } else if (order.type === 'sell') {
        const asset = userAssets.find(a => a.symbol === symbol);
        
        if (asset && asset.quantity >= order.quantity) {
            const total = order.quantity * order.limitPrice;
            
            // Actualizează balanța
            currentBalance += total;
            const storageKeys = getStorageKeys();
            localStorage.setItem(storageKeys.balance, currentBalance);
            updateBalanceDisplay();
            
            // Actualizează asset-ul
            asset.quantity -= order.quantity;
            asset.quantity = parseFloat(asset.quantity.toFixed(6));
            
            if (asset.quantity <= 0) {
                userAssets = userAssets.filter(a => a.symbol !== symbol);
            }
            
            // Folosim aceeași variabilă storageKeys pentru assets
            localStorage.setItem(storageKeys.assets, JSON.stringify(userAssets));
            renderAssetsList();
            
            // Adaugă în istoric
            addTradeHistory('sell', symbol, order.quantity, order.limitPrice, total);
            
            // Marchează order-ul ca executat
            order.status = 'executed';
            order.executedAt = new Date().toISOString();
            order.executedPrice = currentPrice;
            saveLimitOrders();
            renderPendingOrders();
            
            // Notificare de succes
            showCustomAlert(`✓ Order SELL executat! ${order.quantity} ${symbol} la €${formatPrice(currentPrice)}`);
        }
    }
}

// Modal de verificare
function openVerifyModal(successMessage) {
    const modal = document.getElementById('verifyModal');
    const loader = document.getElementById('verify-loader');
    const icon = document.getElementById('verify-icon');
    const message = document.getElementById('verify-message');
    
    if (!modal || !loader || !icon || !message) {
        console.error('Elementele modalului de verificare nu au fost găsite!');
        return;
    }
    
    // Resetăm starea modalului
    loader.style.display = 'flex';
    icon.style.display = 'none';
    message.textContent = 'Procesăm tranzacția. Te rugăm să aștepți...';
    
    // Afișăm modalul
    modal.style.display = 'flex';
    modal.classList.add('show');
    
    // Simulăm procesarea (3 secunde)
    setTimeout(() => {
        // Ascundem loader-ul și afișăm iconița de succes
        loader.style.display = 'none';
        icon.style.display = 'flex';
        message.textContent = successMessage;
        
        // Închidem modalul după 2 secunde
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

// Auto-selectează o monedă bazat pe parametrul URL
function autoSelectCoin(symbol) {
    const optionsContainer = document.getElementById('trade-coin-select-options');
    if (!optionsContainer) {
        console.warn('Dropdown-ul nu este gata încă');
        return;
    }
    
    // Găsește opțiunea cu simbolul cerut
    const options = optionsContainer.querySelectorAll('.custom-coin-dropdown-option');
    let foundOption = null;
    
    options.forEach(option => {
        const optionSymbol = option.getAttribute('data-value');
        if (optionSymbol && optionSymbol.toUpperCase() === symbol.toUpperCase()) {
            foundOption = option;
        }
    });
    
    if (foundOption) {
        // Trigger click pe opțiune pentru a selecta moneda
        foundOption.click();
        console.log(`Auto-selectat moneda: ${symbol}`);
    } else {
        console.warn(`Moneda ${symbol} nu a fost găsită în listă`);
    }
}

// Cleanup la închiderea paginii
window.addEventListener('beforeunload', () => {
    if (priceUpdateInterval) {
        clearInterval(priceUpdateInterval);
    }
});

