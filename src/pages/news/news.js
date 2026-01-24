// Variabile globale
let allNews = [];
let currentFilter = 'ALL';

const NEWS_API_URL = 'http://localhost:3000/api/news';

// Inițializare
document.addEventListener('DOMContentLoaded', () => {
    loadNews();
    setupFilterListeners();
});

/**
 * Încarcă știrile din API
 */
async function loadNews() {
    const loadingContainer = document.getElementById('loading-news');
    const newsContainer = document.getElementById('news-container');
    const errorMessage = document.getElementById('error-message');

    // Afișează loading
    loadingContainer.style.display = 'block';
    newsContainer.style.display = 'none';
    errorMessage.style.display = 'none';

    try {
        const response = await fetch(NEWS_API_URL);

        if (!response.ok) {
            throw new Error(`Eroare: ${response.status}`);
        }

        const data = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('Nu sunt disponibile știri');
        }

        allNews = data;
        renderNews(allNews);

        // Ascunde loading, afișează știrile
        loadingContainer.style.display = 'none';
        newsContainer.style.display = 'grid';

    } catch (error) {
        console.error('Eroare la încărcarea știrilor:', error);
        
        // Afișează mesajul de eroare
        loadingContainer.style.display = 'none';
        errorMessage.style.display = 'block';
    }
}

/**
 * Renderizează știrile în grid
 */
function renderNews(news) {
    const newsContainer = document.getElementById('news-container');
    newsContainer.innerHTML = '';

    if (news.length === 0) {
        newsContainer.innerHTML = '<p style="color: #8B949E; text-align: center; grid-column: 1/-1; padding: 40px;">Nu există știri pentru acest filtru.</p>';
        return;
    }

    news.forEach(article => {
        const newsCard = createNewsCard(article);
        newsContainer.appendChild(newsCard);
    });
}

/**
 * Creează un card de știre
 */
function createNewsCard(article) {
    const card = document.createElement('div');
    card.className = 'news-card';

    // Formatare dată
    const publishedDate = new Date(article.published_on * 1000);
    const formattedDate = formatDate(publishedDate);

    // Imagine (folosim placeholder dacă nu există)
    const imageUrl = article.imageurl || 'https://via.placeholder.com/400x200/21262D/8B949E?text=No+Image';

    // Tags (categorii)
    const tags = article.tags ? article.tags.split('|').slice(0, 3) : [];

    card.innerHTML = `
        <img src="${imageUrl}" alt="${article.title}" class="news-card-image" onerror="this.src='https://via.placeholder.com/400x200/21262D/8B949E?text=No+Image'">
        
        <div class="news-card-content">
            <div class="news-card-meta">
                <div class="news-card-source">
                    <img src="${article.source_info.img}" alt="${article.source_info.name}" onerror="this.style.display='none'">
                    <span>${article.source_info.name}</span>
                </div>
                <span class="news-card-date">${formattedDate}</span>
            </div>

            <h3 class="news-card-title">${article.title}</h3>
            
            <p class="news-card-description">${article.body}</p>

            ${tags.length > 0 ? `
                <div class="news-card-tags">
                    ${tags.map(tag => `<span class="news-tag">${tag}</span>`).join('')}
                </div>
            ` : ''}

            <div class="news-card-footer">
                <a href="${article.url}" target="_blank" rel="noopener noreferrer" class="read-more">
                    Citește mai mult
                </a>
            </div>
        </div>
    `;

    // Click pe card deschide știrea
    card.addEventListener('click', (e) => {
        // Nu deschide dacă s-a dat click pe link
        if (!e.target.closest('.read-more')) {
            window.open(article.url, '_blank');
        }
    });

    return card;
}

/**
 * Formatare dată relativă (acum X ore, acum Y zile)
 */
function formatDate(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
        return `acum ${diffMins} ${diffMins === 1 ? 'minut' : 'minute'}`;
    } else if (diffHours < 24) {
        return `acum ${diffHours} ${diffHours === 1 ? 'oră' : 'ore'}`;
    } else if (diffDays < 7) {
        return `acum ${diffDays} ${diffDays === 1 ? 'zi' : 'zile'}`;
    } else {
        return date.toLocaleDateString('ro-RO', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }
}

/**
 * Configurează ascultătorii pentru filtre
 */
function setupFilterListeners() {
    const filterButtons = document.querySelectorAll('.filter-btn');

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Actualizează clasele active
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Aplică filtrul
            const category = btn.getAttribute('data-category');
            currentFilter = category;
            filterNews(category);
        });
    });
}

/**
 * Filtrează știrile după categorie
 */
function filterNews(category) {
    if (category === 'ALL') {
        renderNews(allNews);
        return;
    }

    const filtered = allNews.filter(article => {
        const tags = article.tags ? article.tags.toUpperCase() : '';
        const title = article.title ? article.title.toUpperCase() : '';
        const body = article.body ? article.body.toUpperCase() : '';
        
        return tags.includes(category) || title.includes(category) || body.includes(category);
    });

    renderNews(filtered);
}
