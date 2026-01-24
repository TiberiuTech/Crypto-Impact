import { formatPrice, formatLargeNumber } from '../../utils/formatters.js'; 
import { allMarketData } from '../../client.js'; 

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
        transactions: `orionix_wallet_transactions_${userId}`
    };
}

// Soldul simulat inițial
const INITIAL_BALANCE = 123456.78; 
let currentBalance = INITIAL_BALANCE;
let userAssets = []; // Array cu assets-urile utilizatorului
let transactions = []; // Array cu tranzacțiile utilizatorului
let isModalOpen = false;
const MARKET_URL = 'http://localhost:3000/api/market'; // URL-ul API-ului de piață

// Așteaptă ca DOM-ul să fie complet încărcat
document.addEventListener("DOMContentLoaded", () => {
    // Reîncărcăm datele când utilizatorul se schimbă
    loadInitialData();
    loadUserAssets();
    loadTransactions();
    setupButtonListeners();
    setupDepositModalListeners(); // Inițializează ascultătorii pentru modal
    setupAddFundsModal(); // Inițializează modalul de adăugare fonduri
    setupWithdrawModal(); // Inițializează modalul de retragere
    setupSwapModal(); // Inițializează modalul de swap
});

// Ascultăm pentru schimbări în localStorage (când utilizatorul se loghează/înregistrează)
window.addEventListener('storage', function(e) {
    if (e.key === 'user') {
        // Utilizatorul s-a schimbat - reîncărcăm datele
        loadInitialData();
        loadUserAssets();
        loadTransactions();
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
        loadInitialData();
        loadUserAssets();
        loadTransactions();
    }
    
    lastUserId = currentUserId;
}

// Verificăm la încărcarea paginii
checkUserChange();

// Verificăm periodic (în cazul în care utilizatorul se schimbă în același tab)
setInterval(checkUserChange, 1000);


/**
 * Funcție de suport: forțează încărcarea datelor de piață dacă acestea lipsesc,
 * asigurând că dropdown-ul poate fi populat indiferent de pagina vizitată anterior.
 */
async function ensureMarketDataLoaded() {
    if (allMarketData.length > 0) {
        return true;
    }
    
    // Nu mai afișăm alerta "se încarcă", ci lăsăm utilizatorul să aștepte.

    try {
        const response = await fetch(MARKET_URL);
        
        if (!response.ok) {
            throw new Error('Eroare la serverul proxy (verifică portul 3000).');
        }
        
        const data = await response.json();
        const coins = data.Data;
        
        if (!Array.isArray(coins) || coins.length === 0) {
            throw new Error("Date de piață goale.");
        }
        
        // Filtrare și populare
        const filteredCoins = coins.filter(coin => coin.RAW && coin.RAW.EUR);

        // ATENȚIE: Returnăm datele filtrate local.
        return filteredCoins;

    } catch (error) {
        console.error("Eroare la încărcarea forțată a datelor de piață:", error);
        showCustomAlert(`Eroare: ${error.message}.`);
        return false;
    }
}


/**
 * Încarcă soldul din localStorage sau folosește valoarea inițială.
 */
function loadInitialData() {
    const storageKeys = getStorageKeys();
    // Încercăm să preluăm soldul stocat pentru utilizatorul curent
    const storedBalance = localStorage.getItem(storageKeys.balance);
    
    if (storedBalance !== null) {
        currentBalance = parseFloat(storedBalance);
    } else {
        // Dacă nu există, setăm soldul inițial pentru noul utilizator
        localStorage.setItem(storageKeys.balance, INITIAL_BALANCE);
        currentBalance = INITIAL_BALANCE;
    }
    
    updateUI(currentBalance);
}

/**
 * Încarcă assets-urile utilizatorului din localStorage.
 */
function loadUserAssets() {
    const storageKeys = getStorageKeys();
    const storedAssets = localStorage.getItem(storageKeys.assets);
    
    if (storedAssets) {
        try {
            userAssets = JSON.parse(storedAssets);
            renderAssets();
        } catch (error) {
            console.error('Eroare la încărcarea assets-urilor:', error);
            userAssets = [];
        }
    } else {
        userAssets = [];
    }
}

/**
 * Salvează assets-urile în localStorage.
 */
function saveUserAssets() {
    const storageKeys = getStorageKeys();
    localStorage.setItem(storageKeys.assets, JSON.stringify(userAssets));
}

/**
 * Încarcă tranzacțiile din localStorage.
 */
async function loadTransactions() {
    const storageKeys = getStorageKeys();
    const storedTransactions = localStorage.getItem(storageKeys.transactions);
    
    if (storedTransactions) {
        try {
            transactions = JSON.parse(storedTransactions);
            await renderTransactions();
        } catch (error) {
            console.error('Eroare la încărcarea tranzacțiilor:', error);
            transactions = [];
        }
    } else {
        transactions = [];
    }
}

/**
 * Salvează tranzacțiile în localStorage.
 */
function saveTransactions() {
    const storageKeys = getStorageKeys();
    localStorage.setItem(storageKeys.transactions, JSON.stringify(transactions));
}

/**
 * Adaugă o tranzacție nouă.
 */
async function addTransaction(type, details) {
    const transaction = {
        id: Date.now(),
        type: type, // 'deposit', 'add_funds', 'withdraw', 'swap'
        date: new Date().toISOString(),
        details: details
    };
    
    transactions.unshift(transaction); // Adăugăm la început
    
    // Păstrăm doar ultimele 50 de tranzacții
    if (transactions.length > 50) {
        transactions = transactions.slice(0, 50);
    }
    
    saveTransactions();
    await renderTransactions();
}

/**
 * Renderizează tranzacțiile în UI.
 */
async function renderTransactions() {
    const transactionsContainer = document.getElementById('transactions-container');
    if (!transactionsContainer) return;
    
    if (transactions.length === 0) {
        transactionsContainer.innerHTML = '<p style="color: #8B949E; text-align: center; padding: 20px;">Aici vor apărea tranzacțiile tale viitoare.</p>';
        return;
    }
    
    // Asigurăm că datele de piață sunt încărcate
    if (!allMarketData || allMarketData.length === 0) {
        await ensureMarketDataLoaded();
    }
    
    transactionsContainer.innerHTML = '';
    
    transactions.forEach(transaction => {
        const transactionCard = document.createElement('div');
        transactionCard.className = 'transaction-card';
        
        const date = new Date(transaction.date);
        const formattedDate = date.toLocaleDateString('ro-RO', {
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
                amount = `-€${formatPrice(transaction.details.value)}`; // Scade din balanță
                break;
            case 'add_funds':
                typeLabel = 'Adăugare Fonduri';
                typeClass = 'transaction-type-add-funds';
                description = 'Adăugare fonduri prin card';
                amount = `+€${formatPrice(transaction.details.amount)}`; // Crește balanța
                break;
            case 'withdraw':
                typeLabel = 'Retragere';
                typeClass = 'transaction-type-withdraw';
                description = `${transaction.details.quantity} ${transaction.details.symbol}`;
                amount = `+€${formatPrice(transaction.details.value)}`; // Crește balanța
                break;
            case 'swap':
                typeLabel = 'Swap';
                typeClass = 'transaction-type-swap';
                // Formatăm cantitățile pentru a fi mai ușor de citit
                const fromQty = parseFloat(transaction.details.fromQuantity);
                const toQty = parseFloat(transaction.details.toQuantity);
                
                // Funcție helper pentru formatare cantități
                const formatQuantity = (qty) => {
                    if (qty >= 1) {
                        // Pentru numere >= 1, afișăm maxim 6 zecimale
                        return qty.toFixed(6).replace(/\.?0+$/, '');
                    } else if (qty >= 0.000001) {
                        // Pentru numere între 0.000001 și 1, afișăm maxim 8 zecimale
                        return qty.toFixed(8).replace(/\.?0+$/, '');
                    } else {
                        // Pentru numere foarte mici, folosim notare științifică sau limităm zecimalele
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
 * Calculează valoarea totală a portofelului (suma valorilor tuturor assets-urilor).
 * @returns {number} Valoarea totală a portofelului în EUR.
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
 * Actualizează elementele UI cu soldul curent și valoarea portofelului.
 * @param {number} balance - Soldul de afișat.
 */
function updateUI(balance) {
    const balanceElement = document.querySelector('.balance-value');
    const walletTotalValueElement = document.querySelector('.wallet-total-value');
    const greetingNameElement = document.getElementById('greeting-name');
    
    // Folosim formatarea localizată în USD pentru balanță
    const formattedBalance = balance.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    if (balanceElement) {
        balanceElement.textContent = formattedBalance;
    }
    
    // Calculăm și afișăm valoarea totală a portofelului
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
    
    // Actualizăm numele utilizatorului
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

/**
 * Setează ascultătorii de evenimente pentru butoane.
 */
function setupButtonListeners() {
    // Deschide modalul de depozit la click pe butonul de depozit
    document.querySelector('.action-column-group .main-actions .primary').addEventListener('click', () => {
        openDepositModal();
    });
    
    // Deschide modalul de adăugare fonduri
    document.querySelector('.action-column-group .secondary-actions .primary').addEventListener('click', () => {
        openAddFundsModal();
    });
    
    // Buton Retragere (secundar)
    document.querySelector('.action-column-group .main-actions .secondary').addEventListener('click', () => {
        openWithdrawModal();
    });
    
    // Buton Swap (Schimbă)
    document.querySelector('.action-column-group .secondary-actions .secondary').addEventListener('click', () => {
        openSwapModal();
    });
}

/**
 * Gestionează tranzacțiile simulate (Retragere).
 * @param {string} type - 'Withdraw'.
 */
function handleTransaction(type) {
    // Doar logica de Retragere rămâne aici.
    if (type !== 'Withdraw') return;

    const amount = 50.00; // Sumă fixă pentru simulare
    
    if (currentBalance < amount) {
        showCustomAlert('Eroare: Fonduri insuficiente pentru această retragere simulată.');
        return;
    }
    
    // Simulăm tranzacția
    currentBalance -= amount;
    currentBalance = parseFloat(currentBalance.toFixed(2));

    // Salvăm noul sold și actualizăm UI
    const storageKeys = getStorageKeys();
    localStorage.setItem(storageKeys.balance, currentBalance);
    updateUI(currentBalance);
    showCustomAlert(`Tranzacție reușită! Ai retras $${amount.toFixed(2)}. Noul sold este afișat.`);
}


// =========================================================================
// LOGICA MODALULUI DE DEPOZIT 
// =========================================================================

function setupDepositModalListeners() {
    const modal = document.getElementById("depositModal");
    
    // Verifică dacă modalul există înainte de a continua
    if (!modal) {
        console.warn("Modalul de depozit (#depositModal) nu a fost găsit. Ascultătorii nu au fost inițializați.");
        return; 
    }
    
    const closeBtn = modal.querySelector(".close-button");
    
    if (!closeBtn) {
        console.error("Butonul de închidere al modalului lipsește.");
        return;
    }

    closeBtn.onclick = closeDepositModal;
    window.onclick = (event) => {
        if (event.target === modal) {
            closeDepositModal();
        }
    };
    
    // Ascultători pentru schimbarea monedei și a cantității
    setupCustomDropdown();
    document.getElementById('deposit-quantity').addEventListener('input', calculateDepositValue);
    
    // Ascultător pentru butonul de Confirmare
    document.getElementById('confirm-deposit-btn').addEventListener('click', handleDepositConfirm);
}

function closeDepositModal() {
    document.getElementById("depositModal").style.display = "none";
    isModalOpen = false;
    // Resetăm formularul
    document.getElementById('deposit-quantity').value = '';
    document.getElementById('deposit-value').textContent = '€0.00';
    // Resetăm dropdown-ul custom
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
    
    // Ascundem secțiunea de detalii
    if (coinDetailsSection) {
        coinDetailsSection.style.display = 'none';
    }
    
    // Resetăm prețul curent afișat
    const currentPriceElement = document.getElementById('current-coin-price');
    if (currentPriceElement) {
        currentPriceElement.textContent = '1 Monedă = €0.00';
    }
}

async function openDepositModal() {
    // Încercăm să încărcăm datele dacă lipsesc
    const loadedData = await ensureMarketDataLoaded();
    
    let coinsToUse = allMarketData;

    if (loadedData && Array.isArray(loadedData)) {
        // Dacă ensureMarketDataLoaded a returnat date noi, le folosim
        coinsToUse = loadedData;
    }
    
    populateCoinDropdown(coinsToUse);
    document.getElementById("depositModal").style.display = "flex";
    isModalOpen = true;
    
    // Afișăm o avertizare doar dacă încărcarea forțată a eșuat și lista este goală.
    if (!coinsToUse || coinsToUse.length === 0) {
        showCustomAlert('Eroare: Nu s-au putut obține date de preț. Verificați serverul proxy.');
    }
    
    calculateDepositValue(); // Calculează valoarea inițială
}

/**
 * Populează dropdown-ul cu monedele din lista principală.
 * @param {Array<object>} coins - Lista de monede de utilizat.
 */
function populateCoinDropdown(coins) {
    const hiddenSelect = document.getElementById('deposit-symbol');
    const optionsContainer = document.getElementById('deposit-symbol-options');
    const selectedDisplay = document.getElementById('deposit-symbol-selected');
    
    // Curățăm listele existente
    hiddenSelect.innerHTML = '';
    if (optionsContainer) {
        optionsContainer.innerHTML = '';
    }

    // Adăugăm o opțiune implicită în select-ul hidden
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = coins && coins.length > 0 ? 'Selectează o monedă...' : 'Nu sunt disponibile monede';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    hiddenSelect.appendChild(defaultOption);

    // Resetăm afișajul selectat
    if (selectedDisplay) {
        const dropdownText = selectedDisplay.querySelector('.dropdown-text');
        if (dropdownText) {
            dropdownText.textContent = coins && coins.length > 0 ? 'Selectează o monedă...' : 'Nu sunt disponibile monede';
        }
    }

    // Adăugăm monedele din lista furnizată
    if (coins && coins.length > 0 && optionsContainer) {
        coins.forEach(coin => {
            const symbol = coin.CoinInfo.Name;
            const fullName = coin.CoinInfo.FullName;
            const rawData = coin.RAW && coin.RAW.EUR ? coin.RAW.EUR : null;
            
            if (!rawData) return; // Sărim monedele fără date
            
            const price = rawData.PRICE || 0;
            const change24h = rawData.CHANGEPCT24HOUR || 0;
            const volume24h = rawData.TOTALVOLUME24H || 0;
            const marketCap = rawData.MKTCAP || 0;
            const high24h = rawData.HIGH24HOUR || 0;
            const low24h = rawData.LOW24HOUR || 0;
            const iconUrl = `https://www.cryptocompare.com${coin.CoinInfo.ImageUrl}`;
            
            // Creăm opțiunea pentru select-ul hidden cu toate datele
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
            
            // Creăm opțiunea pentru dropdown-ul custom cu iconiță și detalii
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
            
            // Adăugăm event listener pentru selecție
            customOption.addEventListener('click', () => {
                selectCoinOption(coin);
            });
            
            optionsContainer.appendChild(customOption);
        });
    }
}

/**
 * Gestionează selecția unei monede din dropdown-ul custom.
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
    
    // Închidem dropdown-ul
    if (dropdownWrapper) {
        dropdownWrapper.classList.remove('active');
    }
    
    // Actualizăm afișajul selectat din dropdown
    if (selectedDisplay) {
        const dropdownText = selectedDisplay.querySelector('.dropdown-selected-text');
        if (dropdownText) {
            dropdownText.textContent = `${symbol} - ${fullName}`;
        }
        
        // Actualizăm iconița din dropdown
        if (iconPreviewDropdown) {
            iconPreviewDropdown.innerHTML = `<img src="${iconUrl}" alt="${symbol} icon" onerror="this.src='https://placehold.co/32x32/161B22/FFFFFF?text=?'">`;
        }
    }
    
    // Actualizăm select-ul hidden
    if (hiddenSelect) {
        const option = Array.from(hiddenSelect.options).find(opt => opt.value === symbol);
        if (option) {
            hiddenSelect.selectedIndex = Array.from(hiddenSelect.options).indexOf(option);
        }
    }
    
    // Afișăm și actualizăm secțiunea de detalii
    if (coinDetailsSection) {
        coinDetailsSection.style.display = 'block';
        
        // Iconița mare
        const iconPreview = document.getElementById('coin-icon-preview');
        if (iconPreview) {
            iconPreview.innerHTML = `<img src="${iconUrl}" alt="${symbol} icon" onerror="this.src='https://placehold.co/48x48/161B22/FFFFFF?text=?'">`;
        }
        
        // Numele și simbolul
        const coinNameDisplay = document.getElementById('coin-name-display');
        const coinSymbolDisplay = document.getElementById('coin-symbol-display');
        if (coinNameDisplay) coinNameDisplay.textContent = fullName;
        if (coinSymbolDisplay) coinSymbolDisplay.textContent = symbol;
        
        // Prețul
        const coinPriceDisplay = document.getElementById('coin-price-display');
        if (coinPriceDisplay) coinPriceDisplay.textContent = `€${formatPrice(price)}`;
        
        // Schimbarea 24h
        const coinChangeDisplay = document.getElementById('coin-change-display');
        if (coinChangeDisplay) {
            const changeClass = change24h >= 0 ? 'positive' : 'negative';
            const changeSign = change24h >= 0 ? '+' : '';
            coinChangeDisplay.textContent = `${changeSign}${change24h.toFixed(2)}%`;
            coinChangeDisplay.className = `detail-value ${changeClass}`;
        }
        
        // Volumul 24h
        const coinVolumeDisplay = document.getElementById('coin-volume-display');
        if (coinVolumeDisplay) coinVolumeDisplay.textContent = `€${formatLargeNumber(volume24h)}`;
        
        // Market Cap
        const coinMarketcapDisplay = document.getElementById('coin-marketcap-display');
        if (coinMarketcapDisplay) coinMarketcapDisplay.textContent = `€${formatLargeNumber(marketCap)}`;
        
        // High 24h
        const coinHighDisplay = document.getElementById('coin-high-display');
        if (coinHighDisplay) {
            coinHighDisplay.textContent = `€${formatPrice(high24h)}`;
            coinHighDisplay.className = 'detail-value positive';
        }
        
        // Low 24h
        const coinLowDisplay = document.getElementById('coin-low-display');
        if (coinLowDisplay) {
            coinLowDisplay.textContent = `€${formatPrice(low24h)}`;
            coinLowDisplay.className = 'detail-value negative';
        }
    }
    
    // Recalculăm valoarea
    calculateDepositValue();
}

/**
 * Configurează funcționalitatea dropdown-ului custom.
 */
function setupCustomDropdown() {
    const dropdownWrapper = document.getElementById('deposit-symbol-wrapper');
    const selectedDisplay = document.getElementById('deposit-symbol-selected');
    
    if (!dropdownWrapper || !selectedDisplay) {
        return;
    }
    
    // Toggle dropdown la click pe elementul selectat
    selectedDisplay.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownWrapper.classList.toggle('active');
    });
    
    // Închidem dropdown-ul când se face click în afara lui
    document.addEventListener('click', (e) => {
        if (!dropdownWrapper.contains(e.target)) {
            dropdownWrapper.classList.remove('active');
        }
    });
}

/**
 * Calculează valoarea depozitului pe baza cantității și a prețului curent.
 */
function calculateDepositValue() {
    if (!isModalOpen) return;
    
    const hiddenSelect = document.getElementById('deposit-symbol');
    const quantityInput = document.getElementById('deposit-quantity');
    const valueDisplay = document.getElementById('deposit-value');

    const selectedOption = hiddenSelect ? hiddenSelect.options[hiddenSelect.selectedIndex] : null;
    // Folosim o expresie regulată pentru a ne asigura că este un număr valid (eliminăm caracterele non-numerice)
    const quantity = parseFloat(quantityInput.value.replace(/[^0-9.]/g, '')) || 0;
    
    let price = 0;
    let symbol = 'Monedă';
    
    if (selectedOption && selectedOption.value) {
        price = parseFloat(selectedOption.getAttribute('data-price'));
        symbol = selectedOption.value;
    }
    
    const totalValue = quantity * price;
    
    // Afișăm valoarea totală
    valueDisplay.textContent = `€${formatPrice(totalValue)}`;
    
    // Afișăm prețul curent al monedei
    const currentPriceElement = document.getElementById('current-coin-price');
    if (currentPriceElement) {
        currentPriceElement.textContent = `1 ${symbol} = €${formatPrice(price)}`;
        currentPriceElement.style.color = '#34d399';
    }
}

/**
 * Gestionează confirmarea depozitului.
 */
function handleDepositConfirm() {
    // Verificăm dacă sunt date în dropdown (dacă nu, înseamnă că au lipsit la încărcare)
    const hiddenSelect = document.getElementById('deposit-symbol');
    if (!hiddenSelect || hiddenSelect.options.length <= 1) { // 1 = opțiunea implicită 'Selectează o monedă...'
        showCustomAlert('Eroare: Nu s-au putut obține prețuri valide. Reîncercați.');
        return;
    }
    
    const quantityInput = document.getElementById('deposit-quantity');
    
    const selectedOption = hiddenSelect.options[hiddenSelect.selectedIndex];
    const symbol = selectedOption ? selectedOption.value : null;
    const quantity = parseFloat(quantityInput.value);
    
    if (!symbol || quantity <= 0) {
        showCustomAlert('Eroare: Selectează o monedă și introdu o cantitate validă.');
        return;
    }

    const price = parseFloat(selectedOption.getAttribute('data-price'));
    const change24h = parseFloat(selectedOption.getAttribute('data-change24h')) || 0;
    const iconUrl = selectedOption.getAttribute('data-icon');
    const fullName = selectedOption.getAttribute('data-fullname') || symbol;
    const totalDepositValue = quantity * price;

    // Verificăm dacă utilizatorul are suficienți bani pentru a cumpăra monedele
    if (currentBalance < totalDepositValue) {
        showCustomAlert(`Eroare: Fonduri insuficiente. Ai nevoie de €${formatPrice(totalDepositValue)}, dar ai doar €${formatPrice(currentBalance)}.`);
        return;
    }

    // Scădem din balanță când cumpărăm monede (depozit)
    currentBalance -= totalDepositValue;
    currentBalance = parseFloat(currentBalance.toFixed(2));

    const storageKeys = getStorageKeys();
    localStorage.setItem(storageKeys.balance, currentBalance);
    updateUI(currentBalance);
    
    // Adăugăm sau actualizăm asset-ul
    addOrUpdateAsset({
        symbol: symbol,
        fullName: fullName,
        quantity: quantity,
        purchasePrice: price,
        currentPrice: price,
        change24h: change24h,
        iconUrl: iconUrl
    });
    
    // Adăugăm tranzacția
    addTransaction('deposit', {
        symbol: symbol,
        quantity: quantity,
        value: totalDepositValue,
        price: price
    });
    
    closeDepositModal();
    showCustomAlert(`Depozit reușit: ${quantity} ${symbol} (Valoare: €${formatPrice(totalDepositValue)}).`);
}

/**
 * Adaugă sau actualizează un asset în portofel.
 */
function addOrUpdateAsset(assetData) {
    const existingAssetIndex = userAssets.findIndex(asset => asset.symbol === assetData.symbol);
    
    if (existingAssetIndex >= 0) {
        // Actualizăm asset-ul existent (adăugăm cantitatea)
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
        // Adăugăm un asset nou
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
    updateUI(currentBalance); // Actualizăm UI-ul pentru a reflecta noua valoare a portofelului
}

/**
 * Renderizează assets-urile în UI.
 */
function renderAssets() {
    const assetsContainer = document.getElementById('assets-container');
    if (!assetsContainer) return;
    
    if (userAssets.length === 0) {
        assetsContainer.innerHTML = '<div style="grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; min-height: 300px; color: #8B949E; font-size: 16px; text-align: center;">Nu ai assets încă. Fă un depozit pentru a începe!</div>';
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
                    <span class="asset-label">Cantitate:</span>
                    <span class="asset-value">${asset.quantity.toFixed(6)}</span>
                </div>
                <div class="asset-detail-row">
                    <span class="asset-label">Preț curent:</span>
                    <span class="asset-value">€${formatPrice(asset.currentPrice)}</span>
                </div>
                <div class="asset-detail-row">
                    <span class="asset-label">Valoare totală:</span>
                    <span class="asset-value">€${formatPrice(currentValue)}</span>
                </div>
            </div>
        `;
        
        assetsContainer.appendChild(assetCard);
    });
}


/**
 * Funcție simplă de afișare a mesajelor (înlocuitor pentru alert()).
 * @param {string} message - Mesajul de afișat.
 */
function showCustomAlert(message) {
    const statusDiv = document.createElement('div');
    statusDiv.className = 'temp-status-message';
    // Stiluri pentru notificare pop-up (roșu/portocaliu pentru vizibilitate pe fundal întunecat)
    statusDiv.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: #FF5733; color: white; padding: 10px 20px; border-radius: 5px; z-index: 9999; font-weight: bold; animation: fadeout 3s forwards;';
    statusDiv.textContent = message;
    
    // Adaugă chei CSS pentru animație (trebuie definite în style.css, dar le punem inline pentru simplitate)
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

// =========================================================================
// LOGICA MODALULUI ADĂUGĂ FONDURI
// =========================================================================

function openAddFundsModal() {
    const modal = document.getElementById('addFundsModal');
    if (modal) {
        modal.style.display = 'flex';
        // Resetăm formularul
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
    
    // Închidere modal
    closeBtn.onclick = closeAddFundsModal;
    window.onclick = (event) => {
        if (event.target === modal) {
            closeAddFundsModal();
        }
    };
    
    // Formatare număr card (spații la fiecare 4 cifre)
    const cardNumberInput = document.getElementById('card-number');
    if (cardNumberInput) {
        cardNumberInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\s/g, '');
            let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
            e.target.value = formattedValue;
        });
    }
    
    // Formatare data expirării (MM/YY)
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
    
    // Formatare CVV (doar numere)
    const cvvInput = document.getElementById('card-cvv');
    if (cvvInput) {
        cvvInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }
    
    // Submit formular
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
    
    // Validare
    if (!amount || amount <= 0) {
        showCustomAlert('Eroare: Introdu o sumă validă.');
        return;
    }
    
    if (cardNumber.length < 13 || cardNumber.length > 19) {
        showCustomAlert('Eroare: Număr card invalid.');
        return;
    }
    
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
        showCustomAlert('Eroare: Data expirării invalidă. Folosește formatul MM/YY.');
        return;
    }
    
    if (cardCvv.length < 3 || cardCvv.length > 4) {
        showCustomAlert('Eroare: CVV invalid.');
        return;
    }
    
    // Închidem modalul de adăugare fonduri
    closeAddFundsModal();
    
    // Deschidem modalul de verificare
    openVerifyModal(amount);
}

function openVerifyModal(amount, successMessage = null) {
    const modal = document.getElementById('verifyModal');
    const message = document.getElementById('verify-message');
    
    if (modal && message) {
        if (successMessage) {
            // Pentru retragere - mesajul de succes este deja procesat
            message.textContent = `Procesăm retragerea de €${formatPrice(amount)}. Te rugăm să aștepți...`;
        } else {
            // Pentru adăugare fonduri
            message.textContent = `Procesăm plata de €${formatPrice(amount)}. Te rugăm să aștepți...`;
        }
        
        modal.style.display = 'flex';
        
        // Simulăm procesarea (3 secunde)
        setTimeout(() => {
            closeVerifyModal();
            if (successMessage) {
                // Pentru retragere - afișăm mesajul de succes
                showCustomAlert(successMessage);
            } else {
                // Pentru adăugare fonduri - adăugăm fondurile la sold
                currentBalance += amount;
                currentBalance = parseFloat(currentBalance.toFixed(2));
                const storageKeys = getStorageKeys();
                localStorage.setItem(storageKeys.balance, currentBalance);
                updateUI(currentBalance);
                
                // Adăugăm tranzacția
                addTransaction('add_funds', {
                    amount: amount
                });
                
                showCustomAlert(`Fonduri adăugate cu succes! Suma de €${formatPrice(amount)} a fost adăugată în contul tău.`);
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

// =========================================================================
// LOGICA MODALULUI RETRAGERE
// =========================================================================

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
    
    // Resetăm dropdown-ul
    if (dropdownWrapper) {
        dropdownWrapper.classList.remove('active');
    }
    
    if (selectedDisplay) {
        const dropdownText = selectedDisplay.querySelector('.dropdown-selected-text');
        const iconPreviewDropdown = document.getElementById('withdraw-icon-preview-dropdown');
        if (dropdownText) {
            dropdownText.textContent = 'Selectează un asset...';
        }
        if (iconPreviewDropdown) {
            iconPreviewDropdown.innerHTML = '';
        }
    }
    
    // Ascundem butonul "Folosește tot"
    const useMaxBtn = document.getElementById('use-max-withdraw');
    if (useMaxBtn) {
        useMaxBtn.style.display = 'none';
    }
    
    // Resetăm câmpurile
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

    // Toggle dropdown la click pe elementul selectat
    selectedDisplay.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownWrapper.classList.toggle('active');
    });
    
    // Închidem dropdown-ul când se face click în afara lui
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
    
    // Curățăm listele existente
    hiddenSelect.innerHTML = '';
    optionsContainer.innerHTML = '';
    
    // Adăugăm o opțiune implicită în select-ul hidden
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = userAssets.length > 0 ? 'Selectează un asset...' : 'Nu ai assets disponibile';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    hiddenSelect.appendChild(defaultOption);
    
    // Resetăm afișajul selectat
    const dropdownText = selectedDisplay.querySelector('.dropdown-selected-text');
    const iconPreview = document.getElementById('withdraw-icon-preview-dropdown');
    if (dropdownText) {
        dropdownText.textContent = userAssets.length > 0 ? 'Selectează un asset...' : 'Nu ai assets disponibile';
    }
    if (iconPreview) {
        iconPreview.innerHTML = '';
    }
    
    // Adăugăm assets-urile din lista utilizatorului
    if (userAssets.length > 0) {
        userAssets.forEach(asset => {
            // Creăm opțiunea pentru select-ul hidden
            const hiddenOption = document.createElement('option');
            hiddenOption.value = asset.symbol;
            hiddenOption.textContent = `${asset.symbol} - ${asset.fullName}`;
            hiddenOption.setAttribute('data-price', asset.currentPrice);
            hiddenOption.setAttribute('data-quantity', asset.quantity);
            hiddenOption.setAttribute('data-icon', asset.iconUrl);
            hiddenSelect.appendChild(hiddenOption);
            
            // Creăm opțiunea pentru dropdown-ul custom cu iconiță
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
            
            // Adăugăm event listener pentru selecție
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
    
    // Închidem dropdown-ul
    if (dropdownWrapper) {
        dropdownWrapper.classList.remove('active');
    }
    
    // Actualizăm afișajul selectat din dropdown
    if (selectedDisplay) {
        const dropdownText = selectedDisplay.querySelector('.dropdown-selected-text');
        if (dropdownText) {
            dropdownText.textContent = `${asset.symbol} - ${asset.fullName}`;
        }
        
        // Actualizăm iconița din dropdown (mai mică)
        if (iconPreviewDropdown) {
            iconPreviewDropdown.innerHTML = `<img src="${asset.iconUrl}" alt="${asset.symbol} icon" onerror="this.src='https://placehold.co/20x20/161B22/FFFFFF?text=?'" style="width: 20px; height: 20px;">`;
        }
    }
    
    // Actualizăm select-ul hidden
    if (hiddenSelect) {
        const option = Array.from(hiddenSelect.options).find(opt => opt.value === asset.symbol);
        if (option) {
            hiddenSelect.selectedIndex = Array.from(hiddenSelect.options).indexOf(option);
        }
    }
    
    // Actualizăm informațiile despre asset
    const assetInfo = document.getElementById('withdraw-asset-info');
    const availableInfo = document.getElementById('withdraw-available');
    
    if (assetInfo) {
        assetInfo.textContent = `Preț curent: €${formatPrice(asset.currentPrice)}`;
    }
    
    if (availableInfo) {
        availableInfo.textContent = `Disponibil: ${asset.quantity.toFixed(6)} ${asset.symbol}`;
    }
    
    // Afișăm butonul "Folosește tot"
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
    
    // Recalculăm valoarea
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
        showCustomAlert('Eroare: Selectează un asset și introdu o cantitate validă.');
        return;
    }

    const price = parseFloat(selectedOption.getAttribute('data-price')) || 0;
    const availableQty = parseFloat(selectedOption.getAttribute('data-quantity')) || 0;

    if (quantity > availableQty) {
        showCustomAlert('Eroare: Cantitate indisponibilă pentru retragere.');
        return;
    }

    const totalValue = quantity * price;

    // Actualizăm asset-ul
    const assetIndex = userAssets.findIndex(a => a.symbol === symbol);
    if (assetIndex >= 0) {
        userAssets[assetIndex].quantity = parseFloat((userAssets[assetIndex].quantity - quantity).toFixed(6));
        if (userAssets[assetIndex].quantity <= 0) {
            userAssets.splice(assetIndex, 1); // eliminăm asset-ul dacă ajunge la zero
        }
    }

    // Actualizăm soldul
    currentBalance += totalValue;
    currentBalance = parseFloat(currentBalance.toFixed(2));
    const storageKeys = getStorageKeys();
    localStorage.setItem(storageKeys.balance, currentBalance);
    updateUI(currentBalance);

    // Salvăm și reafișăm assets-urile
    saveUserAssets();
    renderAssets();

    // Adăugăm tranzacția
    addTransaction('withdraw', {
        symbol: symbol,
        quantity: quantity,
        value: totalValue,
        price: price
    });

    // Închidem modalul de retragere
    closeWithdrawModal();

    // Deschidem modalul de verificare
    openVerifyModal(totalValue, `Retragere reușită! ${quantity} ${symbol} (Valoare: €${formatPrice(totalValue)}) au fost convertite în balance.`);
}

// =========================================================================
// LOGICA MODALULUI SWAP (SCHIMBĂ)
// =========================================================================

async function openSwapModal() {
    const modal = document.getElementById('swapModal');
    if (!modal) return;

    // Încercăm să încărcăm datele dacă lipsesc
    const loadedData = await ensureMarketDataLoaded();
    let coinsToUse = allMarketData;
    
    if (loadedData && Array.isArray(loadedData)) {
        coinsToUse = loadedData;
    }

    populateSwapDropdowns(coinsToUse);
    modal.style.display = 'flex';
    
    // Resetăm câmpurile
    document.getElementById('swap-quantity').value = '';
    document.getElementById('swap-receive-value').textContent = '0.00';
    document.getElementById('swap-from-info').textContent = '';
    document.getElementById('swap-to-info').textContent = '';
    document.getElementById('swap-available').textContent = '';
    
    // Ascundem butonul "Folosește tot"
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
    
    // Resetăm dropdown-urile
    const fromWrapper = document.getElementById('swap-from-wrapper');
    const toWrapper = document.getElementById('swap-to-wrapper');
    if (fromWrapper) fromWrapper.classList.remove('active');
    if (toWrapper) toWrapper.classList.remove('active');
    
    // Resetăm afișajele
    const fromSelected = document.getElementById('swap-from-selected');
    const toSelected = document.getElementById('swap-to-selected');
    if (fromSelected) {
        const text = fromSelected.querySelector('.dropdown-selected-text');
        if (text) text.textContent = 'Selectează moneda...';
    }
    if (toSelected) {
        const text = toSelected.querySelector('.dropdown-selected-text');
        if (text) text.textContent = 'Selectează moneda...';
    }
    
    const fromIcon = document.getElementById('swap-from-icon-preview');
    const toIcon = document.getElementById('swap-to-icon-preview');
    if (fromIcon) fromIcon.innerHTML = '';
    if (toIcon) toIcon.innerHTML = '';
}

function populateSwapDropdowns(coins) {
    // Populăm dropdown-ul "Din" cu assets-urile utilizatorului
    populateSwapFromDropdown();
    
    // Populăm dropdown-ul "În" cu toate monedele disponibile
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
    defaultOption.textContent = userAssets.length > 0 ? 'Selectează moneda...' : 'Nu ai assets disponibile';
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
    defaultOption.textContent = 'Selectează moneda...';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    hiddenSelect.appendChild(defaultOption);
    
    // Obținem simbolul monedei selectate în "Din" pentru a-l exclude
    const selectedFromSymbol = fromSelect ? fromSelect.options[fromSelect.selectedIndex]?.value : null;
    
    if (coins && coins.length > 0) {
        coins.forEach(coin => {
            const symbol = coin.CoinInfo.Name;
            const fullName = coin.CoinInfo.FullName;
            const rawData = coin.RAW && coin.RAW.EUR ? coin.RAW.EUR : null;
            
            if (!rawData) return;
            
            // Excludem moneda selectată în "Din"
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
    
    // Actualizăm informațiile
    const assetInfo = document.getElementById('swap-from-info');
    if (assetInfo) {
        assetInfo.textContent = `Preț: €${formatPrice(asset.currentPrice)} | Disponibil: ${asset.quantity.toFixed(6)}`;
    }
    
    // Re-populăm dropdown-ul "În" pentru a exclude moneda selectată
    const loadedData = allMarketData.length > 0 ? allMarketData : null;
    if (loadedData) {
        populateSwapToDropdown(loadedData);
    }
    
    // Resetăm selecția "În" dacă era aceeași monedă
    const toSelect = document.getElementById('swap-to-asset');
    const toSelected = document.getElementById('swap-to-selected');
    if (toSelect && toSelect.options[toSelect.selectedIndex]?.value === asset.symbol) {
        toSelect.selectedIndex = 0;
        if (toSelected) {
            const text = toSelected.querySelector('.dropdown-selected-text');
            if (text) text.textContent = 'Selectează moneda...';
        }
        const toIcon = document.getElementById('swap-to-icon-preview');
        if (toIcon) toIcon.innerHTML = '';
    }
    
    // Afișăm butonul "Folosește tot"
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
    
    // Actualizăm informațiile
    const assetInfo = document.getElementById('swap-to-info');
    if (assetInfo) {
        const changeClass = change24h >= 0 ? 'positive' : 'negative';
        const changeSign = change24h >= 0 ? '+' : '';
        assetInfo.innerHTML = `Preț: €${formatPrice(price)} | <span class="${changeClass}">${changeSign}${change24h.toFixed(2)}%</span>`;
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
        // Calculăm cât va primi: (cantitate * preț_from) / preț_to
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
    
    // Dropdown "Din"
    fromSelected.addEventListener('click', (e) => {
        e.stopPropagation();
        fromWrapper.classList.toggle('active');
        toWrapper.classList.remove('active');
    });
    
    // Dropdown "În"
    toSelected.addEventListener('click', (e) => {
        e.stopPropagation();
        toWrapper.classList.toggle('active');
        fromWrapper.classList.remove('active');
    });
    
    // Închidem dropdown-urile când se face click în afara lor
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
        showCustomAlert('Eroare: Selectează moneda de schimbat.');
        return;
    }
    
    if (!toOption || !toOption.value) {
        showCustomAlert('Eroare: Selectează moneda în care să schimbi.');
        return;
    }
    
    // Verificăm că nu schimbă aceeași monedă
    if (fromOption.value === toOption.value) {
        showCustomAlert('Eroare: Nu poți schimba o monedă cu ea însăși.');
        return;
    }
    
    if (!quantity || quantity <= 0) {
        showCustomAlert('Eroare: Introdu o cantitate validă.');
        return;
    }
    
    const fromPrice = parseFloat(fromOption.getAttribute('data-price'));
    const toPrice = parseFloat(toOption.getAttribute('data-price'));
    const toIconUrl = toOption.getAttribute('data-icon');
    const toFullName = toOption.textContent.split(' - ')[1] || toOption.value;
    
    // Găsim asset-ul "din" în lista utilizatorului pentru a obține cantitatea reală actualizată
    const fromAssetIndex = userAssets.findIndex(a => a.symbol === fromOption.value);
    if (fromAssetIndex === -1) {
        showCustomAlert('Eroare: Asset-ul nu a fost găsit.');
        return;
    }
    
    const fromAsset = userAssets[fromAssetIndex];
    const availableQty = fromAsset.quantity; // Folosim cantitatea reală din asset, nu din atribut
    
    // Verificăm dacă utilizatorul are suficiente monede
    if (quantity > availableQty) {
        showCustomAlert(`Eroare: Nu ai suficiente ${fromOption.value}. Disponibil: ${availableQty.toFixed(6)}`);
        return;
    }
    
    // Calculăm cât va primi
    const fromValue = quantity * fromPrice;
    const receiveQuantity = fromValue / toPrice;
    
    // Scădem cantitatea din asset-ul "din"
    fromAsset.quantity -= quantity;
    fromAsset.quantity = parseFloat(fromAsset.quantity.toFixed(6));
    
    // Dacă cantitatea a ajuns la 0, eliminăm asset-ul
    if (fromAsset.quantity <= 0) {
        userAssets.splice(fromAssetIndex, 1);
    }
    
    // Adăugăm sau actualizăm asset-ul "în"
    const toAssetIndex = userAssets.findIndex(a => a.symbol === toOption.value);
    
    if (toAssetIndex >= 0) {
        // Actualizăm asset-ul existent
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
        // Adăugăm un asset nou
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
    
    // Salvăm modificările
    saveUserAssets();
    renderAssets();
    updateUI(currentBalance); // Actualizăm UI-ul pentru a reflecta noua valoare a portofelului
    
    // Adăugăm tranzacția
    addTransaction('swap', {
        fromSymbol: fromOption.value,
        fromQuantity: quantity,
        fromValue: fromValue,
        toSymbol: toOption.value,
        toQuantity: receiveQuantity,
        toPrice: toPrice
    });
    
    // Închidem modalul
    closeSwapModal();
    
    // Deschidem modalul de verificare
    openVerifyModal(
        fromValue, 
        `Schimbare reușită! ${quantity.toFixed(6)} ${fromOption.value} au fost schimbate în ${receiveQuantity.toFixed(6)} ${toOption.value}.`
    );
}