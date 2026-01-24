import { formatPrice, formatLargeNumber } from '../../utils/formatters.js'; 
import { allMarketData } from '../../client.js'; 

function getStorageKeys() {
    const userData = localStorage.getItem('user');
    let userId = 'anonymous';
    
    if (userData) {
        try {
            const user = JSON.parse(userData);
            userId = user.uid || 'anonymous';
        } catch (error) {
            console.error('Error parsing user data:', error);
        }
    }
    
    return {
        balance: `orionix_wallet_balance_${userId}`,
        assets: `orionix_wallet_assets_${userId}`,
        transactions: `orionix_wallet_transactions_${userId}`
    };
}

const INITIAL_BALANCE = 123456.78; 
let currentBalance = INITIAL_BALANCE;
let userAssets = [];
let transactions = [];
let isModalOpen = false;
const MARKET_URL = 'http://localhost:3000/api/market';

document.addEventListener("DOMContentLoaded", () => {
    loadInitialData();
    loadUserAssets();
    loadTransactions();
    setupButtonListeners();
    setupDepositModalListeners();
    setupAddFundsModal();
    setupWithdrawModal();
    setupSwapModal();
});

window.addEventListener('storage', function(e) {
    if (e.key === 'user') {
        loadInitialData();
        loadUserAssets();
        loadTransactions();
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
        loadInitialData();
        loadUserAssets();
        loadTransactions();
    }
    
    lastUserId = currentUserId;
}

checkUserChange();

setInterval(checkUserChange, 1000);


async function ensureMarketDataLoaded() {
    if (allMarketData.length > 0) {
        return true;
    }
    
    try {
        const response = await fetch(MARKET_URL);
        
        if (!response.ok) {
            throw new Error('Error loading market data (check port 3000).');
        }
        
        const data = await response.json();
        const coins = data.Data;
        
        if (!Array.isArray(coins) || coins.length === 0) {
            throw new Error("Empty market data.");
        }
        
        const filteredCoins = coins.filter(coin => coin.RAW && coin.RAW.EUR);

        return filteredCoins;

    } catch (error) {
        console.error("Error loading market data:", error);
        showCustomAlert(`Error: ${error.message}.`);
        return false;
    }
}


function loadInitialData() {
    const storageKeys = getStorageKeys();
    const storedBalance = localStorage.getItem(storageKeys.balance);
    
    if (storedBalance !== null) {
        currentBalance = parseFloat(storedBalance);
    } else {
        localStorage.setItem(storageKeys.balance, INITIAL_BALANCE);
        currentBalance = INITIAL_BALANCE;
    }
    
    updateUI(currentBalance);
}

function loadUserAssets() {
    const storageKeys = getStorageKeys();
    const storedAssets = localStorage.getItem(storageKeys.assets);
    
    if (storedAssets) {
        try {
            userAssets = JSON.parse(storedAssets);
            renderAssets();
        } catch (error) {
            console.error('Error loading assets:', error);
            userAssets = [];
        }
    } else {
        userAssets = [];
    }
}

function saveUserAssets() {
    const storageKeys = getStorageKeys();
    localStorage.setItem(storageKeys.assets, JSON.stringify(userAssets));
}


async function loadTransactions() {
    const storageKeys = getStorageKeys();
    const storedTransactions = localStorage.getItem(storageKeys.transactions);
    
    if (storedTransactions) {
        try {
            transactions = JSON.parse(storedTransactions);
            await renderTransactions();
        } catch (error) {
            console.error('Error loading transactions:', error);
            transactions = [];
        }
    } else {
        transactions = [];
    }
}

function saveTransactions() {
    const storageKeys = getStorageKeys();
    localStorage.setItem(storageKeys.transactions, JSON.stringify(transactions));
}

async function addTransaction(type, details) {
    const transaction = {
        id: Date.now(),
        type: type,
        date: new Date().toISOString(),
        details: details
    };
    
    transactions.unshift(transaction);
    
    if (transactions.length > 50) {
        transactions = transactions.slice(0, 50);
    }
    
    saveTransactions();
    await renderTransactions();
}

async function renderTransactions() {
    const transactionsContainer = document.getElementById('transactions-container');
    if (!transactionsContainer) return;
    
    if (transactions.length === 0) {
        transactionsContainer.innerHTML = '<p style="color: #8B949E; text-align: center; padding: 20px;">Here will appear your future transactions.</p>';
        return;
    }

    if (!allMarketData || allMarketData.length === 0) {
        await ensureMarketDataLoaded();
    }
    
    transactionsContainer.innerHTML = '';
    
    transactions.forEach(transaction => {
        const transactionCard = document.createElement('div');
        transactionCard.className = 'transaction-card';
        
        const date = new Date(transaction.date);
        const formattedDate = date.toLocaleDateString('en-US', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let typeLabel = '';
        let description = '';
        let amount = '';
        let typeClass = '';
        
        switch(transaction.type) {
            case 'deposit':
                typeLabel = 'Depozit';
                typeClass = 'transaction-type-deposit';
                description = `${transaction.details.quantity} ${transaction.details.symbol}`;
                amount = `-€${formatPrice(transaction.details.value)}`;
                break;
            case 'add_funds':
                typeLabel = 'Add Funds';
                typeClass = 'transaction-type-add-funds';
                description = 'Add funds by card';
                amount = `+€${formatPrice(transaction.details.amount)}`;
                break;
            case 'withdraw':
                typeLabel = 'Withdraw';
                typeClass = 'transaction-type-withdraw';
                description = `${transaction.details.quantity} ${transaction.details.symbol}`;
                amount = `+€${formatPrice(transaction.details.value)}`;
                break;
            case 'swap':
                typeLabel = 'Swap';
                typeClass = 'transaction-type-swap';
                const fromQty = parseFloat(transaction.details.fromQuantity);
                const toQty = parseFloat(transaction.details.toQuantity);
                
                const formatQuantity = (qty) => {
                    if (qty >= 1) {
                        return qty.toFixed(6).replace(/\.?0+$/, '');
                    } else if (qty >= 0.000001) {
                        return qty.toFixed(8).replace(/\.?0+$/, '');
                    } else {
                        return qty.toExponential(3).replace(/\.?0+e/, 'e');
                    }
                };
                
                const formattedFromQty = formatQuantity(fromQty);
                const formattedToQty = formatQuantity(toQty);
                description = `${formattedFromQty} ${transaction.details.fromSymbol} → ${formattedToQty} ${transaction.details.toSymbol}`;
                amount = `€${formatPrice(transaction.details.fromValue)}`; // Nu afectează balanța
                break;
        }
        
        transactionCard.innerHTML = `
            <div class="transaction-content">
                <div class="transaction-header">
                    <span class="transaction-type ${typeClass}">${typeLabel}</span>
                    <span class="transaction-date">${formattedDate}</span>
                </div>
                <div class="transaction-description">${description}</div>
            </div>
            <div class="transaction-amount ${typeClass}">${amount}</div>
        `;
        
        transactionsContainer.appendChild(transactionCard);
    });
}

/**
 * @returns {number}
 */
function calculateWalletTotalValue() {
    if (!userAssets || userAssets.length === 0) {
        return 0;
    }
    
    let totalValue = 0;
    userAssets.forEach(asset => {
        const assetValue = asset.quantity * asset.currentPrice;
        totalValue += assetValue;
    });
    
    return parseFloat(totalValue.toFixed(2));
}

/**
 * @param {number} balance 
 */
function updateUI(balance) {
    const balanceElement = document.querySelector('.balance-value');
    const walletTotalValueElement = document.querySelector('.wallet-total-value');
    const greetingNameElement = document.getElementById('greeting-name');
    
    const formattedBalance = balance.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    if (balanceElement) {
        balanceElement.textContent = formattedBalance;
    }
    
    const walletTotalValue = calculateWalletTotalValue();
    const formattedWalletValue = walletTotalValue.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    if (walletTotalValueElement) {
        walletTotalValueElement.textContent = formattedWalletValue;
    }
    
    if (greetingNameElement) {
        const userData = localStorage.getItem('user');
        if (userData) {
            try {
                const user = JSON.parse(userData);
                const displayName = user.displayName || user.email || "Utilizator";
                greetingNameElement.textContent = displayName;
            } catch (error) {
                greetingNameElement.textContent = "Anonim";
            }
        } else {
            greetingNameElement.textContent = "Anonim";
        }
    }
}


function setupButtonListeners() {
    document.querySelector('.action-column-group .main-actions .primary').addEventListener('click', () => {
        openDepositModal();
    });
    
    document.querySelector('.action-column-group .secondary-actions .primary').addEventListener('click', () => {
        openAddFundsModal();
    });
    
    document.querySelector('.action-column-group .main-actions .secondary').addEventListener('click', () => {
        openWithdrawModal();
    });
    
    document.querySelector('.action-column-group .secondary-actions .secondary').addEventListener('click', () => {
        openSwapModal();
    });
}

/**
 * @param {string} type 
 */
function handleTransaction(type) {
    if (type !== 'Withdraw') return;

    const amount = 50.00;
    
    if (currentBalance < amount) {
        showCustomAlert('Error: Insufficient funds for this simulated withdrawal.');
        return;
    }
    
    currentBalance -= amount;
    currentBalance = parseFloat(currentBalance.toFixed(2));

    const storageKeys = getStorageKeys();
    localStorage.setItem(storageKeys.balance, currentBalance);
    updateUI(currentBalance);
    showCustomAlert(`Transaction successful! You have withdrawn $${amount.toFixed(2)}. The new balance is displayed.`);
}


function setupDepositModalListeners() {
    const modal = document.getElementById("depositModal");
    
    if (!modal) {
        console.warn("Deposit modal (#depositModal) not found. Event listeners not initialized.");
        return; 
    }
    
    const closeBtn = modal.querySelector(".close-button");
    
    if (!closeBtn) {
        console.error("Close button for the modal is missing.");
        return;
    }

    closeBtn.onclick = closeDepositModal;
    window.onclick = (event) => {
        if (event.target === modal) {
            closeDepositModal();
        }
    };
    
    setupCustomDropdown();
    document.getElementById('deposit-quantity').addEventListener('input', calculateDepositValue);
    
    document.getElementById('confirm-deposit-btn').addEventListener('click', handleDepositConfirm);
}

function closeDepositModal() {
    document.getElementById("depositModal").style.display = "none";
    isModalOpen = false;
    document.getElementById('deposit-quantity').value = '';
    document.getElementById('deposit-value').textContent = '€0.00';
    const dropdownWrapper = document.getElementById('deposit-symbol-wrapper');
    const dropdownSelected = document.getElementById('deposit-symbol-selected');
    const hiddenSelect = document.getElementById('deposit-symbol');
    const coinDetailsSection = document.getElementById('coin-details-section');
    
    if (dropdownWrapper) {
        dropdownWrapper.classList.remove('active');
    }
    
    if (dropdownSelected) {
        const dropdownText = dropdownSelected.querySelector('.dropdown-selected-text');
        const iconPreviewDropdown = document.getElementById('coin-icon-preview-dropdown');
        if (dropdownText) {
            dropdownText.textContent = 'Selectează o monedă...';
        }
        if (iconPreviewDropdown) {
            iconPreviewDropdown.innerHTML = '';
        }
    }
    
    if (hiddenSelect && hiddenSelect.options.length > 0) {
        hiddenSelect.selectedIndex = 0; 
    }
    
    if (coinDetailsSection) {
        coinDetailsSection.style.display = 'none';
    }
    
    const currentPriceElement = document.getElementById('current-coin-price');
    if (currentPriceElement) {
        currentPriceElement.textContent = '1 Coin = €0.00';
    }
}

async function openDepositModal() {
    const loadedData = await ensureMarketDataLoaded();
    
    let coinsToUse = allMarketData;

    if (loadedData && Array.isArray(loadedData)) {
        coinsToUse = loadedData;
    }
    
    populateCoinDropdown(coinsToUse);
    document.getElementById("depositModal").style.display = "flex";
    isModalOpen = true;
    
    if (!coinsToUse || coinsToUse.length === 0) {
        showCustomAlert('Error: Unable to get price data. Please check the proxy server.');
    }
    
    calculateDepositValue();
}

/**
 * @param {Array<object>} coins 
 */
function populateCoinDropdown(coins) {
    const hiddenSelect = document.getElementById('deposit-symbol');
    const optionsContainer = document.getElementById('deposit-symbol-options');
    const selectedDisplay = document.getElementById('deposit-symbol-selected');
    
    hiddenSelect.innerHTML = '';
    if (optionsContainer) {
        optionsContainer.innerHTML = '';
    }

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = coins && coins.length > 0 ? 'Select a coin...' : 'No coins available';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    hiddenSelect.appendChild(defaultOption);

    if (selectedDisplay) {
        const dropdownText = selectedDisplay.querySelector('.dropdown-text');
        if (dropdownText) {
            dropdownText.textContent = coins && coins.length > 0 ? 'Select a coin...' : 'No coins available';
        }
    }

    if (coins && coins.length > 0 && optionsContainer) {
        coins.forEach(coin => {
            const symbol = coin.CoinInfo.Name;
            const fullName = coin.CoinInfo.FullName;
            const rawData = coin.RAW && coin.RAW.EUR ? coin.RAW.EUR : null;
            
            if (!rawData) return;
            
            const price = rawData.PRICE || 0;
            const change24h = rawData.CHANGEPCT24HOUR || 0;
            const volume24h = rawData.TOTALVOLUME24H || 0;
            const marketCap = rawData.MKTCAP || 0;
            const high24h = rawData.HIGH24HOUR || 0;
            const low24h = rawData.LOW24HOUR || 0;
            const iconUrl = `https://www.cryptocompare.com${coin.CoinInfo.ImageUrl}`;
            
            const hiddenOption = document.createElement('option');
            hiddenOption.value = symbol;
            hiddenOption.textContent = `${symbol} - ${fullName}`;
            hiddenOption.setAttribute('data-price', price);
            hiddenOption.setAttribute('data-icon', iconUrl);
            hiddenOption.setAttribute('data-change24h', change24h);
            hiddenOption.setAttribute('data-volume24h', volume24h);
            hiddenOption.setAttribute('data-marketcap', marketCap);
            hiddenOption.setAttribute('data-high24h', high24h);
            hiddenOption.setAttribute('data-low24h', low24h);
            hiddenOption.setAttribute('data-fullname', fullName);
            hiddenSelect.appendChild(hiddenOption);
            
            const customOption = document.createElement('div');
            customOption.className = 'custom-dropdown-option';
            customOption.setAttribute('data-value', symbol);
            customOption.setAttribute('data-price', price);
            customOption.setAttribute('data-icon', iconUrl);
            customOption.setAttribute('data-change24h', change24h);
            customOption.setAttribute('data-volume24h', volume24h);
            customOption.setAttribute('data-marketcap', marketCap);
            customOption.setAttribute('data-high24h', high24h);
            customOption.setAttribute('data-low24h', low24h);
            customOption.setAttribute('data-fullname', fullName);
            
            const changeClass = change24h >= 0 ? 'positive' : 'negative';
            const changeSign = change24h >= 0 ? '+' : '';
            
            customOption.innerHTML = `
                <img src="${iconUrl}" alt="${symbol} icon" onerror="this.src='https://placehold.co/32x32/161B22/FFFFFF?text=?'">
                <div class="custom-dropdown-option-content">
                    <div class="custom-dropdown-option-name">${fullName}</div>
                    <div class="custom-dropdown-option-symbol">${symbol}</div>
                    <div class="custom-dropdown-option-details">
                        <span class="custom-dropdown-option-price">€${formatPrice(price)}</span>
                        <span class="custom-dropdown-option-change ${changeClass}">${changeSign}${change24h.toFixed(2)}%</span>
                    </div>
                </div>
            `;
            
            customOption.addEventListener('click', () => {
                selectCoinOption(coin);
            });
            
            optionsContainer.appendChild(customOption);
        });
    }
}

/**
 */
function selectCoinOption(coin) {
    const coinInfo = coin.CoinInfo;
    const rawData = coin.RAW && coin.RAW.EUR ? coin.RAW.EUR : null;
    
    if (!rawData) return;
    
    const symbol = coinInfo.Name;
    const fullName = coinInfo.FullName;
    const price = rawData.PRICE || 0;
    const change24h = rawData.CHANGEPCT24HOUR || 0;
    const volume24h = rawData.TOTALVOLUME24H || 0;
    const marketCap = rawData.MKTCAP || 0;
    const high24h = rawData.HIGH24HOUR || 0;
    const low24h = rawData.LOW24HOUR || 0;
    const iconUrl = `https://www.cryptocompare.com${coinInfo.ImageUrl}`;
    
    const dropdownWrapper = document.getElementById('deposit-symbol-wrapper');
    const selectedDisplay = document.getElementById('deposit-symbol-selected');
    const hiddenSelect = document.getElementById('deposit-symbol');
    const iconPreviewDropdown = document.getElementById('coin-icon-preview-dropdown');
    const coinDetailsSection = document.getElementById('coin-details-section');
    
    if (dropdownWrapper) {
        dropdownWrapper.classList.remove('active');
    }
    
    if (selectedDisplay) {
        const dropdownText = selectedDisplay.querySelector('.dropdown-selected-text');
        if (dropdownText) {
            dropdownText.textContent = `${symbol} - ${fullName}`;
        }
        
        if (iconPreviewDropdown) {
            iconPreviewDropdown.innerHTML = `<img src="${iconUrl}" alt="${symbol} icon" onerror="this.src='https://placehold.co/32x32/161B22/FFFFFF?text=?'">`;
        }
    }
    
    if (hiddenSelect) {
        const option = Array.from(hiddenSelect.options).find(opt => opt.value === symbol);
        if (option) {
            hiddenSelect.selectedIndex = Array.from(hiddenSelect.options).indexOf(option);
        }
    }
    
    if (coinDetailsSection) {
        coinDetailsSection.style.display = 'block';
        
        const iconPreview = document.getElementById('coin-icon-preview');
        if (iconPreview) {
            iconPreview.innerHTML = `<img src="${iconUrl}" alt="${symbol} icon" onerror="this.src='https://placehold.co/48x48/161B22/FFFFFF?text=?'">`;
        }
        
        const coinNameDisplay = document.getElementById('coin-name-display');
        const coinSymbolDisplay = document.getElementById('coin-symbol-display');
        if (coinNameDisplay) coinNameDisplay.textContent = fullName;
        if (coinSymbolDisplay) coinSymbolDisplay.textContent = symbol;
        
        const coinPriceDisplay = document.getElementById('coin-price-display');
        if (coinPriceDisplay) coinPriceDisplay.textContent = `€${formatPrice(price)}`;
        
        const coinChangeDisplay = document.getElementById('coin-change-display');
        if (coinChangeDisplay) {
            const changeClass = change24h >= 0 ? 'positive' : 'negative';
            const changeSign = change24h >= 0 ? '+' : '';
            coinChangeDisplay.textContent = `${changeSign}${change24h.toFixed(2)}%`;
            coinChangeDisplay.className = `detail-value ${changeClass}`;
        }
        
        const coinVolumeDisplay = document.getElementById('coin-volume-display');
        if (coinVolumeDisplay) coinVolumeDisplay.textContent = `€${formatLargeNumber(volume24h)}`;
        
        const coinMarketcapDisplay = document.getElementById('coin-marketcap-display');
        if (coinMarketcapDisplay) coinMarketcapDisplay.textContent = `€${formatLargeNumber(marketCap)}`;
        
        const coinHighDisplay = document.getElementById('coin-high-display');
        if (coinHighDisplay) {
            coinHighDisplay.textContent = `€${formatPrice(high24h)}`;
            coinHighDisplay.className = 'detail-value positive';
        }
        
        const coinLowDisplay = document.getElementById('coin-low-display');
        if (coinLowDisplay) {
            coinLowDisplay.textContent = `€${formatPrice(low24h)}`;
            coinLowDisplay.className = 'detail-value negative';
        }
    }
    
    calculateDepositValue();
}

/**
 */
function setupCustomDropdown() {
    const dropdownWrapper = document.getElementById('deposit-symbol-wrapper');
    const selectedDisplay = document.getElementById('deposit-symbol-selected');
    
    if (!dropdownWrapper || !selectedDisplay) {
        return;
    }
    
    selectedDisplay.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownWrapper.classList.toggle('active');
    });
    
    document.addEventListener('click', (e) => {
        if (!dropdownWrapper.contains(e.target)) {
            dropdownWrapper.classList.remove('active');
        }
    });
}

/**
 */
function calculateDepositValue() {
    if (!isModalOpen) return;
    
    const hiddenSelect = document.getElementById('deposit-symbol');
    const quantityInput = document.getElementById('deposit-quantity');
    const valueDisplay = document.getElementById('deposit-value');

    const selectedOption = hiddenSelect ? hiddenSelect.options[hiddenSelect.selectedIndex] : null;
    const quantity = parseFloat(quantityInput.value.replace(/[^0-9.]/g, '')) || 0;
    
    let price = 0;
    let symbol = 'Coin';
    
    if (selectedOption && selectedOption.value) {
        price = parseFloat(selectedOption.getAttribute('data-price'));
        symbol = selectedOption.value;
    }
    
    const totalValue = quantity * price;
    
    valueDisplay.textContent = `€${formatPrice(totalValue)}`;
    
    const currentPriceElement = document.getElementById('current-coin-price');
    if (currentPriceElement) {
        currentPriceElement.textContent = `1 ${symbol} = €${formatPrice(price)}`;
        currentPriceElement.style.color = '#34d399';
    }
}

/**     
 */
function handleDepositConfirm() {
    const hiddenSelect = document.getElementById('deposit-symbol');
    if (!hiddenSelect || hiddenSelect.options.length <= 1) {
        showCustomAlert('Error: Unable to get valid prices. Please try again.');
        return;
    }
    
    const quantityInput = document.getElementById('deposit-quantity');
    
    const selectedOption = hiddenSelect.options[hiddenSelect.selectedIndex];
    const symbol = selectedOption ? selectedOption.value : null;
    const quantity = parseFloat(quantityInput.value);
    
    if (!symbol || quantity <= 0) {
        showCustomAlert('Error: Select a coin and enter a valid quantity.');
        return;
    }

    const price = parseFloat(selectedOption.getAttribute('data-price'));
    const change24h = parseFloat(selectedOption.getAttribute('data-change24h')) || 0;
    const iconUrl = selectedOption.getAttribute('data-icon');
    const fullName = selectedOption.getAttribute('data-fullname') || symbol;
    const totalDepositValue = quantity * price;

    if (currentBalance < totalDepositValue) {
        showCustomAlert(`Error: Insufficient funds. You need €${formatPrice(totalDepositValue)}, but you only have €${formatPrice(currentBalance)}.`);
        return;
    }

    currentBalance -= totalDepositValue;
    currentBalance = parseFloat(currentBalance.toFixed(2));

    const storageKeys = getStorageKeys();
    localStorage.setItem(storageKeys.balance, currentBalance);
    updateUI(currentBalance);
    
    addOrUpdateAsset({
        symbol: symbol,
        fullName: fullName,
        quantity: quantity,
        purchasePrice: price,
        currentPrice: price,
        change24h: change24h,
        iconUrl: iconUrl
    });
    
    addTransaction('deposit', {
        symbol: symbol,
        quantity: quantity,
        value: totalDepositValue,
        price: price
    });
    
    closeDepositModal();
    showCustomAlert(`Deposit successful: ${quantity} ${symbol} (Value: €${formatPrice(totalDepositValue)}).`);
}

/**
 */
function addOrUpdateAsset(assetData) {
    const existingAssetIndex = userAssets.findIndex(asset => asset.symbol === assetData.symbol);
    
    if (existingAssetIndex >= 0) {
        const existingAsset = userAssets[existingAssetIndex];
        const totalValue = (existingAsset.quantity * existingAsset.purchasePrice) + (assetData.quantity * assetData.purchasePrice);
        const totalQuantity = existingAsset.quantity + assetData.quantity;
        const averagePrice = totalValue / totalQuantity;
        
        userAssets[existingAssetIndex] = {
            ...existingAsset,
            quantity: totalQuantity,
            purchasePrice: averagePrice,
            currentPrice: assetData.currentPrice,
            change24h: assetData.change24h
        };
    } else {
        userAssets.push({
            symbol: assetData.symbol,
            fullName: assetData.fullName,
            quantity: assetData.quantity,
            purchasePrice: assetData.purchasePrice,
            currentPrice: assetData.currentPrice,
            change24h: assetData.change24h,
            iconUrl: assetData.iconUrl,
            purchaseDate: new Date().toISOString()
        });
    }
    
    saveUserAssets();
    renderAssets();
    updateUI(currentBalance);
}

/**
 */
function renderAssets() {
    const assetsContainer = document.getElementById('assets-container');
    if (!assetsContainer) return;
    
    if (userAssets.length === 0) {
        assetsContainer.innerHTML = '<div style="grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; min-height: 300px; color: #8B949E; font-size: 16px; text-align: center;">Nu ai assets încă. Fă un depozit pentru a începe!</div>';
        updateUI(currentBalance);
        return;
    }
    
    assetsContainer.innerHTML = '';
    
    userAssets.forEach(asset => {
        const assetCard = document.createElement('div');
        assetCard.className = 'asset-card';
        
        const currentValue = asset.quantity * asset.currentPrice;
        
        const changeClass = asset.change24h >= 0 ? 'positive' : 'negative';
        const changeSign = asset.change24h >= 0 ? '+' : '';
        
        assetCard.innerHTML = `
            <div class="asset-header">
                <div class="asset-icon-name">
                    <img src="${asset.iconUrl}" alt="${asset.symbol} icon" onerror="this.src='https://placehold.co/40x40/161B22/FFFFFF?text=?'" class="asset-icon">
                    <div class="asset-name-group">
                        <div class="asset-name">${asset.fullName}</div>
                        <div class="asset-symbol">${asset.symbol}</div>
                    </div>
                </div>
                <div class="asset-change ${changeClass}">
                    ${changeSign}${asset.change24h.toFixed(2)}%
                </div>
            </div>
            <div class="asset-details">
                <div class="asset-detail-row">
                    <span class="asset-label">Quantity:</span>
                    <span class="asset-value">${asset.quantity.toFixed(6)}</span>
                </div>
                <div class="asset-detail-row">
                    <span class="asset-label">Current price:</span>
                    <span class="asset-value">€${formatPrice(asset.currentPrice)}</span>
                </div>
                <div class="asset-detail-row">
                    <span class="asset-label">Total value:</span>
                    <span class="asset-value">€${formatPrice(currentValue)}</span>
                </div>
            </div>
        `;
        
        assetsContainer.appendChild(assetCard);
    });

    updateUI(currentBalance);
}


/**
 * @param {string} message 
 */
function showCustomAlert(message) {
    const statusDiv = document.createElement('div');
    statusDiv.className = 'temp-status-message';
    statusDiv.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: #FF5733; color: white; padding: 10px 20px; border-radius: 5px; z-index: 9999; font-weight: bold; animation: fadeout 3s forwards;';
    statusDiv.textContent = message;
    
    if (!document.getElementById('temp-alert-style')) {
         const style = document.createElement('style');
         style.id = 'temp-alert-style';
         style.innerHTML = `
             @keyframes fadeout {
                 0% { opacity: 1; transform: translateY(0); }
                 80% { opacity: 1; transform: translateY(0); }
                 100% { opacity: 0; transform: translateY(10px); }
             }
         `;
         document.head.appendChild(style);
    }
    
    document.body.appendChild(statusDiv);
    
    setTimeout(() => {
        statusDiv.remove();
    }, 3000);
}

function openAddFundsModal() {
    const modal = document.getElementById('addFundsModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('add-funds-form').reset();
    }
}

function closeAddFundsModal() {
    const modal = document.getElementById('addFundsModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('add-funds-form').reset();
    }
}

function setupAddFundsModal() {
    const modal = document.getElementById('addFundsModal');
    const closeBtn = document.getElementById('close-add-funds');
    const form = document.getElementById('add-funds-form');
    
    if (!modal || !closeBtn || !form) return;
    
    closeBtn.onclick = closeAddFundsModal;
    window.onclick = (event) => {
        if (event.target === modal) {
            closeAddFundsModal();
        }
    };
    
    const cardNumberInput = document.getElementById('card-number');
    if (cardNumberInput) {
        cardNumberInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\s/g, '');
            let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
            e.target.value = formattedValue;
        });
    }
    
    const expiryInput = document.getElementById('card-expiry');
    if (expiryInput) {
        expiryInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 2) {
                value = value.substring(0, 2) + '/' + value.substring(2, 4);
            }
            e.target.value = value;
        });
    }
    
    const cvvInput = document.getElementById('card-cvv');
    if (cvvInput) {
        cvvInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleAddFundsSubmit();
    });
}

function handleAddFundsSubmit() {
    const amount = parseFloat(document.getElementById('funds-amount').value);
    const cardName = document.getElementById('card-holder-name').value.trim();
    const cardNumber = document.getElementById('card-number').value.replace(/\s/g, '');
    const cardExpiry = document.getElementById('card-expiry').value;
    const cardCvv = document.getElementById('card-cvv').value;
    
    if (!amount || amount <= 0) {
        showCustomAlert('Error: Enter a valid amount.');
        return;
    }
    
    if (cardNumber.length < 13 || cardNumber.length > 19) {
        showCustomAlert('Error: Invalid card number.');
        return;
    }
    
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
        showCustomAlert('Error: Invalid expiration date. Use the format MM/YY.');
        return;
    }
    
    if (cardCvv.length < 3 || cardCvv.length > 4) {
        showCustomAlert('Error: Invalid CVV.');
        return;
    }
    
    closeAddFundsModal();
    
    openVerifyModal(amount);
}

function openVerifyModal(amount, successMessage = null) {
    const modal = document.getElementById('verifyModal');
    const message = document.getElementById('verify-message');
    
    if (modal && message) {
        if (successMessage) {
            message.textContent = `Processing withdrawal of €${formatPrice(amount)}. Please wait...`;
        } else {
            message.textContent = `Processing payment of €${formatPrice(amount)}. Please wait...`;
        }
        
        modal.style.display = 'flex';
        
        setTimeout(() => {
            closeVerifyModal();
            if (successMessage) {
                showCustomAlert(successMessage);
            } else {
                currentBalance += amount;
                currentBalance = parseFloat(currentBalance.toFixed(2));
                const storageKeys = getStorageKeys();
                localStorage.setItem(storageKeys.balance, currentBalance);
                updateUI(currentBalance);

                addTransaction('add_funds', {
                    amount: amount
                });
                
                showCustomAlert(`Funds added successfully! The amount of €${formatPrice(amount)} has been added to your account.`);
            }
        }, 3000);
    }
}

function closeVerifyModal() {
    const modal = document.getElementById('verifyModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function openWithdrawModal() {
    const modal = document.getElementById('withdrawModal');
    if (!modal) return;

    populateWithdrawDropdown();
    document.getElementById('withdraw-quantity').value = '';
    document.getElementById('withdraw-value').textContent = '€0.00';
    document.getElementById('withdraw-asset-info').textContent = '';
    document.getElementById('withdraw-available').textContent = '';
    modal.style.display = 'flex';
}

function closeWithdrawModal() {
    const modal = document.getElementById('withdrawModal');
    const dropdownWrapper = document.getElementById('withdraw-asset-wrapper');
    const selectedDisplay = document.getElementById('withdraw-asset-selected');
    
    if (modal) {
        modal.style.display = 'none';
    }
    
    if (dropdownWrapper) {
        dropdownWrapper.classList.remove('active');
    }
    
    if (selectedDisplay) {
        const dropdownText = selectedDisplay.querySelector('.dropdown-selected-text');
        const iconPreviewDropdown = document.getElementById('withdraw-icon-preview-dropdown');
        if (dropdownText) {
            dropdownText.textContent = 'Select a coin...';
        }
        if (iconPreviewDropdown) {
            iconPreviewDropdown.innerHTML = '';
        }
    }
    
    const useMaxBtn = document.getElementById('use-max-withdraw');
    if (useMaxBtn) {
        useMaxBtn.style.display = 'none';
    }
    
    document.getElementById('withdraw-quantity').value = '';
    document.getElementById('withdraw-value').textContent = '€0.00';
    document.getElementById('withdraw-asset-info').textContent = '';
    document.getElementById('withdraw-available').textContent = '';
}

function setupWithdrawModal() {
    const modal = document.getElementById('withdrawModal');
    const closeBtn = document.getElementById('close-withdraw');
    const qtyInput = document.getElementById('withdraw-quantity');
    const confirmBtn = document.getElementById('confirm-withdraw-btn');
    const dropdownWrapper = document.getElementById('withdraw-asset-wrapper');
    const selectedDisplay = document.getElementById('withdraw-asset-selected');

    if (!modal || !closeBtn || !qtyInput || !confirmBtn || !dropdownWrapper || !selectedDisplay) return;

    closeBtn.onclick = closeWithdrawModal;
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeWithdrawModal();
        }
    });

    selectedDisplay.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownWrapper.classList.toggle('active');
    });
    
    document.addEventListener('click', (e) => {
        if (!dropdownWrapper.contains(e.target)) {
            dropdownWrapper.classList.remove('active');
        }
    });

    qtyInput.addEventListener('input', calculateWithdrawValue);
    confirmBtn.addEventListener('click', handleWithdrawConfirm);
}

function populateWithdrawDropdown() {
    const hiddenSelect = document.getElementById('withdraw-asset');
    const optionsContainer = document.getElementById('withdraw-asset-options');
    const selectedDisplay = document.getElementById('withdraw-asset-selected');
    
    if (!hiddenSelect || !optionsContainer || !selectedDisplay) return;
    
    hiddenSelect.innerHTML = '';
    optionsContainer.innerHTML = '';
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = userAssets.length > 0 ? 'Select a coin...' : 'You have no assets available';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    hiddenSelect.appendChild(defaultOption);
    
    const dropdownText = selectedDisplay.querySelector('.dropdown-selected-text');
    const iconPreview = document.getElementById('withdraw-icon-preview-dropdown');
    if (dropdownText) {
        dropdownText.textContent = userAssets.length > 0 ? 'Select a coin...' : 'You have no assets available';
    }
    if (iconPreview) {
        iconPreview.innerHTML = '';
    }
    
    if (userAssets.length > 0) {
        userAssets.forEach(asset => {
            const hiddenOption = document.createElement('option');
            hiddenOption.value = asset.symbol;
            hiddenOption.textContent = `${asset.symbol} - ${asset.fullName}`;
            hiddenOption.setAttribute('data-price', asset.currentPrice);
            hiddenOption.setAttribute('data-quantity', asset.quantity);
            hiddenOption.setAttribute('data-icon', asset.iconUrl);
            hiddenSelect.appendChild(hiddenOption);
            
            const customOption = document.createElement('div');
            customOption.className = 'custom-dropdown-option';
            customOption.setAttribute('data-value', asset.symbol);
            customOption.setAttribute('data-price', asset.currentPrice);
            customOption.setAttribute('data-quantity', asset.quantity);
            customOption.setAttribute('data-icon', asset.iconUrl);
            
            const currentValue = asset.quantity * asset.currentPrice;
            
            customOption.innerHTML = `
                <img src="${asset.iconUrl}" alt="${asset.symbol} icon" onerror="this.src='https://placehold.co/24x24/161B22/FFFFFF?text=?'">
                <div class="custom-dropdown-option-content">
                    <div class="custom-dropdown-option-name">${asset.fullName}</div>
                    <div class="custom-dropdown-option-symbol">${asset.symbol}</div>
                    <div class="custom-dropdown-option-details">
                        <span class="custom-dropdown-option-price">€${formatPrice(asset.currentPrice)}</span>
                        <span class="custom-dropdown-option-price">Disponibil: ${asset.quantity.toFixed(6)}</span>
                    </div>
                </div>
            `;
            
            customOption.addEventListener('click', () => {
                selectWithdrawAsset(asset);
            });
            
            optionsContainer.appendChild(customOption);
        });
    }
}

function selectWithdrawAsset(asset) {
    const dropdownWrapper = document.getElementById('withdraw-asset-wrapper');
    const selectedDisplay = document.getElementById('withdraw-asset-selected');
    const hiddenSelect = document.getElementById('withdraw-asset');
    const iconPreviewDropdown = document.getElementById('withdraw-icon-preview-dropdown');
    
    if (dropdownWrapper) {
        dropdownWrapper.classList.remove('active');
    }
    
    if (selectedDisplay) {
        const dropdownText = selectedDisplay.querySelector('.dropdown-selected-text');
        if (dropdownText) {
            dropdownText.textContent = `${asset.symbol} - ${asset.fullName}`;
        }
        
        if (iconPreviewDropdown) {
            iconPreviewDropdown.innerHTML = `<img src="${asset.iconUrl}" alt="${asset.symbol} icon" onerror="this.src='https://placehold.co/20x20/161B22/FFFFFF?text=?'" style="width: 20px; height: 20px;">`;
        }
    }
    
    if (hiddenSelect) {
        const option = Array.from(hiddenSelect.options).find(opt => opt.value === asset.symbol);
        if (option) {
            hiddenSelect.selectedIndex = Array.from(hiddenSelect.options).indexOf(option);
        }
    }
    
    const assetInfo = document.getElementById('withdraw-asset-info');
    const availableInfo = document.getElementById('withdraw-available');
    
    if (assetInfo) {
        assetInfo.textContent = `Preț curent: €${formatPrice(asset.currentPrice)}`;
    }
    
    if (availableInfo) {
        availableInfo.textContent = `Disponibil: ${asset.quantity.toFixed(6)} ${asset.symbol}`;
    }
    
    const useMaxBtn = document.getElementById('use-max-withdraw');
    if (useMaxBtn) {
        useMaxBtn.style.display = 'block';
        useMaxBtn.onclick = () => {
            const qtyInput = document.getElementById('withdraw-quantity');
            if (qtyInput) {
                qtyInput.value = asset.quantity.toFixed(6);
                calculateWithdrawValue();
            }
        };
    }
    
    calculateWithdrawValue();
}

function calculateWithdrawValue() {
    const hiddenSelect = document.getElementById('withdraw-asset');
    const qtyInput = document.getElementById('withdraw-quantity');
    const valueDisplay = document.getElementById('withdraw-value');
    const infoDisplay = document.getElementById('withdraw-asset-info');
    const availableDisplay = document.getElementById('withdraw-available');

    if (!hiddenSelect || !qtyInput || !valueDisplay) return;

    const selectedOption = hiddenSelect.options[hiddenSelect.selectedIndex];
    const quantity = parseFloat(qtyInput.value) || 0;

    if (!selectedOption || !selectedOption.value) {
        valueDisplay.textContent = '€0.00';
        if (infoDisplay) infoDisplay.textContent = '';
        if (availableDisplay) availableDisplay.textContent = '';
        return;
    }

    const price = parseFloat(selectedOption.getAttribute('data-price')) || 0;
    const availableQty = parseFloat(selectedOption.getAttribute('data-quantity')) || 0;

    const totalValue = quantity * price;
    valueDisplay.textContent = `€${formatPrice(totalValue)}`;

    if (infoDisplay) {
        infoDisplay.textContent = `Preț curent: €${formatPrice(price)}`;
    }

    if (availableDisplay) {
        availableDisplay.textContent = `Disponibil: ${availableQty.toFixed(6)} ${selectedOption.value}`;
    }
}

function handleWithdrawConfirm() {
    const hiddenSelect = document.getElementById('withdraw-asset');
    const qtyInput = document.getElementById('withdraw-quantity');

    if (!hiddenSelect || !qtyInput) return;

    const selectedOption = hiddenSelect.options[hiddenSelect.selectedIndex];
    const symbol = selectedOption ? selectedOption.value : null;
    const quantity = parseFloat(qtyInput.value);

    if (!symbol || quantity <= 0) {
        showCustomAlert('Error: Select a coin and enter a valid quantity.');
        return;
    }

    const price = parseFloat(selectedOption.getAttribute('data-price')) || 0;
    const availableQty = parseFloat(selectedOption.getAttribute('data-quantity')) || 0;

    if (quantity > availableQty) {
        showCustomAlert('Error: Quantity unavailable for withdrawal.');
        return;
    }

    const totalValue = quantity * price;

    const assetIndex = userAssets.findIndex(a => a.symbol === symbol);
    if (assetIndex >= 0) {
        userAssets[assetIndex].quantity = parseFloat((userAssets[assetIndex].quantity - quantity).toFixed(6));
        if (userAssets[assetIndex].quantity <= 0) {
            userAssets.splice(assetIndex, 1);
        }
    }

    currentBalance += totalValue;
    currentBalance = parseFloat(currentBalance.toFixed(2));
    const storageKeys = getStorageKeys();
    localStorage.setItem(storageKeys.balance, currentBalance);
    updateUI(currentBalance);

    saveUserAssets();
    renderAssets();

    addTransaction('withdraw', {
        symbol: symbol,
        quantity: quantity,
        value: totalValue,
        price: price
    });

    closeWithdrawModal();

    openVerifyModal(totalValue, `Withdrawal successful! ${quantity} ${symbol} (Value: €${formatPrice(totalValue)}) has been converted to balance.`);
}


async function openSwapModal() {
    const modal = document.getElementById('swapModal');
    if (!modal) return;

    const loadedData = await ensureMarketDataLoaded();
    let coinsToUse = allMarketData;
    
    if (loadedData && Array.isArray(loadedData)) {
        coinsToUse = loadedData;
    }

    populateSwapDropdowns(coinsToUse);
    modal.style.display = 'flex';
    
    document.getElementById('swap-quantity').value = '';
    document.getElementById('swap-receive-value').textContent = '0.00';
    document.getElementById('swap-from-info').textContent = '';
    document.getElementById('swap-to-info').textContent = '';
    document.getElementById('swap-available').textContent = '';
    
    const useMaxBtn = document.getElementById('use-max-swap');
    if (useMaxBtn) {
        useMaxBtn.style.display = 'none';
    }
}

function closeSwapModal() {
    const modal = document.getElementById('swapModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    const fromWrapper = document.getElementById('swap-from-wrapper');
    const toWrapper = document.getElementById('swap-to-wrapper');
    if (fromWrapper) fromWrapper.classList.remove('active');
    if (toWrapper) toWrapper.classList.remove('active');
    
    const fromSelected = document.getElementById('swap-from-selected');
    const toSelected = document.getElementById('swap-to-selected');
    if (fromSelected) {
        const text = fromSelected.querySelector('.dropdown-selected-text');
        if (text) text.textContent = 'Select a coin...';
    }
    if (toSelected) {
        const text = toSelected.querySelector('.dropdown-selected-text');
        if (text) text.textContent = 'Select a coin...';
    }
    
    const fromIcon = document.getElementById('swap-from-icon-preview');
    const toIcon = document.getElementById('swap-to-icon-preview');
    if (fromIcon) fromIcon.innerHTML = '';
    if (toIcon) toIcon.innerHTML = '';
}

function populateSwapDropdowns(coins) {
    populateSwapFromDropdown();
    
    populateSwapToDropdown(coins);
}

function populateSwapFromDropdown() {
    const hiddenSelect = document.getElementById('swap-from-asset');
    const optionsContainer = document.getElementById('swap-from-options');
    const selectedDisplay = document.getElementById('swap-from-selected');
    
    if (!hiddenSelect || !optionsContainer || !selectedDisplay) return;
    
    hiddenSelect.innerHTML = '';
    optionsContainer.innerHTML = '';
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = userAssets.length > 0 ? 'Select a coin...' : 'You have no assets available';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    hiddenSelect.appendChild(defaultOption);
    
    if (userAssets.length > 0) {
        userAssets.forEach(asset => {
            const hiddenOption = document.createElement('option');
            hiddenOption.value = asset.symbol;
            hiddenOption.textContent = `${asset.symbol} - ${asset.fullName}`;
            hiddenOption.setAttribute('data-price', asset.currentPrice);
            hiddenOption.setAttribute('data-quantity', asset.quantity);
            hiddenOption.setAttribute('data-icon', asset.iconUrl);
            hiddenSelect.appendChild(hiddenOption);
            
            const customOption = document.createElement('div');
            customOption.className = 'custom-dropdown-option';
            customOption.setAttribute('data-value', asset.symbol);
            customOption.setAttribute('data-price', asset.currentPrice);
            customOption.setAttribute('data-quantity', asset.quantity);
            customOption.setAttribute('data-icon', asset.iconUrl);
            
            customOption.innerHTML = `
                <img src="${asset.iconUrl}" alt="${asset.symbol} icon" onerror="this.src='https://placehold.co/24x24/161B22/FFFFFF?text=?'">
                <div class="custom-dropdown-option-content">
                    <div class="custom-dropdown-option-name">${asset.fullName}</div>
                    <div class="custom-dropdown-option-symbol">${asset.symbol}</div>
                    <div class="custom-dropdown-option-details">
                        <span class="custom-dropdown-option-price">€${formatPrice(asset.currentPrice)}</span>
                        <span class="custom-dropdown-option-price">Disponibil: ${asset.quantity.toFixed(6)}</span>
                    </div>
                </div>
            `;
            
            customOption.addEventListener('click', () => {
                selectSwapFromAsset(asset);
            });
            
            optionsContainer.appendChild(customOption);
        });
    }
}

function populateSwapToDropdown(coins) {
    const hiddenSelect = document.getElementById('swap-to-asset');
    const optionsContainer = document.getElementById('swap-to-options');
    const selectedDisplay = document.getElementById('swap-to-selected');
    const fromSelect = document.getElementById('swap-from-asset');
    
    if (!hiddenSelect || !optionsContainer || !selectedDisplay) return;
    
    hiddenSelect.innerHTML = '';
    optionsContainer.innerHTML = '';
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a coin...';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    hiddenSelect.appendChild(defaultOption);
    
    const selectedFromSymbol = fromSelect ? fromSelect.options[fromSelect.selectedIndex]?.value : null;
    
    if (coins && coins.length > 0) {
        coins.forEach(coin => {
            const symbol = coin.CoinInfo.Name;
            const fullName = coin.CoinInfo.FullName;
            const rawData = coin.RAW && coin.RAW.EUR ? coin.RAW.EUR : null;
            
            if (!rawData) return;
            
            if (selectedFromSymbol && symbol === selectedFromSymbol) {
                return;
            }
            
            const price = rawData.PRICE || 0;
            const change24h = rawData.CHANGEPCT24HOUR || 0;
            const iconUrl = `https://www.cryptocompare.com${coin.CoinInfo.ImageUrl}`;
            
            const hiddenOption = document.createElement('option');
            hiddenOption.value = symbol;
            hiddenOption.textContent = `${symbol} - ${fullName}`;
            hiddenOption.setAttribute('data-price', price);
            hiddenOption.setAttribute('data-icon', iconUrl);
            hiddenOption.setAttribute('data-change24h', change24h);
            hiddenSelect.appendChild(hiddenOption);
            
            const customOption = document.createElement('div');
            customOption.className = 'custom-dropdown-option';
            customOption.setAttribute('data-value', symbol);
            customOption.setAttribute('data-price', price);
            customOption.setAttribute('data-icon', iconUrl);
            customOption.setAttribute('data-change24h', change24h);
            
            const changeClass = change24h >= 0 ? 'positive' : 'negative';
            const changeSign = change24h >= 0 ? '+' : '';
            
            customOption.innerHTML = `
                <img src="${iconUrl}" alt="${symbol} icon" onerror="this.src='https://placehold.co/24x24/161B22/FFFFFF?text=?'">
                <div class="custom-dropdown-option-content">
                    <div class="custom-dropdown-option-name">${fullName}</div>
                    <div class="custom-dropdown-option-symbol">${symbol}</div>
                    <div class="custom-dropdown-option-details">
                        <span class="custom-dropdown-option-price">€${formatPrice(price)}</span>
                        <span class="custom-dropdown-option-change ${changeClass}">${changeSign}${change24h.toFixed(2)}%</span>
                    </div>
                </div>
            `;
            
            customOption.addEventListener('click', () => {
                selectSwapToAsset(coin);
            });
            
            optionsContainer.appendChild(customOption);
        });
    }
}

function selectSwapFromAsset(asset) {
    const dropdownWrapper = document.getElementById('swap-from-wrapper');
    const selectedDisplay = document.getElementById('swap-from-selected');
    const hiddenSelect = document.getElementById('swap-from-asset');
    const iconPreview = document.getElementById('swap-from-icon-preview');
    
    if (dropdownWrapper) dropdownWrapper.classList.remove('active');
    
    if (selectedDisplay) {
        const dropdownText = selectedDisplay.querySelector('.dropdown-selected-text');
        if (dropdownText) {
            dropdownText.textContent = `${asset.symbol} - ${asset.fullName}`;
        }
    }
    
    if (iconPreview) {
        iconPreview.innerHTML = `<img src="${asset.iconUrl}" alt="${asset.symbol} icon" onerror="this.src='https://placehold.co/20x20/161B22/FFFFFF?text=?'" style="width: 20px; height: 20px;">`;
    }
    
    if (hiddenSelect) {
        const option = Array.from(hiddenSelect.options).find(opt => opt.value === asset.symbol);
        if (option) {
            hiddenSelect.selectedIndex = Array.from(hiddenSelect.options).indexOf(option);
        }
    }

    const assetInfo = document.getElementById('swap-from-info');
    if (assetInfo) {
        assetInfo.textContent = `Preț: €${formatPrice(asset.currentPrice)} | Disponibil: ${asset.quantity.toFixed(6)}`;
    }
    
    const loadedData = allMarketData.length > 0 ? allMarketData : null;
    if (loadedData) {
        populateSwapToDropdown(loadedData);
    }
    
    const toSelect = document.getElementById('swap-to-asset');
    const toSelected = document.getElementById('swap-to-selected');
    if (toSelect && toSelect.options[toSelect.selectedIndex]?.value === asset.symbol) {
        toSelect.selectedIndex = 0;
        if (toSelected) {
            const text = toSelected.querySelector('.dropdown-selected-text');
            if (text) text.textContent = 'Select a coin...';
        }
        const toIcon = document.getElementById('swap-to-icon-preview');
        if (toIcon) toIcon.innerHTML = '';
    }
    
    const useMaxBtn = document.getElementById('use-max-swap');
    if (useMaxBtn) {
        useMaxBtn.style.display = 'block';
        useMaxBtn.onclick = () => {
            const qtyInput = document.getElementById('swap-quantity');
            if (qtyInput) {
                qtyInput.value = asset.quantity.toFixed(6);
                calculateSwapValue();
            }
        };
    }
    
    calculateSwapValue();
}

function selectSwapToAsset(coin) {
    const coinInfo = coin.CoinInfo;
    const rawData = coin.RAW && coin.RAW.EUR ? coin.RAW.EUR : null;
    
    if (!rawData) return;
    
    const symbol = coinInfo.Name;
    const fullName = coinInfo.FullName;
    const price = rawData.PRICE || 0;
    const change24h = rawData.CHANGEPCT24HOUR || 0;
    const iconUrl = `https://www.cryptocompare.com${coinInfo.ImageUrl}`;
    
    const dropdownWrapper = document.getElementById('swap-to-wrapper');
    const selectedDisplay = document.getElementById('swap-to-selected');
    const hiddenSelect = document.getElementById('swap-to-asset');
    const iconPreview = document.getElementById('swap-to-icon-preview');
    
    if (dropdownWrapper) dropdownWrapper.classList.remove('active');
    
    if (selectedDisplay) {
        const dropdownText = selectedDisplay.querySelector('.dropdown-selected-text');
        if (dropdownText) {
            dropdownText.textContent = `${symbol} - ${fullName}`;
        }
    }
    
    if (iconPreview) {
        iconPreview.innerHTML = `<img src="${iconUrl}" alt="${symbol} icon" onerror="this.src='https://placehold.co/20x20/161B22/FFFFFF?text=?'" style="width: 20px; height: 20px;">`;
    }
    
    if (hiddenSelect) {
        const option = Array.from(hiddenSelect.options).find(opt => opt.value === symbol);
        if (option) {
            hiddenSelect.selectedIndex = Array.from(hiddenSelect.options).indexOf(option);
        }
    }
    
    const assetInfo = document.getElementById('swap-to-info');
    if (assetInfo) {
        const changeClass = change24h >= 0 ? 'positive' : 'negative';
        const changeSign = change24h >= 0 ? '+' : '';
        assetInfo.innerHTML = `Price: €${formatPrice(price)} | <span class="${changeClass}">${changeSign}${change24h.toFixed(2)}%</span>`;
    }
    
    calculateSwapValue();
}

function calculateSwapValue() {
    const fromSelect = document.getElementById('swap-from-asset');
    const toSelect = document.getElementById('swap-to-asset');
    const quantityInput = document.getElementById('swap-quantity');
    const receiveDisplay = document.getElementById('swap-receive-value');
    const availableDisplay = document.getElementById('swap-available');
    
    if (!fromSelect || !toSelect || !quantityInput || !receiveDisplay) return;
    
    const fromOption = fromSelect.options[fromSelect.selectedIndex];
    const toOption = toSelect.options[toSelect.selectedIndex];
    const quantity = parseFloat(quantityInput.value) || 0;
    
    if (!fromOption || !fromOption.value || !toOption || !toOption.value) {
        receiveDisplay.textContent = '0.00';
        if (availableDisplay) availableDisplay.textContent = '';
        return;
    }
    
    const fromPrice = parseFloat(fromOption.getAttribute('data-price'));
    const toPrice = parseFloat(toOption.getAttribute('data-price'));
    const availableQty = parseFloat(fromOption.getAttribute('data-quantity'));
    
    if (fromPrice && toPrice && quantity > 0) { 
        const fromValue = quantity * fromPrice;
        const receiveQuantity = fromValue / toPrice;
        
        receiveDisplay.textContent = `${receiveQuantity.toFixed(6)} ${toOption.value}`;
    } else {
        receiveDisplay.textContent = '0.00';
    }
    
    if (availableDisplay && fromOption.value) {
        availableDisplay.textContent = `Disponibil: ${availableQty.toFixed(6)} ${fromOption.value}`;
    }
}

function setupSwapModal() {
    const modal = document.getElementById('swapModal');
    const closeBtn = document.getElementById('close-swap');
    const quantityInput = document.getElementById('swap-quantity');
    const confirmBtn = document.getElementById('confirm-swap-btn');
    const fromWrapper = document.getElementById('swap-from-wrapper');
    const toWrapper = document.getElementById('swap-to-wrapper');
    const fromSelected = document.getElementById('swap-from-selected');
    const toSelected = document.getElementById('swap-to-selected');
    
    if (!modal || !closeBtn || !quantityInput || !confirmBtn || !fromWrapper || !toWrapper) return;
    
    closeBtn.onclick = closeSwapModal;
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeSwapModal();
        }
    });
    
    fromSelected.addEventListener('click', (e) => {
        e.stopPropagation();
        fromWrapper.classList.toggle('active');
        toWrapper.classList.remove('active');
    });
    
    toSelected.addEventListener('click', (e) => {
        e.stopPropagation();
        toWrapper.classList.toggle('active');
        fromWrapper.classList.remove('active');
    });
    
    document.addEventListener('click', (e) => {
        if (!fromWrapper.contains(e.target)) {
            fromWrapper.classList.remove('active');
        }
        if (!toWrapper.contains(e.target)) {
            toWrapper.classList.remove('active');
        }
    });
    
    quantityInput.addEventListener('input', calculateSwapValue);
    confirmBtn.addEventListener('click', handleSwapConfirm);
}

function handleSwapConfirm() {
    const fromSelect = document.getElementById('swap-from-asset');
    const toSelect = document.getElementById('swap-to-asset');
    const quantityInput = document.getElementById('swap-quantity');
    
    if (!fromSelect || !toSelect || !quantityInput) return;
    
    const fromOption = fromSelect.options[fromSelect.selectedIndex];
    const toOption = toSelect.options[toSelect.selectedIndex];
    const quantity = parseFloat(quantityInput.value);
    
    if (!fromOption || !fromOption.value) {
        showCustomAlert('Error: Select a coin to swap.');
        return;
    }
    
    if (!toOption || !toOption.value) {
        showCustomAlert('Error: Select a coin to swap to.');
        return;
    }
    
    if (fromOption.value === toOption.value) {
        showCustomAlert('Error: You cannot swap a coin with itself.');
        return;
    }
    
    if (!quantity || quantity <= 0) {
        showCustomAlert('Error: Enter a valid quantity.');
        return;
    }
    
    const fromPrice = parseFloat(fromOption.getAttribute('data-price'));
    const toPrice = parseFloat(toOption.getAttribute('data-price'));
    const toIconUrl = toOption.getAttribute('data-icon');
    const toFullName = toOption.textContent.split(' - ')[1] || toOption.value;
    
    const fromAssetIndex = userAssets.findIndex(a => a.symbol === fromOption.value);
    if (fromAssetIndex === -1) {
        showCustomAlert('Error: Asset not found.');
        return;
    }
    
    const fromAsset = userAssets[fromAssetIndex];
    const availableQty = fromAsset.quantity;
    
    if (quantity > availableQty) {
        showCustomAlert(`Error: You do not have enough ${fromOption.value}. Available: ${availableQty.toFixed(6)}`);
        return;
    }
    
    const fromValue = quantity * fromPrice;
    const receiveQuantity = fromValue / toPrice;
    
    fromAsset.quantity -= quantity;
    fromAsset.quantity = parseFloat(fromAsset.quantity.toFixed(6));
    
    if (fromAsset.quantity <= 0) {
        userAssets.splice(fromAssetIndex, 1);
    }
    
    const toAssetIndex = userAssets.findIndex(a => a.symbol === toOption.value);
    
    if (toAssetIndex >= 0) {
        const existingAsset = userAssets[toAssetIndex];
        const totalValue = (existingAsset.quantity * existingAsset.currentPrice) + (receiveQuantity * toPrice);
        const totalQuantity = existingAsset.quantity + receiveQuantity;
        const averagePrice = totalValue / totalQuantity;
        
        userAssets[toAssetIndex] = {
            ...existingAsset,
            quantity: totalQuantity,
            purchasePrice: averagePrice,
            currentPrice: toPrice
        };
    } else {
        userAssets.push({
            symbol: toOption.value,
            fullName: toFullName,
            quantity: receiveQuantity,
            purchasePrice: toPrice,
            currentPrice: toPrice,
            change24h: parseFloat(toOption.getAttribute('data-change24h')) || 0,
            iconUrl: toIconUrl,
            purchaseDate: new Date().toISOString()
        });
    }
    
    saveUserAssets();
    renderAssets();
    updateUI(currentBalance);
    
    addTransaction('swap', {
        fromSymbol: fromOption.value,
        fromQuantity: quantity,
        fromValue: fromValue,
        toSymbol: toOption.value,
        toQuantity: receiveQuantity,
        toPrice: toPrice
    });
    
        closeSwapModal();
    
    openVerifyModal(
        fromValue, 
        `Swap successful! ${quantity.toFixed(6)} ${fromOption.value} has been swapped for ${receiveQuantity.toFixed(6)} ${toOption.value}.`
    );
}