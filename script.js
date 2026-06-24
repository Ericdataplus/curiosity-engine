document.addEventListener('DOMContentLoaded', () => {
    // ===== DOM Elements =====
    const articleTitle = document.getElementById('article-title');
    const articleContent = document.getElementById('article-content');
    const readMore = document.getElementById('read-more');
    const newTopicBtn = document.getElementById('new-topic-btn');
    const wikiToc = document.getElementById('wiki-toc');
    const categoryLink = document.getElementById('category-link');
    const youtubeSearchLink = document.getElementById('youtube-search-link');
    const themeToggle = document.getElementById('theme-toggle');
    const bookmarkBtn = document.getElementById('bookmark-btn');
    const shareBtn = document.getElementById('share-btn');
    const copyTooltip = document.getElementById('copy-tooltip');
    const bookmarksPanel = document.getElementById('bookmarks-panel');
    const closeBookmarks = document.getElementById('close-bookmarks');
    const bookmarksList = document.getElementById('bookmarks-list');
    const bookmarksStat = document.getElementById('bookmarks-stat');
    const categorySelect = document.getElementById('category-select');
    const exploredCount = document.getElementById('explored-count');
    const historyList = document.getElementById('history-list');
    const historyContainer = document.getElementById('history-container');
    const progressBar = document.getElementById('progress-bar');
    const videoPlayer = document.getElementById('video-player');
    const videoList = document.getElementById('video-list');
    const videoTopicLabel = document.getElementById('video-topic-label');
    const articleHero = document.getElementById('article-hero');
    const articleHeroImg = document.getElementById('article-hero-img');
    const relatedTopics = document.getElementById('related-topics');
    const relatedList = document.getElementById('related-list');
    const simpleToggle = document.getElementById('simple-toggle');
    const listenBtn = document.getElementById('listen-btn');
    const srStatus = document.getElementById('sr-status');
    // New UI
    const streakStat = document.getElementById('streak-stat');
    const streakCountEl = document.getElementById('streak-count');
    const dailyChip = document.getElementById('daily-chip');
    const dailyTopicName = document.getElementById('daily-topic-name');
    const resumeChip = document.getElementById('resume-chip');
    const resumeText = document.getElementById('resume-text');
    const introEl = document.getElementById('intro');
    const introDismiss = document.getElementById('intro-dismiss');
    const kbdHint = document.getElementById('kbd-hint');
    const trailEl = document.getElementById('trail');
    const trailListEl = document.getElementById('trail-list');
    const trailShareBtn = document.getElementById('trail-share');
    const noteBtn = document.getElementById('note-btn');
    const noteEditor = document.getElementById('note-editor');
    const noteText = document.getElementById('note-text');
    const noteSave = document.getElementById('note-save');
    const noteDelete = document.getElementById('note-delete');
    const noteClose = document.getElementById('note-close');
    const noteDisplay = document.getElementById('note-display');
    const readingProgress = document.getElementById('reading-progress');
    const readingProgressText = document.getElementById('reading-progress-text');
    const readingProgressFill = document.getElementById('reading-progress-fill');
    const toast = document.getElementById('toast');
    const toastText = document.getElementById('toast-text');
    const toastShare = document.getElementById('toast-share');
    const toastClose = document.getElementById('toast-close');

    // ===== localStorage keys =====
    const LS = {
        theme: 'theme', bookmarks: 'bookmarks', history: 'history',
        explored: 'exploredTopics', notes: 'ce_notes', trail: 'ce_trail',
        streak: 'ce_streak', seenIntro: 'ce_seenIntro'
    };

    // ===== State =====
    let allTopics = [];                  // [{category, topic, tier}]
    const topicsByCategory = {};         // built dynamically from the CSV
    const viewedTopics = new Set();
    const MAX_VIEWED_TOPICS = 120;
    const MAX_HISTORY_ITEMS = 8;
    const MILESTONES = [10, 25, 50, 100, 250, 500];

    let topicFilter = '';                // '' = all areas
    let exploredTopics = new Set();
    let isLoading = false;
    let bookmarks = [];
    let notes = {};                      // { topic: text }
    let currentArticle = null;
    let trail = [];                      // [{topic, title}] — the rabbit-hole path
    let articleState = null;
    let dailyTopic = null;

    let videoRequestId = 0;
    let activeVideoCard = null;
    let relatedRequestId = 0;
    let isSpeaking = false;
    let speakKeepAlive = null;

    const articleCache = new Map();      // title -> Promise<wikiData> (dedupe + prefetch)
    let nextRandom = null;               // { topic, filter, promise }

    const KEEP_TRAIL = new Set(['pop', 'trailjump', 'resume', 'pathload', 'retry']);

    // ===== Init =====
    loadSettings();
    loadBookmarks();
    loadNotes();
    loadHistory();
    loadExplored();
    updateStreak();
    maybeShowIntro();

    loadTopicsFromCSV().then(() => {
        buildCategoryDropdown();
        setupDailyTopic();
        setupResume();

        const params = new URLSearchParams(window.location.search);
        const path = params.get('path');
        const topic = params.get('topic');

        if (path) {
            loadTrailFromPath(path);
        } else if (topic) {
            goToArticle(decodeURIComponent(topic), 'shared', { mode: 'replace' });
        } else {
            loadRandomArticle({ mode: 'replace' });
        }
    });

    // ===== Event listeners =====
    newTopicBtn.addEventListener('click', () => {
        markIntroSeen();
        if (!isLoading) loadRandomArticle({ mode: 'push' });
    });

    themeToggle.addEventListener('click', toggleTheme);
    bookmarkBtn.addEventListener('click', toggleBookmark);
    shareBtn.addEventListener('click', shareArticle);

    if (simpleToggle) simpleToggle.addEventListener('click', toggleReadingLevel);
    if (listenBtn) {
        if ('speechSynthesis' in window) {
            listenBtn.addEventListener('click', toggleListen);
        } else {
            listenBtn.style.display = 'none';
        }
    }

    closeBookmarks.addEventListener('click', () => bookmarksPanel.classList.remove('open'));
    if (bookmarksStat) {
        bookmarksStat.addEventListener('click', () => bookmarksPanel.classList.toggle('open'));
    }

    if (categorySelect) {
        categorySelect.addEventListener('change', () => {
            topicFilter = categorySelect.value;
            nextRandom = null; // filter changed — drop the stale prefetch
            if (!isLoading) loadRandomArticle({ mode: 'push' });
        });
    }

    if (introDismiss) introDismiss.addEventListener('click', markIntroSeen);

    // Notes
    if (noteBtn) noteBtn.addEventListener('click', openNoteEditor);
    if (noteSave) noteSave.addEventListener('click', saveCurrentNote);
    if (noteDelete) noteDelete.addEventListener('click', deleteCurrentNote);
    if (noteClose) noteClose.addEventListener('click', () => { closeNoteEditor(); updateNoteUI(currentTopic()); });

    // Trail
    if (trailShareBtn) trailShareBtn.addEventListener('click', shareTrail);
    if (dailyChip) dailyChip.addEventListener('click', () => { if (dailyTopic && !isLoading) goToArticle(dailyTopic, 'daily', { mode: 'push' }); });
    if (resumeChip) resumeChip.addEventListener('click', resumeTrail);

    // Milestone toast
    if (toastClose) toastClose.addEventListener('click', hideToast);

    // Keyboard navigation: ArrowRight / "n" → next topic
    document.addEventListener('keydown', (e) => {
        const tag = (e.target && e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') {
            e.preventDefault();
            markIntroSeen();
            if (!isLoading) loadRandomArticle({ mode: 'push' });
        }
    });

    // Reading progress tracks the whole page now (article is no longer in a scroll box)
    window.addEventListener('scroll', updateProgressBar, { passive: true });

    // Back / forward walk the rabbit hole
    window.addEventListener('popstate', (e) => {
        const t = (e.state && e.state.topic) ||
            new URLSearchParams(window.location.search).get('topic');
        if (t) {
            goToArticle(decodeURIComponent(t), 'pop', { mode: 'none' });
        } else if (!isLoading) {
            loadRandomArticle({ mode: 'none' });
        }
    });

    // Stop read-aloud when the tab is hidden or the page is left
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopListening(); });
    window.addEventListener('pagehide', stopListening);

    // TOC show/hide — bound once (operates on whatever <ol> is current)
    const tocToggle = wikiToc.querySelector('.wiki-toc-toggle');
    function handleTocToggle() {
        const ol = wikiToc.querySelector('ol');
        if (!ol) return;
        const hidden = ol.style.display === 'none';
        ol.style.display = hidden ? '' : 'none';
        tocToggle.textContent = hidden ? '[hide]' : '[show]';
    }
    if (tocToggle) {
        tocToggle.addEventListener('click', handleTocToggle);
        tocToggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTocToggle(); }
        });
    }

    // ===== CSV loading (hardened parser, 3-column category,topic,tier) =====
    async function loadTopicsFromCSV() {
        try {
            const response = await fetch('topics.csv');
            if (!response.ok) throw new Error(`Failed to load CSV: ${response.status}`);
            const csvText = await response.text();
            const lines = csvText.split(/\r?\n/);

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const firstComma = line.indexOf(',');
                if (firstComma === -1) continue;
                const category = line.slice(0, firstComma).trim();
                let remainder = line.slice(firstComma + 1).trim();

                let tier = 'mainstream';
                const lastComma = remainder.lastIndexOf(',');
                if (lastComma !== -1) {
                    const maybeTier = remainder.slice(lastComma + 1).trim().toLowerCase();
                    if (maybeTier === 'mainstream' || maybeTier === 'deepcut') {
                        tier = maybeTier;
                        remainder = remainder.slice(0, lastComma).trim();
                    }
                }
                const topic = remainder;
                if (!category || !topic) continue;

                if (!topicsByCategory[category]) topicsByCategory[category] = [];
                topicsByCategory[category].push(topic);
                allTopics.push({ category, topic, tier });
            }

            console.log(`Loaded ${allTopics.length} topics across ${Object.keys(topicsByCategory).length} categories`);
            if (allTopics.length === 0) setupFallbackTopics();
        } catch (error) {
            console.error('Error loading topics from CSV:', error);
            setupFallbackTopics();
        }
    }

    function setupFallbackTopics() {
        const fallback = [
            { category: 'Physics', topic: 'Quantum mechanics', tier: 'mainstream' },
            { category: 'Astronomy', topic: 'Black hole', tier: 'mainstream' },
            { category: 'Biology', topic: 'Evolution', tier: 'mainstream' },
            { category: 'History', topic: 'Roman Empire', tier: 'mainstream' },
            { category: 'Philosophy', topic: 'Stoicism', tier: 'mainstream' },
            { category: 'Art', topic: 'Renaissance', tier: 'mainstream' },
            { category: 'Mathematics', topic: 'Calculus', tier: 'mainstream' },
            { category: 'Computer Science', topic: 'Algorithm', tier: 'mainstream' }
        ];
        allTopics = fallback;
        fallback.forEach(({ category, topic }) => {
            if (!topicsByCategory[category]) topicsByCategory[category] = [];
            topicsByCategory[category].push(topic);
        });
    }

    // Build the topic-area dropdown from the categories actually present
    function buildCategoryDropdown() {
        if (!categorySelect) return;
        const cats = Object.keys(topicsByCategory).sort((a, b) => a.localeCompare(b));
        // keep the existing "All areas" option, append the rest
        cats.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = prettyCategory(cat);
            categorySelect.appendChild(opt);
        });
        categorySelect.value = topicFilter;
    }

    function prettyCategory(cat) {
        return (cat || '').replace(/_/g, ' ');
    }

    // ===== Core navigation =====

    // Load a random article from the current filter
    function loadRandomArticle(opts = {}) {
        if (isLoading) return;
        let topic = null;
        let preFetched = null;

        if (nextRandom && nextRandom.filter === topicFilter && nextRandom.topic) {
            topic = nextRandom.topic;
            preFetched = nextRandom.promise;
            nextRandom = null;
        } else {
            topic = getRandomTopic(topicFilter);
        }

        if (!topic) {
            showArticleError(null, `No topics available for this area.`);
            return;
        }
        goToArticle(topic, 'random', { mode: opts.mode || 'push', preFetched });
    }

    // The single article loader: fetch (with one silent retry), render, update URL + trail
    async function goToArticle(topic, source, opts = {}) {
        const { mode = 'push', preFetched = null } = opts;
        if (isLoading) return;
        isLoading = true;
        showSkeleton();
        closeNoteEditor();

        let data = null;
        for (let attempt = 0; attempt < 2 && !data; attempt++) {
            try {
                const d = await ((attempt === 0 && preFetched) ? preFetched : fetchWikipediaArticle(topic));
                if (!d || !d.title || !d.extract_html) throw new Error('invalid article data');
                data = d;
            } catch (e) {
                if (attempt === 1) console.error('Error loading article:', e);
            }
        }

        if (data) {
            markTopicAsViewed(topic);
            renderArticle(data, topic, identifyCategory(topic));
            pushTrail(topic, data.title, source);

            const url = window.location.pathname + '?topic=' + encodeURIComponent(topic);
            if (mode === 'push') window.history.pushState({ topic, source }, '', url);
            else if (mode === 'replace') window.history.replaceState({ topic, source }, '', url);
        } else {
            showArticleError(topic, "Couldn't load this topic. The connection may have hiccuped.");
            updateYouTubeSearchLink('curiosity');
            resetVideoSidebar();
            clearArticleExtras();
            currentArticle = null;
            updateBookmarkButtonState();
        }

        isLoading = false;
        prefetchNext();
    }

    // Warm the cache for the next random topic so Discover swaps in instantly
    function prefetchNext() {
        if (!allTopics.length) return;
        const t = getRandomTopic(topicFilter);
        if (!t) { nextRandom = null; return; }
        const promise = fetchWikipediaArticle(t);
        promise.catch(() => {}); // avoid unhandled rejection
        nextRandom = { topic: t, filter: topicFilter, promise };
    }

    function getRandomTopic(category) {
        const available = (!category)
            ? allTopics.map(t => t.topic)
            : (topicsByCategory[category] || []);
        if (!available.length) return null;
        const unseen = available.filter(t => !viewedTopics.has(t));
        const pool = unseen.length ? unseen : available;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    function markTopicAsViewed(topic) {
        viewedTopics.add(topic);
        if (viewedTopics.size > MAX_VIEWED_TOPICS) {
            viewedTopics.delete(viewedTopics.values().next().value);
        }
    }

    function identifyCategory(topic) {
        for (const category in topicsByCategory) {
            if (topicsByCategory[category].includes(topic)) return category;
        }
        return '';
    }

    // ===== Fetch (cached, with timeout) =====
    function fetchWikipediaArticle(title) {
        if (articleCache.has(title)) return articleCache.get(title);

        const promise = (async () => {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 10000);
            try {
                const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
                const res = await fetch(url, { signal: controller.signal });
                if (!res.ok) throw new Error(`Wikipedia API status ${res.status}`);
                return await res.json();
            } finally {
                clearTimeout(tid);
            }
        })();

        articleCache.set(title, promise);
        promise.catch(() => articleCache.delete(title)); // let failures be retried
        if (articleCache.size > 60) articleCache.delete(articleCache.keys().next().value);
        return promise;
    }

    // ===== Rendering =====
    function showSkeleton() {
        articleTitle.innerHTML = '<span class="skeleton skeleton-heading"></span>';
        let html = '';
        const widths = ['96%', '99%', '88%', '94%', '70%'];
        widths.forEach(w => { html += `<div class="skeleton skeleton-line" style="width:${w}"></div>`; });
        articleContent.innerHTML = html;
        wikiToc.style.display = 'none';
        if (articleHero) articleHero.hidden = true;
        if (relatedTopics) relatedTopics.hidden = true;
        if (noteDisplay) noteDisplay.hidden = true;
        progressBar.style.width = '0';
    }

    function renderArticle(wikiData, topic, category) {
        articleTitle.textContent = wikiData.title;
        articleContent.innerHTML = wikiData.extract_html;
        progressBar.style.width = '0';
        window.scrollTo({ top: 0, behavior: 'auto' });

        readMore.href = (wikiData.content_urls && wikiData.content_urls.desktop && wikiData.content_urls.desktop.page)
            ? wikiData.content_urls.desktop.page
            : `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiData.title)}`;

        currentArticle = {
            title: wikiData.title,
            topic: topic,
            category: category || '',
            url: readMore.href,
            timestamp: new Date().toISOString(),
            read: false
        };

        updateBookmarkButtonState();
        addToHistory(currentArticle);
        markExplored(topic);
        announce(`Loaded: ${wikiData.title}`);

        // Category link
        const catDisplay = category ? prettyCategory(category) : 'General';
        categoryLink.textContent = catDisplay;
        categoryLink.href = category
            ? `https://en.wikipedia.org/wiki/Category:${encodeURIComponent(category.replace(/ /g, '_'))}`
            : `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiData.title)}`;

        articleState = {
            title: wikiData.title,
            extractHtml: wikiData.extract_html,
            extract: wikiData.extract || '',
            standardExtract: wikiData.extract || '',
            simpleHtml: null,
            simpleExtract: null,
            level: 'standard'
        };
        stopListening();
        updateLevelToggleUI('standard');
        renderHeroImage(wikiData);
        updateNoteUI(topic);

        generateTableOfContents();
        updateYouTubeSearchLink(wikiData.title);
        loadVideosForTopic(wikiData.title, category);
        loadRelatedTopics(wikiData.title);
    }

    function showArticleError(topic, message) {
        articleTitle.textContent = 'Hmm, that didn’t load';
        const wrap = document.createElement('div');
        wrap.className = 'article-error';
        const p = document.createElement('p');
        p.textContent = message || "Couldn't load this topic.";
        wrap.appendChild(p);

        const retry = document.createElement('button');
        retry.className = 'action-btn primary';
        retry.innerHTML = '<i class="fas fa-rotate-right" aria-hidden="true"></i> Try again';
        retry.addEventListener('click', () => {
            if (isLoading) return;
            if (topic) goToArticle(topic, 'retry', { mode: 'replace' });
            else loadRandomArticle({ mode: 'replace' });
        });
        wrap.appendChild(retry);

        const rnd = document.createElement('button');
        rnd.className = 'action-btn';
        rnd.innerHTML = '<i class="fas fa-random" aria-hidden="true"></i> Random topic';
        rnd.addEventListener('click', () => { if (!isLoading) loadRandomArticle({ mode: 'push' }); });
        wrap.appendChild(rnd);

        articleContent.innerHTML = '';
        articleContent.appendChild(wrap);
        wikiToc.style.display = 'none';
    }

    function announce(msg) {
        if (srStatus) srStatus.textContent = msg;
    }

    // ===== YouTube button + videos =====
    function updateYouTubeSearchLink(title) {
        if (youtubeSearchLink) {
            youtubeSearchLink.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`;
        }
    }

    function loadVideosForTopic(title, category) {
        if (!videoList) return;
        const requestId = ++videoRequestId;
        clearVideoPlayer();
        if (videoTopicLabel) videoTopicLabel.textContent = title;
        videoList.innerHTML = '<div class="video-loading"><div class="loading-spinner" aria-label="Loading videos"></div></div>';

        const query = `${title} explained`;
        const fields = 'id,title,duration,thumbnail_360_url,owner.screenname,views_total';
        const url = `https://api.dailymotion.com/videos?search=${encodeURIComponent(query)}` +
            `&fields=${fields}&limit=20&sort=relevance`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        fetch(url, { signal: controller.signal })
            .then(res => { clearTimeout(timeout); if (!res.ok) throw new Error(`status ${res.status}`); return res.json(); })
            .then(data => {
                if (requestId !== videoRequestId) return;
                const videos = filterRelevantVideos((data.list || []), title);
                renderVideoList(videos, title);
            })
            .catch(error => {
                clearTimeout(timeout);
                if (requestId !== videoRequestId) return;
                console.error('Error loading videos:', error);
                renderVideoFallback(title, 'Could not load videos right now.');
            });
    }

    // Keep only videos that plausibly match the topic, then the strongest few
    function filterRelevantVideos(list, title) {
        const stop = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'from', 'what', 'how', 'why', 'are', 'explained', 'a', 'an', 'of', 'to', 'in', 'on']);
        const tokens = title.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3 && !stop.has(w));

        const scored = (list || [])
            .filter(v => v && v.id && v.thumbnail_360_url)
            .map(v => {
                const t = (v.title || '').toLowerCase();
                const overlap = tokens.reduce((n, tok) => n + (t.includes(tok) ? 1 : 0), 0);
                return { v, overlap, views: Number(v.views_total) || 0 };
            });

        // Prefer title-overlap; if the topic has searchable tokens, drop zero-overlap junk
        let kept = tokens.length ? scored.filter(s => s.overlap > 0) : scored;
        if (kept.length < 3) kept = scored; // don't strand the user with nothing

        kept.sort((a, b) => (b.overlap - a.overlap) || (b.views - a.views));
        return kept.slice(0, 5).map(s => s.v);
    }

    function renderVideoList(videos, title) {
        videoList.innerHTML = '';
        if (!videos.length) { renderVideoFallback(title, 'No closely matching videos found.'); return; }
        videos.forEach(video => videoList.appendChild(buildVideoCard(video)));
        videoList.appendChild(buildMoreOnYouTube(title));
    }

    function buildVideoCard(video) {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Play: ${video.title || 'video'}`);

        const thumb = document.createElement('div');
        thumb.className = 'video-thumb';
        const img = document.createElement('img');
        img.src = video.thumbnail_360_url || '';
        img.alt = '';
        img.loading = 'lazy';
        thumb.appendChild(img);

        if (video.duration) {
            const duration = document.createElement('span');
            duration.className = 'video-duration';
            duration.textContent = formatDuration(video.duration);
            thumb.appendChild(duration);
        }
        const overlay = document.createElement('span');
        overlay.className = 'video-play-overlay';
        overlay.innerHTML = '<i class="fas fa-play-circle" aria-hidden="true"></i>';
        thumb.appendChild(overlay);

        const meta = document.createElement('div');
        meta.className = 'video-meta';
        const cardTitle = document.createElement('h3');
        cardTitle.className = 'video-card-title';
        cardTitle.textContent = video.title || 'Untitled';
        const channel = document.createElement('p');
        channel.className = 'video-card-channel';
        const owner = video['owner.screenname'] || 'Unknown';
        channel.textContent = (video.views_total != null) ? `${owner} • ${formatViews(video.views_total)} views` : owner;
        meta.appendChild(cardTitle);
        meta.appendChild(channel);

        card.appendChild(thumb);
        card.appendChild(meta);

        const play = () => playVideo(video.id, video.title, card);
        card.addEventListener('click', play);
        card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); } });
        return card;
    }

    function playVideo(videoId, title, card) {
        if (!videoPlayer) return;
        const frame = document.createElement('div');
        frame.className = 'video-player-frame';
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.dailymotion.com/embed/video/${encodeURIComponent(videoId)}?autoplay=1`;
        iframe.title = title || 'Video player';
        iframe.allow = 'autoplay; fullscreen; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-presentation');
        frame.appendChild(iframe);
        videoPlayer.innerHTML = '';
        videoPlayer.appendChild(frame);
        videoPlayer.hidden = false;
        if (activeVideoCard) activeVideoCard.classList.remove('active');
        if (card) { card.classList.add('active'); activeVideoCard = card; }
        videoPlayer.scrollIntoView({ block: 'nearest' });
    }

    function clearVideoPlayer() {
        if (!videoPlayer) return;
        videoPlayer.innerHTML = '';
        videoPlayer.hidden = true;
        if (activeVideoCard) { activeVideoCard.classList.remove('active'); activeVideoCard = null; }
    }

    function renderVideoFallback(title, message) {
        clearVideoPlayer();
        if (!videoList) return;
        videoList.innerHTML = '';
        const empty = document.createElement('div');
        empty.className = 'video-empty';
        const p = document.createElement('p');
        p.textContent = message || 'No videos found.';
        empty.appendChild(p);
        if (title) {
            const link = document.createElement('a');
            link.className = 'video-fallback-link';
            link.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.innerHTML = '<i class="fab fa-youtube" aria-hidden="true"></i> Search YouTube';
            empty.appendChild(link);
        }
        videoList.appendChild(empty);
    }

    function resetVideoSidebar() {
        if (videoTopicLabel) videoTopicLabel.textContent = '';
        clearVideoPlayer();
        if (videoList) videoList.innerHTML = '<div class="video-empty"><p>Pick a topic to see related videos.</p></div>';
    }

    function buildMoreOnYouTube(title) {
        const wrap = document.createElement('div');
        wrap.className = 'video-more';
        const link = document.createElement('a');
        link.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.innerHTML = '<i class="fab fa-youtube" aria-hidden="true"></i> More on YouTube →';
        wrap.appendChild(link);
        return wrap;
    }

    function formatDuration(totalSeconds) {
        const seconds = Math.round(totalSeconds);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        const minutes = h > 0 ? String(m).padStart(2, '0') : String(m);
        return (h > 0 ? `${h}:` : '') + `${minutes}:${String(s).padStart(2, '0')}`;
    }

    function formatViews(count) {
        const n = Number(count) || 0;
        if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
        return String(n);
    }

    // ===== Hero, related =====
    function renderHeroImage(wikiData) {
        if (!articleHero || !articleHeroImg) return;
        const src = (wikiData.thumbnail && wikiData.thumbnail.source) ||
            (wikiData.originalimage && wikiData.originalimage.source) || '';
        if (src) {
            articleHeroImg.src = src;
            articleHeroImg.alt = wikiData.title || '';
            articleHero.hidden = false;
        } else {
            articleHeroImg.removeAttribute('src');
            articleHero.hidden = true;
        }
    }

    function loadRelatedTopics(title) {
        if (!relatedTopics || !relatedList) return;
        const requestId = ++relatedRequestId;
        relatedTopics.hidden = true;
        relatedList.innerHTML = '';

        const api = 'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
            '&generator=search&gsrnamespace=0&gsrlimit=12' +
            '&gsrsearch=' + encodeURIComponent('morelike:' + title);
        const META = /^(List|Lists|Outline|Index|Glossary|Bibliography|Timeline) of |\(disambiguation\)/i;

        fetch(api)
            .then(res => res.ok ? res.json() : Promise.reject(new Error(`status ${res.status}`)))
            .then(data => {
                if (requestId !== relatedRequestId) return;
                const pages = Object.values((data.query && data.query.pages) || {});
                pages.sort((a, b) => (a.index || 0) - (b.index || 0));
                const titles = pages.map(p => p.title)
                    .filter(t => t && t.toLowerCase() !== title.toLowerCase() && !META.test(t))
                    .slice(0, 6);
                renderRelatedTopics(titles);
            })
            .catch(error => {
                if (requestId !== relatedRequestId) return;
                console.error('Error loading related topics:', error);
                relatedTopics.hidden = true;
            });
    }

    function renderRelatedTopics(titles) {
        relatedList.innerHTML = '';
        if (!titles.length) { relatedTopics.hidden = true; return; }
        titles.forEach(title => {
            const chip = document.createElement('button');
            chip.className = 'related-chip';
            chip.textContent = title;
            chip.addEventListener('click', () => { if (!isLoading) goToArticle(title, 'related', { mode: 'push' }); });
            relatedList.appendChild(chip);
        });
        relatedTopics.hidden = false;
    }

    function clearArticleExtras() {
        articleState = null;
        stopListening();
        updateLevelToggleUI('standard');
        if (articleHero) articleHero.hidden = true;
        if (relatedTopics) relatedTopics.hidden = true;
        if (noteDisplay) noteDisplay.hidden = true;
    }

    // ===== Reading level (Simple English) =====
    function toggleReadingLevel() {
        if (!articleState) return;
        if (articleState.level === 'simple') {
            setArticleBody(articleState.extractHtml, articleState.standardExtract, 'standard');
            return;
        }
        if (articleState.simpleHtml) {
            setArticleBody(articleState.simpleHtml, articleState.simpleExtract, 'simple');
            return;
        }
        const title = articleState.title;
        if (simpleToggle) simpleToggle.disabled = true;
        fetch(`https://simple.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
            .then(res => res.ok ? res.json() : Promise.reject(new Error('no simple version')))
            .then(data => {
                if (!data.extract_html) throw new Error('no simple version');
                if (!articleState || articleState.title !== title) return;
                articleState.simpleHtml = data.extract_html;
                articleState.simpleExtract = data.extract || '';
                setArticleBody(data.extract_html, articleState.simpleExtract, 'simple');
            })
            .catch(() => { if (articleState && articleState.title === title) showLevelUnavailable(); })
            .finally(() => { if (simpleToggle) simpleToggle.disabled = false; });
    }

    function setArticleBody(html, plaintext, level) {
        stopListening();
        articleContent.innerHTML = html;
        progressBar.style.width = '0';
        if (articleState) { articleState.extract = plaintext; articleState.level = level; }
        updateLevelToggleUI(level);
        generateTableOfContents();
    }

    function updateLevelToggleUI(level) {
        if (!simpleToggle) return;
        const simple = level === 'simple';
        simpleToggle.textContent = simple ? 'Standard' : 'Simpler';
        simpleToggle.setAttribute('aria-pressed', simple ? 'true' : 'false');
        simpleToggle.setAttribute('aria-label', simple ? 'Show the standard explanation' : 'Show a simpler explanation');
    }

    function showLevelUnavailable() {
        if (!simpleToggle) return;
        const original = simpleToggle.textContent;
        simpleToggle.textContent = 'No simple version';
        setTimeout(() => { simpleToggle.textContent = original; }, 1800);
    }

    // ===== Read-aloud =====
    function toggleListen() {
        if (!('speechSynthesis' in window)) return;
        if (isSpeaking) { stopListening(); return; }
        const text = (articleState && articleState.extract) || articleContent.textContent || '';
        if (!text.trim()) return;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.onend = stopListening;
        utterance.onerror = stopListening;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);

        // Chrome stops long utterances after ~15s without this nudge
        if (speakKeepAlive) clearInterval(speakKeepAlive);
        speakKeepAlive = setInterval(() => {
            if (!window.speechSynthesis.speaking) { clearInterval(speakKeepAlive); speakKeepAlive = null; return; }
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
        }, 12000);

        isSpeaking = true;
        if (listenBtn) {
            listenBtn.classList.add('active');
            const icon = listenBtn.querySelector('i');
            if (icon) icon.className = 'fas fa-stop';
            listenBtn.setAttribute('aria-label', 'Stop listening');
        }
    }

    function stopListening() {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        if (speakKeepAlive) { clearInterval(speakKeepAlive); speakKeepAlive = null; }
        isSpeaking = false;
        if (listenBtn) {
            listenBtn.classList.remove('active');
            const icon = listenBtn.querySelector('i');
            if (icon) icon.className = 'fas fa-volume-up';
            listenBtn.setAttribute('aria-label', 'Listen to this article');
        }
    }

    // ===== Table of contents =====
    function generateTableOfContents() {
        const headings = articleContent.querySelectorAll('h2, h3, h4');
        if (headings.length === 0) { wikiToc.style.display = 'none'; return; }

        const tocList = document.createElement('ol');
        let currentLevel = 0;
        let currentList = tocList;
        let lists = [tocList];

        headings.forEach((heading, index) => {
            const level = parseInt(heading.tagName.charAt(1));
            if (!heading.id) heading.id = `section-${index}`;
            const item = document.createElement('li');
            const link = document.createElement('a');
            link.href = `#${heading.id}`;
            link.textContent = heading.textContent;
            item.appendChild(link);

            if (level > currentLevel) {
                const nestedList = document.createElement('ol');
                (lists[currentLevel] && lists[currentLevel].lastElementChild
                    ? lists[currentLevel].lastElementChild
                    : tocList).appendChild(nestedList);
                lists.push(nestedList);
                currentList = nestedList;
                currentLevel = level;
            } else if (level < currentLevel) {
                const levelsUp = currentLevel - level;
                lists = lists.slice(0, Math.max(1, lists.length - levelsUp));
                currentList = lists[lists.length - 1];
                currentLevel = level;
            }
            currentList.appendChild(item);
        });

        const existing = wikiToc.querySelector('ol');
        if (existing) existing.replaceWith(tocList);
        else wikiToc.appendChild(tocList);
        wikiToc.style.display = 'block';
        if (tocToggle) tocToggle.textContent = '[hide]';
    }

    // ===== Theme =====
    function toggleTheme() {
        const html = document.documentElement;
        const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        applyThemeToToggle(newTheme);
        localStorage.setItem(LS.theme, newTheme);
    }

    function applyThemeToToggle(theme) {
        const icon = themeToggle.querySelector('i');
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }

    function loadSettings() {
        // The inline <head> script already set data-theme (saved pref or OS preference).
        applyThemeToToggle(document.documentElement.getAttribute('data-theme') || 'light');
        // If the user has no saved preference, keep following the OS.
        if (!localStorage.getItem(LS.theme) && window.matchMedia) {
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            if (mq.addEventListener) {
                mq.addEventListener('change', (e) => {
                    if (localStorage.getItem(LS.theme)) return;
                    const t = e.matches ? 'dark' : 'light';
                    document.documentElement.setAttribute('data-theme', t);
                    applyThemeToToggle(t);
                });
            }
        }
    }

    // ===== Bookmarks / reading list =====
    function toggleBookmark() {
        if (!currentArticle) return;
        if (isArticleBookmarked(currentArticle.topic)) {
            bookmarks = bookmarks.filter(b => b.topic !== currentArticle.topic);
            bookmarkBtn.querySelector('i').className = 'far fa-bookmark';
        } else {
            bookmarks.push({ ...currentArticle, read: false });
            bookmarkBtn.querySelector('i').className = 'fas fa-bookmark';
            bookmarksPanel.classList.add('open');
        }
        saveBookmarks();
        renderBookmarksList();
    }

    function isArticleBookmarked(topic) {
        return bookmarks.some(b => b.topic === topic);
    }

    function updateBookmarkButtonState() {
        const bookmarked = currentArticle && isArticleBookmarked(currentArticle.topic);
        bookmarkBtn.querySelector('i').className = bookmarked ? 'fas fa-bookmark' : 'far fa-bookmark';
    }

    function saveBookmarks() {
        localStorage.setItem(LS.bookmarks, JSON.stringify(bookmarks));
    }

    function loadBookmarks() {
        const saved = localStorage.getItem(LS.bookmarks);
        if (saved) {
            try { bookmarks = JSON.parse(saved) || []; } catch (e) { bookmarks = []; }
            renderBookmarksList();
        }
    }

    function renderBookmarksList() {
        bookmarksList.innerHTML = '';
        const bookmarksCount = document.getElementById('bookmarks-count');
        if (bookmarksCount) bookmarksCount.textContent = bookmarks.length;

        if (bookmarks.length === 0) {
            if (readingProgress) readingProgress.hidden = true;
            bookmarksList.innerHTML = '<div class="empty-bookmarks">No saved topics yet. Bookmark anything interesting to build a reading list you can come back to.</div>';
            return;
        }

        // Reading progress
        const readCount = bookmarks.filter(b => b.read).length;
        if (readingProgress) {
            readingProgress.hidden = false;
            if (readingProgressText) readingProgressText.textContent = `${readCount} of ${bookmarks.length} read`;
            if (readingProgressFill) readingProgressFill.style.width = `${Math.round((readCount / bookmarks.length) * 100)}%`;
        }

        // Unread first, then newest first
        const ordered = [...bookmarks].sort((a, b) => {
            if (!!a.read !== !!b.read) return a.read ? 1 : -1;
            return String(b.timestamp || '').localeCompare(String(a.timestamp || ''));
        });

        ordered.forEach(bookmark => {
            const item = document.createElement('div');
            item.className = 'bookmark-item' + (bookmark.read ? ' is-read' : '');
            item.dataset.topic = bookmark.topic;

            const body = document.createElement('div');
            body.className = 'bookmark-item-body';
            const title = document.createElement('h4');
            title.textContent = bookmark.title;
            if (notes[bookmark.topic] && notes[bookmark.topic].trim()) {
                const dot = document.createElement('span');
                dot.className = 'note-dot';
                dot.title = 'Has a note';
                dot.textContent = ' •';
                title.appendChild(dot);
            }
            const category = document.createElement('p');
            category.textContent = bookmark.category ? prettyCategory(bookmark.category) : 'General';
            body.appendChild(title);
            body.appendChild(category);
            body.addEventListener('click', () => {
                if (!isLoading) goToArticle(bookmark.topic, 'bookmark', { mode: 'push' });
                bookmarksPanel.classList.remove('open');
            });

            const actions = document.createElement('div');
            actions.className = 'bookmark-item-actions';
            const readBtn = document.createElement('button');
            readBtn.className = 'bm-action read-toggle';
            readBtn.title = bookmark.read ? 'Mark as unread' : 'Mark as read';
            readBtn.setAttribute('aria-label', readBtn.title);
            readBtn.innerHTML = bookmark.read ? '<i class="fas fa-check-circle"></i>' : '<i class="far fa-circle"></i>';
            readBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const target = bookmarks.find(b => b.topic === bookmark.topic);
                if (target) { target.read = !target.read; saveBookmarks(); renderBookmarksList(); }
            });
            const delBtn = document.createElement('button');
            delBtn.className = 'bm-action delete';
            delBtn.title = 'Remove from list';
            delBtn.setAttribute('aria-label', 'Remove from list');
            delBtn.innerHTML = '<i class="fas fa-times"></i>';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                bookmarks = bookmarks.filter(b => b.topic !== bookmark.topic);
                saveBookmarks(); renderBookmarksList();
                if (currentArticle && currentArticle.topic === bookmark.topic) updateBookmarkButtonState();
            });
            actions.appendChild(readBtn);
            actions.appendChild(delBtn);

            item.appendChild(body);
            item.appendChild(actions);
            bookmarksList.appendChild(item);
        });
    }

    // ===== Notes =====
    function currentTopic() { return currentArticle && currentArticle.topic; }

    function loadNotes() {
        const saved = localStorage.getItem(LS.notes);
        if (saved) { try { notes = JSON.parse(saved) || {}; } catch (e) { notes = {}; } }
    }
    function saveNotes() { localStorage.setItem(LS.notes, JSON.stringify(notes)); }

    function openNoteEditor() {
        const t = currentTopic();
        if (!t || !noteEditor) return;
        noteText.value = notes[t] || '';
        noteEditor.hidden = false;
        if (noteDisplay) noteDisplay.hidden = true;
        noteText.focus();
    }
    function closeNoteEditor() { if (noteEditor) noteEditor.hidden = true; }

    function saveCurrentNote() {
        const t = currentTopic();
        if (!t) return;
        const v = noteText.value.trim();
        if (v) notes[t] = v; else delete notes[t];
        saveNotes();
        closeNoteEditor();
        updateNoteUI(t);
        renderBookmarksList();
    }
    function deleteCurrentNote() {
        const t = currentTopic();
        if (!t) return;
        delete notes[t];
        saveNotes();
        if (noteText) noteText.value = '';
        closeNoteEditor();
        updateNoteUI(t);
        renderBookmarksList();
    }

    function updateNoteUI(topic) {
        const has = !!(topic && notes[topic] && notes[topic].trim());
        if (noteBtn) {
            noteBtn.classList.toggle('has-note', has);
            noteBtn.title = has ? 'Edit your note' : 'Add a note';
            noteBtn.setAttribute('aria-label', noteBtn.title);
        }
        if (noteDisplay) {
            if (has) {
                noteDisplay.hidden = false;
                noteDisplay.innerHTML = '';
                const icon = document.createElement('i');
                icon.className = 'fas fa-pen';
                icon.setAttribute('aria-hidden', 'true');
                const span = document.createElement('span');
                span.textContent = ' ' + notes[topic];
                noteDisplay.appendChild(icon);
                noteDisplay.appendChild(span);
                noteDisplay.style.cursor = 'pointer';
                noteDisplay.onclick = openNoteEditor;
            } else {
                noteDisplay.hidden = true;
            }
        }
    }

    // ===== Share =====
    function shareArticle() {
        if (!currentArticle) return;
        const url = new URL(window.location.href);
        url.searchParams.delete('path');
        url.searchParams.set('topic', currentArticle.topic);
        const shareData = {
            title: currentArticle.title,
            text: `I just learned about ${currentArticle.title} on Curiosity Engine`,
            url: url.toString()
        };
        if (navigator.share) {
            navigator.share(shareData).catch(() => {});
        } else {
            copyToClipboard(url.toString());
        }
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(showCopyTooltip)
                .catch(() => fallbackCopy(text));
        } else {
            fallbackCopy(text);
        }
    }
    function fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); showCopyTooltip(); } catch (e) { /* ignore */ }
        document.body.removeChild(ta);
    }
    function showCopyTooltip() {
        if (!copyTooltip) return;
        copyTooltip.classList.add('show');
        setTimeout(() => copyTooltip.classList.remove('show'), 2000);
    }

    // ===== History =====
    function addToHistory(article) {
        let history = JSON.parse(localStorage.getItem(LS.history) || '[]');
        history = history.filter(item => item.topic !== article.topic);
        history.unshift({ title: article.title, topic: article.topic, category: article.category });
        history = history.slice(0, MAX_HISTORY_ITEMS);
        localStorage.setItem(LS.history, JSON.stringify(history));
        renderHistoryList(history);
    }
    function loadHistory() {
        const history = JSON.parse(localStorage.getItem(LS.history) || '[]');
        renderHistoryList(history);
    }
    function renderHistoryList(history) {
        historyList.innerHTML = '';
        if (history.length === 0) { historyContainer.style.display = 'none'; return; }
        historyContainer.style.display = 'block';
        history.forEach(item => {
            const el = document.createElement('button');
            el.className = 'history-item';
            el.textContent = item.title;
            el.dataset.topic = item.topic;
            el.addEventListener('click', () => { if (!isLoading) goToArticle(item.topic, 'history', { mode: 'push' }); });
            historyList.appendChild(el);
        });
    }

    // ===== Explored counter + milestones =====
    function loadExplored() {
        const saved = localStorage.getItem(LS.explored);
        if (saved) { try { exploredTopics = new Set(JSON.parse(saved)); } catch (e) { exploredTopics = new Set(); } }
        updateExploredCount();
    }
    function markExplored(topic) {
        if (!topic) return;
        const before = exploredTopics.size;
        exploredTopics.add(topic);
        if (exploredTopics.size !== before) {
            localStorage.setItem(LS.explored, JSON.stringify([...exploredTopics]));
            updateExploredCount();
            if (MILESTONES.includes(exploredTopics.size)) showMilestone(exploredTopics.size);
        }
    }
    function updateExploredCount() {
        if (exploredCount) exploredCount.textContent = exploredTopics.size;
    }

    // ===== Streak =====
    function dateKey(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function updateStreak() {
        let data;
        try { data = JSON.parse(localStorage.getItem(LS.streak) || 'null'); } catch (e) { data = null; }
        if (!data) data = { count: 0, last: null, best: 0 };

        const today = dateKey(new Date());
        if (data.last !== today) {
            const y = new Date(); y.setDate(y.getDate() - 1);
            data.count = (data.last === dateKey(y)) ? (data.count + 1) : 1;
            data.last = today;
            data.best = Math.max(data.best || 0, data.count);
            localStorage.setItem(LS.streak, JSON.stringify(data));
        }
        if (streakCountEl) streakCountEl.textContent = data.count;
        if (streakStat) {
            streakStat.hidden = data.count < 1;
            streakStat.title = `Day streak — best: ${data.best || data.count}. Visit daily to keep it alive.`;
        }
    }

    // ===== Daily topic =====
    function hashStr(s) {
        let h = 0;
        for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
        return h;
    }
    function setupDailyTopic() {
        if (!allTopics.length || !dailyChip) return;
        const pool = allTopics.filter(t => t.tier === 'mainstream');
        const usePool = pool.length ? pool : allTopics;
        const idx = hashStr(dateKey(new Date())) % usePool.length;
        dailyTopic = usePool[idx].topic;
        if (dailyTopicName) dailyTopicName.textContent = dailyTopic;
        dailyChip.hidden = false;
    }

    // ===== Trail (rabbit hole) =====
    function pushTrail(topic, title, source) {
        if (KEEP_TRAIL.has(source)) {
            // Don't restructure — just keep the title fresh if it matches the tail
            if (trail.length && trail[trail.length - 1].topic === topic) trail[trail.length - 1].title = title;
            else if (!trail.some(s => s.topic === topic)) trail.push({ topic, title });
        } else if (source === 'related') {
            if (!trail.length || trail[trail.length - 1].topic !== topic) trail.push({ topic, title });
            else trail[trail.length - 1].title = title;
        } else {
            // random / shared / daily / bookmark / history → start a fresh trail
            trail = [{ topic, title }];
        }
        if (trail.length > 25) trail = trail.slice(-25);
        saveTrail();
        renderTrail();
    }

    function renderTrail() {
        if (!trailEl || !trailListEl) return;
        if (trail.length < 2) { trailEl.hidden = true; return; }
        trailListEl.innerHTML = '';
        trail.forEach((stop, i) => {
            if (i > 0) {
                const sep = document.createElement('span');
                sep.className = 'trail-sep';
                sep.textContent = '›';
                trailListEl.appendChild(sep);
            }
            const isLast = i === trail.length - 1;
            const el = document.createElement(isLast ? 'span' : 'button');
            el.className = 'trail-item' + (isLast ? ' current' : '');
            el.textContent = stop.title || stop.topic;
            if (!isLast) el.addEventListener('click', () => trailJumpTo(i));
            trailListEl.appendChild(el);
        });
        trailEl.hidden = false;
    }

    function trailJumpTo(i) {
        if (isLoading || i < 0 || i >= trail.length) return;
        const stop = trail[i];
        trail = trail.slice(0, i + 1);
        saveTrail();
        goToArticle(stop.topic, 'trailjump', { mode: 'push' });
    }

    function saveTrail() {
        try { localStorage.setItem(LS.trail, JSON.stringify(trail)); } catch (e) { /* ignore */ }
    }

    function setupResume() {
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(LS.trail) || 'null'); } catch (e) { saved = null; }
        const params = new URLSearchParams(window.location.search);
        if (saved && saved.length > 1 && !params.get('topic') && !params.get('path') && resumeChip) {
            const last = saved[saved.length - 1];
            if (resumeText) resumeText.textContent = `Resume your trail (${saved.length} stops)`;
            resumeChip.dataset.topic = last.topic;
            resumeChip._trail = saved;
            resumeChip.hidden = false;
        }
    }

    function resumeTrail() {
        if (!resumeChip || !resumeChip._trail) return;
        trail = resumeChip._trail;
        resumeChip.hidden = true;
        renderTrail();
        const last = trail[trail.length - 1];
        goToArticle(last.topic, 'resume', { mode: 'push' });
    }

    function shareTrail() {
        if (!trail.length) return;
        const path = trail.map(s => encodeURIComponent(s.topic)).join(',');
        const url = window.location.origin + window.location.pathname + '?path=' + path;
        if (navigator.share) {
            navigator.share({ title: 'My Curiosity Engine trail', text: 'Follow my rabbit hole:', url }).catch(() => {});
        } else {
            copyToClipboard(url);
        }
    }

    function loadTrailFromPath(path) {
        const topics = path.split(',').map(s => { try { return decodeURIComponent(s); } catch (e) { return s; } }).filter(Boolean);
        if (!topics.length) { loadRandomArticle({ mode: 'replace' }); return; }
        trail = topics.map(t => ({ topic: t, title: t }));
        renderTrail();
        goToArticle(topics[topics.length - 1], 'pathload', { mode: 'replace' });
    }

    // ===== Intro =====
    function maybeShowIntro() {
        const seen = localStorage.getItem(LS.seenIntro);
        if (seen) {
            if (introEl) introEl.hidden = true;
            if (kbdHint) kbdHint.hidden = true;
        } else {
            if (introEl) introEl.hidden = false;
            if (kbdHint) kbdHint.hidden = false;
        }
    }
    function markIntroSeen() {
        if (localStorage.getItem(LS.seenIntro)) return;
        localStorage.setItem(LS.seenIntro, '1');
        if (introEl) introEl.hidden = true;
        if (kbdHint) kbdHint.hidden = true;
    }

    // ===== Milestone toast =====
    function showMilestone(n) {
        if (!toast) return;
        if (toastText) toastText.textContent = `🎉 ${n} topics explored! Keep the curiosity going.`;
        toast.hidden = false;
        toast.classList.add('show');
        if (toastShare) {
            toastShare.onclick = () => {
                const shareData = {
                    title: 'Curiosity Engine',
                    text: `I've explored ${n} topics on Curiosity Engine — come follow your curiosity!`,
                    url: window.location.origin + window.location.pathname
                };
                if (navigator.share) navigator.share(shareData).catch(() => {});
                else copyToClipboard(shareData.url);
            };
        }
        clearTimeout(showMilestone._t);
        showMilestone._t = setTimeout(hideToast, 8000);
    }
    function hideToast() {
        if (!toast) return;
        toast.classList.remove('show');
        setTimeout(() => { toast.hidden = true; }, 300);
    }

    // ===== Reading progress (whole page) =====
    function updateProgressBar() {
        const doc = document.documentElement;
        const total = doc.scrollHeight - doc.clientHeight;
        if (total <= 0) { progressBar.style.width = '0'; return; }
        const progress = (window.scrollY / total) * 100;
        progressBar.style.width = `${Math.min(progress, 100)}%`;
    }
});
