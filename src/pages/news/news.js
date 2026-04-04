let allNews = [];
let currentFilter = 'ALL';

const NEWS_API_URL = 'http://localhost:3000/api/news';

document.addEventListener('DOMContentLoaded', () => {
    loadNews();
    setupFilterListeners();
});

async function loadNews() {
    const loadingContainer = document.getElementById('loading-news');
    const newsContainer = document.getElementById('news-container');
    const errorMessage = document.getElementById('error-message');

    loadingContainer.style.display = 'block';
    newsContainer.style.display = 'none';
    errorMessage.style.display = 'none';

    try {
        const response = await fetch(NEWS_API_URL);

        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }

        const data = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('No news available');
        }

        allNews = data;
        renderNews(allNews);

        loadingContainer.style.display = 'none';
        newsContainer.style.display = 'grid';

    } catch (error) {
        console.error('Error at loading news:', error);
        
        loadingContainer.style.display = 'none';
        errorMessage.style.display = 'block';
    }
}

function renderNews(news) {
    const newsContainer = document.getElementById('news-container');
    newsContainer.innerHTML = '';

    if (news.length === 0) {
        newsContainer.innerHTML = '<p style="color: #8B949E; text-align: center; grid-column: 1/-1; padding: 40px;">No news for this filter.</p>';
        return;
    }

    news.forEach(article => {
        const newsCard = createNewsCard(article);
        newsContainer.appendChild(newsCard);
    });
}

/** SVG local — nu depinde de via.placeholder (uneori blocat); evită „cutii” gri goale. */
const PLACEHOLDER_IMG =
    'data:image/svg+xml,' +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><rect fill="#21262D" width="800" height="400"/><text x="400" y="200" fill="#8B949E" font-family="system-ui,sans-serif" font-size="18" text-anchor="middle">News</text></svg>'
    );

function createNewsCard(article) {
    const card = document.createElement('div');
    card.className = 'news-card';

    const publishedDate = new Date(article.published_on * 1000);
    const formattedDate = formatDate(publishedDate);

    const rawImg =
        article.imageurl ||
        article.imageUrl ||
        (article.enclosure && article.enclosure.url) ||
        '';
    const imageUrl = typeof rawImg === 'string' && rawImg.trim() ? rawImg.trim() : PLACEHOLDER_IMG;

    const tags = article.tags ? article.tags.split('|').slice(0, 3) : [];

    const thumb = document.createElement('img');
    thumb.className = 'news-card-image';
    thumb.alt = article.title || '';
    thumb.decoding = 'async';
    thumb.src = imageUrl;
    let thumbFallback = false;
    thumb.onerror = () => {
        if (!thumbFallback) {
            thumbFallback = true;
            thumb.src = PLACEHOLDER_IMG;
        }
    };

    const content = document.createElement('div');
    content.className = 'news-card-content';

    const meta = document.createElement('div');
    meta.className = 'news-card-meta';

    const sourceRow = document.createElement('div');
    sourceRow.className = 'news-card-source';

    const srcIcon = document.createElement('img');
    const si = article.source_info || {};
    srcIcon.src = si.img || '';
    srcIcon.alt = si.name || '';
    srcIcon.onerror = () => {
        srcIcon.style.display = 'none';
    };

    const srcName = document.createElement('span');
    srcName.textContent = si.name || '';

    sourceRow.appendChild(srcIcon);
    sourceRow.appendChild(srcName);

    const dateEl = document.createElement('span');
    dateEl.className = 'news-card-date';
    dateEl.textContent = formattedDate;

    meta.appendChild(sourceRow);
    meta.appendChild(dateEl);

    const titleEl = document.createElement('h3');
    titleEl.className = 'news-card-title';
    titleEl.textContent = article.title || '';

    const descEl = document.createElement('p');
    descEl.className = 'news-card-description';
    descEl.textContent = article.body || '';

    content.appendChild(meta);
    content.appendChild(titleEl);
    content.appendChild(descEl);

    if (tags.length > 0) {
        const tagWrap = document.createElement('div');
        tagWrap.className = 'news-card-tags';
        tags.forEach((tag) => {
            const t = document.createElement('span');
            t.className = 'news-tag';
            t.textContent = tag.trim();
            tagWrap.appendChild(t);
        });
        content.appendChild(tagWrap);
    }

    const footer = document.createElement('div');
    footer.className = 'news-card-footer';
    const link = document.createElement('a');
    link.href = article.url || '#';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'read-more';
    link.textContent = 'Read more →';
    footer.appendChild(link);
    content.appendChild(footer);

    card.appendChild(thumb);
    card.appendChild(content);

    card.addEventListener('click', (e) => {
        if (!e.target.closest('.read-more') && article.url) {
            window.open(article.url, '_blank');
        }
    });

    return card;
}

function formatDate(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
        return `about ${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'}`;
    } else if (diffHours < 24) {
        return `about ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'}`;
    } else if (diffDays < 7) {
        return `about ${diffDays} ${diffDays === 1 ? 'day' : 'days'}`;
    } else {
        return date.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }
}

function setupFilterListeners() {
    const filterButtons = document.querySelectorAll('.filter-btn');

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const category = btn.getAttribute('data-category');
            currentFilter = category;
            filterNews(category);
        });
    });
}

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
