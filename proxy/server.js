require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

const API_KEY = process.env.API_KEY;

/** Știri doar din fluxuri RSS (fără cheie API). */
const RSS_NEWS_FEEDS = [
    { url: 'https://decrypt.co/feed', name: 'Decrypt', favicon: 'https://decrypt.co/favicon.ico' },
    { url: 'https://news.bitcoin.com/feed/', name: 'Bitcoin.com', favicon: 'https://news.bitcoin.com/favicon.ico' },
    { url: 'https://cointelegraph.com/rss', name: 'Cointelegraph', favicon: 'https://cointelegraph.com/favicon.ico' },
];

function stripHtml(html) {
    return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractTag(block, tag) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const m = block.match(re);
    if (!m) return '';
    let inner = m[1].trim().replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');
    return inner.trim();
}

function extractItemLink(block) {
    let link = extractTag(block, 'link');
    link = link.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim();
    if (link) return link;
    const m = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
    return m ? m[1].trim() : '';
}

function firstImgSrc(html) {
    if (!html) return '';
    const s = String(html);
    let m = s.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m) return m[1].trim();
    m = s.match(/\sdata-src=["']([^"']+)["']/i);
    if (m) return m[1].trim();
    m = s.match(/srcset=["']([^"']+)["']/i);
    if (m) {
        const first = m[1].split(',')[0].trim().split(/\s+/)[0];
        if (first) return first;
    }
    return '';
}

function resolveImageUrl(url, articleUrl) {
    if (!url || typeof url !== 'string') return '';
    const u = url.trim();
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith('//')) return `https:${u}`;
    try {
        return new URL(u, articleUrl).href;
    } catch {
        return u;
    }
}

/** Imagini din RSS: la Decrypt sunt în <media:thumbnail> / <enclosure>, nu în <description> (text scurt). */
function extractRssItemImage(block, articleLink) {
    const contentEncoded = extractTag(block, 'content:encoded');
    const description = extractTag(block, 'description');

    let raw = '';

    const mt = block.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i);
    if (mt) raw = mt[1].trim();

    if (!raw) {
        const enc = block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image\//i);
        if (enc) raw = enc[1].trim();
    }

    if (!raw) {
        raw = firstImgSrc(contentEncoded) || firstImgSrc(description) || '';
    }

    if (!raw) {
        const mcm = block.matchAll(/<media:content\s+([^>]+)\/?>/gi);
        for (const mc of mcm) {
            const attrs = mc[1];
            const um = attrs.match(/url=["']([^"']+)["']/i);
            if (!um) continue;
            if (/medium=["']image["']/i.test(attrs) || /type=["']image\//i.test(attrs)) {
                raw = um[1].trim();
                break;
            }
        }
    }
    if (!raw) {
        const m = block.match(/<media:content[^>]*url=["']([^"']+)["']/i);
        if (m) raw = m[1].trim();
    }

    raw = resolveImageUrl(raw, articleLink);
    return raw || '';
}

function parseRssItems(xml, meta) {
    const items = [];
    const itemRe = /<item>([\s\S]*?)<\/item>/gi;
    let m;
    while ((m = itemRe.exec(xml)) !== null && items.length < 40) {
        const block = m[1];
        const title = stripHtml(extractTag(block, 'title'));
        const link = extractItemLink(block);
        const pubDate = extractTag(block, 'pubDate');
        const description = extractTag(block, 'description');
        const contentEncoded = extractTag(block, 'content:encoded');
        const excerptSource = description || contentEncoded;
        if (!title || !link) continue;
        const publishedOn = Math.floor(new Date(pubDate).getTime() / 1000) || Math.floor(Date.now() / 1000);
        let img = extractRssItemImage(block, link);
        if (!img) {
            img = 'https://via.placeholder.com/400x200/21262D/8B949E?text=News';
        }
        items.push({
            title,
            body: stripHtml(excerptSource).slice(0, 800),
            url: link,
            published_on: publishedOn,
            imageurl: img,
            tags: 'CRYPTO|BLOCKCHAIN|MARKET',
            source_info: { name: meta.name, img: meta.favicon },
        });
    }
    return items;
}

async function fetchNewsFromRss() {
    const headers = {
        'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
    };
    let lastErr = null;
    for (const feed of RSS_NEWS_FEEDS) {
        try {
            const res = await fetch(feed.url, { headers });
            if (!res.ok) {
                lastErr = new Error(`RSS HTTP ${res.status} ${feed.url}`);
                continue;
            }
            const xml = await res.text();
            if (!xml.includes('<item')) {
                lastErr = new Error(`RSS: no <item> in ${feed.url}`);
                continue;
            }
            const items = parseRssItems(xml, feed);
            if (items.length > 0) {
                console.log(`News: RSS from ${feed.name} (${items.length} articles)`);
                return items;
            }
            lastErr = new Error(`RSS: no items parsed ${feed.url}`);
        } catch (e) {
            lastErr = e;
        }
    }
    throw lastErr || new Error('RSS: all feeds failed');
}

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
    try {
        const articles = await fetchNewsFromRss();
        res.json(articles);
    } catch (error) {
        console.error('Error in proxy at news (RSS):', error.message);
        res.status(500).json({ message: 'Error at news data' });
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
                console.error(` ${attempt + 1}: ${response.status}: ${errorBody.substring(0, 100)}...`);
                throw new Error(` ${response.status}`);
            }

            const result = await response.json();
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                return res.json({ description: text });
            } else {
                throw new Error("The model response does not contain text.");
            }
        } catch (error) {
            console.warn(` ${attempt + 1}  (${coinName}):`, error.message);
            
            if (attempt === MAX_RETRIES - 1) {                                                  
                console.error(` ${coinName}.`);
                return res.json({ description: ` ${coinName}.` });
            }
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
});


app.listen(PORT, () => {
    console.log(`Proxy server (CryptoCompare) running on http://localhost:${PORT}`);
});