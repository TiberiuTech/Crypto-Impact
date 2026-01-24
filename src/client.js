import { formatPrice, formatLargeNumber } from './utils/formatters.js';
import { ChartRenderer } from './charts/chartRenderer.js';
import { ModalManager } from './ui/modalManager.js';

// Instanțe globale
export let allMarketData = []; 
const chartRenderer = new ChartRenderer();
// NOU: Inițializăm modalManager doar dacă elementul modalului (#coinModal) este prezent (doar pe prices.html)
const modalElement = document.getElementById("coinModal");
const modalManager = modalElement ? new ModalManager(chartRenderer) : null; 

// Variabile pentru Carusel
let carouselInterval = null;
const CAROUSEL_SPEED_MS = 30; // Viteza de scroll (30ms = scroll lin)
const CAROUSEL_COIN_COUNT = 10; // Numărul de monede afișate

// NOU: Coada de cereri pentru grafice (pentru a evita rate limiting la date istorice)
let chartQueue = [];

// Așteaptă ca pagina HTML să se încarce complet
document.addEventListener("DOMContentLoaded", () => {
    // Verificăm dacă suntem pe prices.html (unde există tabelul)
    if (document.getElementById("crypto-table-body")) {
        loadMarketData();
        setupTableListeners();
        startWebSocketForLivePrices(); // Pornește WebSocket pentru prețuri live
    }
});

/**
 * NOU: Pornește conexiunea WebSocket pentru a primi actualizări de prețuri live.
 */
function startWebSocketForLivePrices() {
    const ws = new WebSocket('ws://localhost:4000'); // Fără /ws
    
    ws.onopen = () => {
        // Logica de success este acum silentioasa
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
            console.error('Eroare la parsarea mesajului WebSocket:', e);
        }
    };

    ws.onclose = () => {
        console.warn('Conexiunea WebSocket s-a închis. Tentativă de reconectare în 5s...');
        setTimeout(startWebSocketForLivePrices, 5000); // Reconectează la eșec
    };

    ws.onerror = (error) => {
        console.error('Eroare WebSocket:', error);
    };
}

/**
 * NOU: Actualizează prețurile în UI (carusel și tabel) pe baza datelor primite prin WebSocket.
 */
function updateLivePrice(symbol, newPrice, change24h) {
    const isPositive = change24h > 0;
    const trendClass = isPositive ? 'positive' : 'negative';
    
    // Folosim logica de formatare a prețului din utils/Formatters.js
    const formattedPrice = `€${formatPrice(newPrice)}`;
    const formattedChange = `${change24h.toFixed(2)}%`;

    // 1. Actualizează Tabelul
    const tableRow = document.querySelector(`#crypto-table-body tr[data-symbol="${symbol}"]`);
    if (tableRow) {
        // Coloana Prices (a treia <td>, după # și Coin)
        const priceCell = tableRow.querySelector('td:nth-child(3)');
        if (priceCell) priceCell.textContent = formattedPrice;

        // Coloana 24h % (a patra <td>)
        const changeCell = tableRow.querySelector('td:nth-child(4)');
        if (changeCell) {
            changeCell.textContent = formattedChange;
            changeCell.className = trendClass; // Actualizează culoarea
        }
    }

    // 2. Actualizează Caruselul
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


/**
 * Procesează coada de cereri de grafice secvențial pentru a evita Rate Limiting.
 */
async function processChartQueue() {
    const request = chartQueue.shift();

    if (!request) {
        return;
    }

    const { symbol, chartId, isPositive } = request;

    // Aici se aplică delay-ul de 1500ms (definit în ChartRenderer)
    const historyData = await chartRenderer.loadHistoryData(symbol, false); 
    
    if (historyData.length > 0) {
        chartRenderer.renderSparkline(chartId, historyData, isPositive);
    } else {
        const element = document.getElementById(chartId);
        if (element) element.innerHTML = '<span class="no-data">N/A</span>';
    }

    // Continuăm cu următoarea cerere
    processChartQueue();
}


/**
 * Funcția principală care cere datele de piață (Top 20).
 */
async function loadMarketData() {
    const marketUrl = 'http://localhost:3000/api/market';
    // ERROR FIX 4: Verificăm că tableBody și carouselContainer există înainte de a le accesa
    const tableBody = document.getElementById("crypto-table-body");
    const carouselContainer = document.getElementById("price-carousel"); 
    
    if (tableBody) tableBody.innerHTML = ''; 
    if (carouselContainer) carouselContainer.innerHTML = ''; // Fix pentru client.js:135 (TypeError)

    try {
        const response = await fetch(marketUrl);
        
        if (!response.ok) {
            throw new Error(`Serverul Proxy nu a răspuns corect: ${response.status}. Asigură-te că rulează 'node server.js'.`);
        }
        
        const data = await response.json();
        const coins = data.Data;

        if (!Array.isArray(coins) || coins.length === 0) {
             throw new Error("Datele de piață sunt goale. Verifică cheia API CryptoCompare.");
        }
        
        // --- FILTRARE CRITICĂ AICI ---
        const filteredCoins = coins.filter(coin => coin.RAW && coin.RAW.EUR);
        // -----------------------------

        allMarketData = filteredCoins; 
        chartQueue = []; 

        // 1. Pregătim Caruselul (primele 10 monede)
        if (carouselContainer) {
            renderPriceCarouselStructure(filteredCoins.slice(0, CAROUSEL_COIN_COUNT));
            // Adăugăm cererile pentru carusel în coadă
            filteredCoins.slice(0, CAROUSEL_COIN_COUNT).forEach((coin) => {
                chartQueue.push({ 
                    symbol: coin.CoinInfo.Name, 
                    chartId: `carousel-chart-${coin.CoinInfo.Name}`, 
                    isPositive: coin.RAW.EUR.CHANGEPCT24HOUR > 0 
                });
            });
        }

        // 2. Randează Tabelul (toate monedele filtrate)
        filteredCoins.forEach((coin, index) => {
            const coinInfo = coin.CoinInfo;
            // ACCES SIGUR LA EUR
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
            // ADĂUGĂM data-symbol aici pentru update-urile WebSocket
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
                
                <!-- Celula pentru grafic -->
                <td>
                    <div class="sparkline" id="${chartId}"></div>
                </td>
                
                <!-- COLOANĂ NOUĂ: BUTONUL "TRADE" -->
                <td>
                    <button class="trade-button" data-symbol="${symbol}">Trade</button>
                </td>
            `;
            
            if (tableBody) tableBody.appendChild(row);

            // Adăugăm cererea pentru tabel în coadă
            chartQueue.push({ 
                symbol: symbol, 
                chartId: chartId, 
                isPositive: change24h > 0 
            });
        });

        // 3. Pornim procesarea cozii
        processChartQueue();


    } catch (error) {
        console.error("Eroare la încărcarea datelor de piață:", error);
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="8">Eroare: ${error.message}. Verificați serverul proxy.</td></tr>`;
    }
}


/**
 * Randează structura caruselului (fără a încărca datele istorice imediat).
 * @param {Array<object>} coins - Primele 10 monede de afișat.
 */
function renderPriceCarouselStructure(coins) {
    const carouselWrapper = document.getElementById("price-carousel");
    if (!carouselWrapper) return;

    // Folosim un container interior pentru scroll automat
    const innerContainer = document.createElement('div');
    innerContainer.className = 'carousel-inner';
    carouselWrapper.appendChild(innerContainer);

    coins.forEach((coin, index) => {
        const coinInfo = coin.CoinInfo;
        // ACCES SIGUR LA EUR
        const displayData = coin.RAW.EUR; 
        
        const price = displayData.PRICE;
        const change24h = displayData.CHANGEPCT24HOUR;
        const isPositive = change24h > 0;
        const trendClass = isPositive ? 'positive' : 'negative';
        
        const carouselItem = document.createElement('div');
        carouselItem.className = 'carousel-item';
        // NOU: adăugăm data-symbol pentru update-uri WebSocket
        carouselItem.setAttribute('data-symbol', coinInfo.Name); 
        carouselItem.setAttribute('data-index', index); 
        
        const sparklineId = `carousel-chart-${coinInfo.Name}`;

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

    // Dublează conținutul pentru scroll continuu (efect infinit)
    innerContainer.innerHTML += innerContainer.innerHTML;

    // Activează logica de scroll și interacțiune
    startCarouselScroll(carouselWrapper);
    setupCarouselInteraction(carouselWrapper);
}

/**
 * Pornește scroll-ul automat.
 * @param {HTMLElement} wrapper - Containerul caruselului.
 */
function startCarouselScroll(wrapper) {
    const inner = wrapper.querySelector('.carousel-inner');
    if (!inner) return;

    const scrollFunc = () => {
        // Dacă a ajuns la mijloc (sfârșitul primei copii), resetează scroll-ul
        if (wrapper.scrollLeft >= inner.scrollWidth / 2) {
            wrapper.scrollLeft -= inner.scrollWidth / 2;
        } else {
            wrapper.scrollLeft += 1; // Scrollează cu 1 pixel
        }
    };
    
    // Oprim orice interval anterior și pornim noul interval
    clearInterval(carouselInterval);
    carouselInterval = setInterval(scrollFunc, CAROUSEL_SPEED_MS);
}

/**
 * Configurează interacțiunile mouse-ului (pauză la hover) și click (deschide modalul).
 * @param {HTMLElement} wrapper - Containerul caruselului.
 */
function setupCarouselInteraction(wrapper) {
    // Pauză la hover
    wrapper.addEventListener('mouseenter', () => clearInterval(carouselInterval));
    // Reia scroll-ul la mouseleave
    wrapper.addEventListener('mouseleave', () => startCarouselScroll(wrapper));
    
    // Adaugă click listener pentru deschiderea modalului
    wrapper.addEventListener('click', function(event) {
        const item = event.target.closest('.carousel-item');
        if (item) {
            // Folosim data-index pentru a găsi datele complete ale monedei în allMarketData
            const index = item.getAttribute('data-index');
            
            // Verificăm dacă datele există înainte de a deschide modalul
            if (allMarketData[index]) {
                 if (modalManager) {
                    modalManager.showModal(allMarketData[index]);
                 }
            }
        }
    });
}

/**
 * Configurează ascultătorii de evenimente pentru tabel (click pe rând).
 */
function setupTableListeners() {
    const tableBody = document.getElementById("crypto-table-body");
    // ERROR FIX 3: Verificăm că tableBody există înainte de a adăuga ascultătorul
    if (tableBody) {
        tableBody.addEventListener('click', function(event) {
            let row = event.target.closest('tr');
            
            // Verifică dacă s-a dat click pe butonul "Trade"
            const tradeButton = event.target.closest('.trade-button');
            if (tradeButton) {
                // Obține simbolul monedei din atributul data-symbol
                const symbol = tradeButton.getAttribute('data-symbol');
                handleTradeButtonClick(symbol);
                return; // Oprește propagarea evenimentului
            }
            
            // Deschide modalul doar dacă nu s-a dat click pe butonul "Trade"
            if (row && !tradeButton) {
                const index = row.getAttribute('data-index');
                
                if (allMarketData[index]) {
                    const coinData = allMarketData[index];
                    // NOU: Verifică dacă modalManager este inițializat
                    if (modalManager) {
                       modalManager.showModal(coinData);
                    }
                }
            }
        });
    }
}

/**
 * Gestionează click-ul pe butonul Trade.
 * Verifică dacă utilizatorul este logat și redirecționează corespunzător.
 * @param {string} symbol - Simbolul monedei (BTC, ETH, etc.)
 */
function handleTradeButtonClick(symbol) {
    // Verifică dacă utilizatorul este logat
    const userData = localStorage.getItem('user');
    
    if (userData) {
        // Utilizatorul este logat -> redirectează la pagina trade cu moneda selectată
        window.location.href = `/src/pages/trade/trade.html?symbol=${symbol}`;
    } else {
        // Utilizatorul nu este logat -> redirectează la pagina de login
        window.location.href = '/src/pages/auth/login.html';
    }
}