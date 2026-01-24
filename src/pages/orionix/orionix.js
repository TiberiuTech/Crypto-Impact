let web3;
let userAccount;
let currentToken = null;

let demoToken = {
    price: 1.25,
    change24h: 5.43,
    marketCap: 1250000,
    volume24h: 345678,
    high24h: 1.32,
    low24h: 1.18,
    supply: 1000000,
    priceHistory: []
};

let chartInstance = null;
let priceUpdateInterval = null;

const ERC20_ABI = [
    {
        "constant": true,
        "inputs": [],
        "name": "name",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {"name": "_to", "type": "address"},
            {"name": "_value", "type": "uint256"}
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {"name": "_spender", "type": "address"},
            {"name": "_value", "type": "uint256"}
        ],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    }
];

document.addEventListener('DOMContentLoaded', () => {
    initializeDemoToken();
    checkMetaMask();
    setupEventListeners();
});

function initializeDemoToken() {
    const now = Date.now();
    const basePrice = 1.25;
    
    for (let i = 100; i >= 0; i--) {
        const timestamp = now - i * 60000;
        const wave = Math.sin(i / 10) * 0.05;
        const randomNoise = (Math.random() - 0.5) * 0.02;
        const price = basePrice + wave + randomNoise;
        
        demoToken.priceHistory.push({
            x: timestamp,
            y: parseFloat(price.toFixed(4))
        });
    }
    
    updateDemoTokenDisplay();
    renderDemoChart();
}

function updateDemoTokenDisplay() {
    document.getElementById('orx-price').textContent = `$${demoToken.price.toFixed(4)}`;
    document.getElementById('orx-current-price').textContent = `$${demoToken.price.toFixed(4)}`;
    
    const changeElement = document.getElementById('orx-change');
    const changeSign = demoToken.change24h >= 0 ? '+' : '';
    changeElement.textContent = `${changeSign}${demoToken.change24h.toFixed(2)}%`;
    changeElement.className = `price-change ${demoToken.change24h >= 0 ? '' : 'negative'}`;
    
    document.getElementById('orx-market-cap').textContent = `$${formatNumber(demoToken.marketCap)}`;
    document.getElementById('orx-volume').textContent = `$${formatNumber(demoToken.volume24h)}`;
    document.getElementById('orx-high').textContent = `$${demoToken.high24h.toFixed(4)}`;
    document.getElementById('orx-low').textContent = `$${demoToken.low24h.toFixed(4)}`;
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
    }
    return num.toFixed(2);
}

function renderDemoChart() {
    const chartElement = document.getElementById('orx-chart');
    
    const options = {
        series: [{
            name: 'ORX Price',
            data: demoToken.priceHistory
        }],
        chart: {
            type: 'area',
            height: 400,
            animations: {
                enabled: true,
                easing: 'linear',
                dynamicAnimation: {
                    speed: 1000
                }
            },
            toolbar: {
                show: false
            },
            zoom: {
                enabled: false
            }
        },
        dataLabels: {
            enabled: false
        },
        stroke: {
            curve: 'smooth',
            width: 3
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.7,
                opacityTo: 0.2,
            }
        },
        colors: ['#667eea'],
        xaxis: {
            type: 'datetime',
            labels: {
                style: {
                    colors: '#8B949E'
                },
                datetimeFormatter: {
                    hour: 'HH:mm'
                }
            }
        },
        yaxis: {
            labels: {
                style: {
                    colors: '#8B949E'
                },
                formatter: (val) => '$' + val.toFixed(4)
            }
        },
        grid: {
            borderColor: '#30363D'
        },
        tooltip: {
            theme: 'dark',
            x: {
                format: 'HH:mm:ss'
            },
            y: {
                formatter: (val) => '$' + val.toFixed(4)
            }
        }
    };
    
    chartInstance = new ApexCharts(chartElement, options);
    chartInstance.render();
}

function simulatePriceIncrease() {
    const newPrice = parseFloat((demoToken.price * 1.1).toFixed(4));
    demoToken.price = newPrice;
    demoToken.change24h = parseFloat((demoToken.change24h + 10).toFixed(2));
    
    if (newPrice > demoToken.high24h) {
        demoToken.high24h = newPrice;
    }
    
    demoToken.marketCap = newPrice * demoToken.supply;
    
    demoToken.priceHistory.push({
        x: Date.now(),
        y: newPrice
    });
    
    if (demoToken.priceHistory.length > 100) {
        demoToken.priceHistory.shift();
    }
    
    if (chartInstance) {
        chartInstance.updateSeries([{
            data: demoToken.priceHistory
        }]);
    }
    
    updateDemoTokenDisplay();
    showAlert('Price increased by 10%!', 'success');
}

function simulatePriceDecrease() {
    const newPrice = parseFloat((demoToken.price * 0.9).toFixed(4));
    demoToken.price = newPrice;
    demoToken.change24h = parseFloat((demoToken.change24h - 10).toFixed(2));
    
    if (newPrice < demoToken.low24h) {
        demoToken.low24h = newPrice;
    }
    
    demoToken.marketCap = newPrice * demoToken.supply;
    
    demoToken.priceHistory.push({
        x: Date.now(),
        y: newPrice
    });
    
    if (demoToken.priceHistory.length > 100) {
        demoToken.priceHistory.shift();
    }
    
    if (chartInstance) {
        chartInstance.updateSeries([{
            data: demoToken.priceHistory
        }]);
    }
    
    updateDemoTokenDisplay();
    showAlert('Price decreased by 10%!', 'info');
}

function resetPrice() {
    demoToken.price = 1.25;
    demoToken.change24h = 5.43;
    demoToken.high24h = 1.32;
    demoToken.low24h = 1.18;
    demoToken.marketCap = 1250000;
    demoToken.volume24h = 345678;
    
    demoToken.priceHistory = [];
    const now = Date.now();
    const basePrice = 1.25;
    
    for (let i = 100; i >= 0; i--) {
        const timestamp = now - i * 60000;
        const wave = Math.sin(i / 10) * 0.05;
        const randomNoise = (Math.random() - 0.5) * 0.02;
        const price = basePrice + wave + randomNoise;
        
        demoToken.priceHistory.push({
            x: timestamp,
            y: parseFloat(price.toFixed(4))
        });
    }
    
    if (chartInstance) {
        chartInstance.updateSeries([{
            data: demoToken.priceHistory
        }]);
    }
    
    updateDemoTokenDisplay();
    showAlert('Price reset!', 'success');
}

async function checkMetaMask() {
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    
    if (typeof window.ethereum !== 'undefined') {
        statusIndicator.classList.add('connected');
            statusText.textContent = 'MetaMask detected';
        
        try {
            if (typeof window.Web3 === 'undefined') {
                await loadWeb3Script();
            }
            
            web3 = new window.Web3(window.ethereum);
            
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                userAccount = accounts[0];
                statusText.textContent = `Connected: ${userAccount.substring(0, 6)}...${userAccount.substring(38)}`;
            } else {
                statusText.textContent = 'MetaMask detected - Click for connection';
                statusIndicator.classList.remove('connected');
                statusIndicator.classList.add('disconnected');
            }
        } catch (error) {
            console.error('Error at loading Web3:', error);
            showAlert('Error at loading Web3', 'error');
        }
    } else {
        statusIndicator.classList.add('disconnected');
        statusText.textContent = 'MetaMask is not installed';
        showAlert('Please install MetaMask to use this functionality', 'error');
    }
}

function loadWeb3Script() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/web3@1.8.0/dist/web3.min.js';
        script.onload = () => resolve();
                script.onerror = () => reject(new Error('Could not load Web3'));
        document.head.appendChild(script);
    });
}

async function connectMetaMask() {
    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAccount = accounts[0];
        
        const statusIndicator = document.getElementById('status-indicator');
        const statusText = document.getElementById('status-text');
        
        statusIndicator.classList.remove('disconnected');
        statusIndicator.classList.add('connected');
        statusText.textContent = `Connected: ${userAccount.substring(0, 6)}...${userAccount.substring(38)}`;
        
        showAlert('Connected successfully!', 'success');
    } catch (error) {
        console.error('Error at connecting:', error);
        showAlert('Error at connecting to MetaMask', 'error');
    }
}

function setupEventListeners() {
    document.getElementById('simulate-buy-btn').addEventListener('click', simulatePriceIncrease);
    document.getElementById('simulate-sell-btn').addEventListener('click', simulatePriceDecrease);
    document.getElementById('reset-price-btn').addEventListener('click', resetPrice);
    
    document.getElementById('metamask-status').addEventListener('click', () => {
        if (!userAccount) {
            connectMetaMask();
        }
    });
    
    document.getElementById('load-token-btn').addEventListener('click', () => {
        if (!userAccount) {
            connectMetaMask();
        } else {
            showAlert('Already connected to MetaMask!', 'info');
        }
    });
    
    document.getElementById('add-to-metamask-btn').addEventListener('click', addToMetaMask);
    document.getElementById('transfer-btn').addEventListener('click', () => openModal('transfer-modal'));
    document.getElementById('approve-btn').addEventListener('click', () => openModal('approve-modal'));
    document.getElementById('refresh-balance-btn').addEventListener('click', refreshBalance);
    
    document.getElementById('close-transfer-modal').addEventListener('click', () => closeModal('transfer-modal'));
    document.getElementById('close-approve-modal').addEventListener('click', () => closeModal('approve-modal'));
    
    document.getElementById('confirm-transfer-btn').addEventListener('click', confirmTransfer);
    document.getElementById('confirm-approve-btn').addEventListener('click', confirmApprove);
    
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('show');
        }
    });
}

async function loadToken() {
    const contractAddress = document.getElementById('contract-address').value.trim();
    
    if (!contractAddress) {
            showAlert('Enter a contract address!', 'error');
        return;
    }
    
    if (!web3) {
        showAlert('Web3 is not initialized!', 'error');
        return;
    }
    
    if (!userAccount) {
        await connectMetaMask();
        if (!userAccount) return;
    }
    
    try {
        const tokenContract = new web3.eth.Contract(ERC20_ABI, contractAddress);
        
        const name = await tokenContract.methods.name().call();
        const symbol = await tokenContract.methods.symbol().call();
        const decimals = await tokenContract.methods.decimals().call();
        const balance = await tokenContract.methods.balanceOf(userAccount).call();
        
        const formattedBalance = (balance / Math.pow(10, decimals)).toFixed(4);
        
        currentToken = {
            address: contractAddress,
            name: name,
            symbol: symbol,
            decimals: decimals,
            balance: balance,
            contract: tokenContract
        };
        
        document.getElementById('token-name').textContent = name;
        document.getElementById('token-symbol').textContent = symbol;
        document.getElementById('token-decimals').textContent = decimals;
        document.getElementById('token-balance').textContent = `${formattedBalance} ${symbol}`;
        document.getElementById('token-contract').textContent = `${contractAddress.substring(0, 6)}...${contractAddress.substring(38)}`;
        document.getElementById('available-balance').textContent = `${formattedBalance} ${symbol}`;
        
        document.getElementById('token-details-section').style.display = 'block';
        
        showAlert(`Token loaded successfully: ${name}`, 'success');
    } catch (error) {
        console.error('Error at loading token:', error);
        showAlert('Error at loading token. Check the contract address.', 'error');
    }
}

async function addToMetaMask() {
    if (!currentToken) {
        showAlert('Load a token first!', 'error');
        return;
    }
    
    try {
        const wasAdded = await window.ethereum.request({
            method: 'wallet_watchAsset',
            params: {
                type: 'ERC20',
                options: {
                    address: currentToken.address,
                    symbol: currentToken.symbol,
                    decimals: currentToken.decimals,
                },
            },
        });
        
        if (wasAdded) {
            showAlert('Token added to MetaMask!', 'success');
        }
    } catch (error) {
        console.error('Error at adding to MetaMask:', error);
        showAlert('Error at adding to MetaMask', 'error');
    }
}

async function refreshBalance() {
    if (!currentToken || !userAccount) {
        showAlert('Load a token first!', 'error');
        return;
    }
    
    try {
        const balance = await currentToken.contract.methods.balanceOf(userAccount).call();
        const formattedBalance = (balance / Math.pow(10, currentToken.decimals)).toFixed(4);
        
        currentToken.balance = balance;
        document.getElementById('token-balance').textContent = `${formattedBalance} ${currentToken.symbol}`;
        document.getElementById('available-balance').textContent = `${formattedBalance} ${currentToken.symbol}`;
        
            showAlert('Balance updated!', 'success');
    } catch (error) {
        console.error('Error at updating balance:', error);
        showAlert('Error at updating balance', 'error');
    }
}

async function confirmTransfer() {
    if (!currentToken || !userAccount) {
        showAlert('Load a token first!', 'error');
        return;
    }
    
    const recipient = document.getElementById('recipient-address').value.trim();
    const amount = document.getElementById('transfer-amount').value;
    
    if (!recipient || !amount) {
        showAlert('Complete all fields!', 'error');
        return;
    }
    
    try {
        const amountInUnits = Math.floor(parseFloat(amount) * Math.pow(10, currentToken.decimals));
        
        const tx = await currentToken.contract.methods.transfer(recipient, amountInUnits.toString()).send({
            from: userAccount
        });
        
        showAlert('Transfer successful!', 'success');
        closeModal('transfer-modal');
        
        await refreshBalance();
        
        document.getElementById('recipient-address').value = '';
        document.getElementById('transfer-amount').value = '';
    } catch (error) {
        console.error('Error at transfer:', error);
        showAlert('Error at transfer. Check the balance and address.', 'error');
    }
}

async function confirmApprove() {
    if (!currentToken || !userAccount) {
        showAlert('Load a token first!', 'error');
        return;
    }
    
    const spender = document.getElementById('spender-address').value.trim();
    const amount = document.getElementById('approve-amount').value;
    
    if (!spender) {
        showAlert('Enter the spender address!', 'error');
        return;
    }
    
    try {
        let amountInUnits;
        if (!amount || amount === '') {
            amountInUnits = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
        } else {
            amountInUnits = Math.floor(parseFloat(amount) * Math.pow(10, currentToken.decimals)).toString();
        }
        
        const tx = await currentToken.contract.methods.approve(spender, amountInUnits).send({
            from: userAccount
        });
        
                showAlert('Approve successful!', 'success');
        closeModal('approve-modal');
        
        document.getElementById('spender-address').value = '';
        document.getElementById('approve-amount').value = '';
    } catch (error) {
        console.error('Error at approve:', error);
        showAlert('Error at approve', 'error');
    }
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `custom-alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 8px;
        z-index: 3000;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease-out;
        ${type === 'success' ? 'background-color: #34d399; color: #0D1117;' : ''}
        ${type === 'error' ? 'background-color: #ef4444; color: white;' : ''}
        ${type === 'info' ? 'background-color: #3b82f6; color: white;' : ''}
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
        setTimeout(() => alertDiv.remove(), 300);
    }, 3000);
}

