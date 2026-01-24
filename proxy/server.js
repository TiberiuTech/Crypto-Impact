require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

const API_KEY = process.env.API_KEY;

app.use(cors());

app.use(express.static(path.join(__dirname, '..', 'src')));

app.get('/api/market', async (req, res) => {
    
    const apiUrl = `https://min-api.cryptocompare.com/data/top/totalvolfull?limit=20&tsym=EUR&api_key=${API_KEY}`;

    try {
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Erorr at CryptoCompare API: ${errorData.Message}`);
        }

        const data = await response.json();
        
        res.json(data); 

    } catch (error) {
        console.error("Error in proxy at market data:", error.message);
        res.status(500).json({ message: "Error at market data" });
    }
});


app.get('/api/history', async (req, res) => {
    const { symbol } = req.query;
    const limit = req.query.limit || 179; 
    
    if (!symbol) {
        return res.status(400).json({ message: "Simbolul monedei este necesar." });
    }
    
    const apiUrl = `https://min-api.cryptocompare.com/data/v2/histominute?fsym=${symbol}&tsym=EUR&limit=${limit}&aggregate=1&api_key=${API_KEY}`;

    try {
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Error at CryptoCompare API (History): ${errorData.Message}`);
        }

        const data = await response.json();
        
        if (data.Response === 'Error' || !data.Data || !Array.isArray(data.Data.Data)) {
             console.warn(`Warning (History): No data available for ${symbol}. API message: ${data.Message || 'No data.'}`);
             return res.json([]); 
        }

        const historyData = data.Data.Data.map(item => item.close);
        res.json(historyData); 

    } catch (error) {
        console.error(`Error in proxy at history data for ${symbol}:`, error.message);
        res.status(500).json({ message: `Error at history data for ${symbol}` });
    }
});

app.get('/api/news', async (req, res) => {

    const apiUrl = `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&api_key=${API_KEY}`;

    try {
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Error at CryptoCompare News API: ${errorData.Message}`);
        }

        const data = await response.json();
        
        if (data.Data && Array.isArray(data.Data)) {
            res.json(data.Data);
        } else {
            throw new Error('The response format is invalid');
        }

    } catch (error) {
        console.error("Error in proxy at news data:", error.message);
        res.status(500).json({ message: "Error at news data" });
    }
});


app.get('/api/coin-info', async (req, res) => {
    const { coinName } = req.query;
    if (!coinName) {
        return res.status(400).json({ message: "The coin name is required." });
    }

    const userQuery = `Write a short description (2 paragraphs) and neutral about the virtual coin ${coinName} and what it is used for.`;
    
    const systemPrompt = "Act as a neutral financial analyst. Provide concise and factual information based on current web searches.";
    
    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        tools: [{ "google_search": {} }], 
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
    };

    const geminiApiKey = ""
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiApiKey}`;
    
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`Gemini API call failed (Attempt ${attempt + 1}): ${response.status}. Body snippet: ${errorBody.substring(0, 100)}...`);
                throw new Error(`Gemini API returned status ${response.status}`);
            }

            const result = await response.json();
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                return res.json({ description: text });
            } else {
                throw new Error("The model response does not contain text.");
            }
        } catch (error) {
            console.warn(`Error at attempt ${attempt + 1} of AI generation (${coinName}):`, error.message);
            
            if (attempt === MAX_RETRIES - 1) {                                                  
                console.error(`Permanent failure at obtaining information for ${coinName}.`);
                return res.json({ description: `Sorry, we couldn't get information from AI about ${coinName}. Please try again later.` });
            }
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
});


app.listen(PORT, () => {
    console.log(`🚀 Proxy server (CryptoCompare) running on http://localhost:${PORT}`);
});