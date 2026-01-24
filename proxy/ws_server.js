require('dotenv').config(); 
const WebSocket = require('ws');
const fetch = require('node-fetch');

const WS_PORT = 4000; 
const HTTP_PROXY_URL = 'http://localhost:3000/api/market'; 

const wss = new WebSocket.Server({ port: WS_PORT });

let livePrices = {};
let isInitialized = false;

async function initializeLivePrices() {
    console.log('Loading the list of coins from the HTTP server (Port 3000)...');
    try {
        const response = await fetch(HTTP_PROXY_URL);
        const data = await response.json();
        
        if (!data || !data.Data || data.Data.length === 0) {
            console.error('No data received from /api/market. Using fallback coins (BTC, ETH, XRP, BNB, SOL).');
            const fallbackCoins = ['BTC', 'ETH', 'XRP', 'BNB', 'SOL'];
            fallbackCoins.forEach(symbol => {
                 livePrices[symbol] = { price: 1, change24h: 0, volume: 1 };
            });
            isInitialized = true;
            return;
        }

        data.Data.forEach(coin => {
            const symbol = coin.CoinInfo.Name;
            if (coin.RAW && coin.RAW.EUR) { 
                const price = coin.RAW.EUR.PRICE;
                const change24h = coin.RAW.EUR.CHANGEPCT24HOUR;
                const volume = coin.RAW.EUR.TOTALVOLUME24H;
                livePrices[symbol] = { price, change24h, volume };
            } else {
                 console.warn(`Incomplete data for the coin ${symbol}. Ignored in livePrices.`);
            }
        });

        console.log(`The initial list of ${Object.keys(livePrices).length} coins has been loaded.`);
        isInitialized = true;

    } catch (error) {
        console.error('Error at initializing live prices:', error.message);
        console.error('Check if the HTTP server (server.js) is running correctly on port 3000.');
    }
}

const simulatePriceUpdate = () => {
    if (!isInitialized) return;

    const updates = [];
    for (const symbol in livePrices) {
        const current = livePrices[symbol];
        
        const changeFactor = (Math.random() - 0.5) * 0.001; 
        let newPrice = current.price * (1 + changeFactor);
        
        const decimals = newPrice > 100 ? 2 : newPrice > 1 ? 4 : 6;
        newPrice = parseFloat(newPrice.toFixed(decimals));
        
        const newChange24h = parseFloat((current.change24h + (Math.random() * 0.1 - 0.05)).toFixed(2));
        
        livePrices[symbol].price = newPrice;
        livePrices[symbol].change24h = newChange24h;

        updates.push({
            symbol: symbol,
            price: newPrice,
            change24h: newChange24h
        });
    }
    
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(updates));
        }
    });
};


let simulationInterval;
const startSimulation = () => {
    if (simulationInterval) clearInterval(simulationInterval);
    simulationInterval = setInterval(simulatePriceUpdate, 3000);
};

initializeLivePrices().then(startSimulation);


wss.on('connection', function connection(ws) {
    console.log('New client connected to WebSocket on port 4000.');
    
    const initialUpdates = Object.keys(livePrices).map(symbol => ({
        symbol: symbol,
        price: livePrices[symbol].price,
        change24h: livePrices[symbol].change24h
    }));
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(initialUpdates));
    }

    ws.on('close', () => {
        console.log('Client disconnected from WebSocket.');
    });
    
    ws.on('error', (err) => {
        console.error('WebSocket error:', err.message);
    });
});

console.log(`WebSocket server running on ws://localhost:${WS_PORT}`);
console.log('Run the HTTP server (server.js) separately on port 3000.');