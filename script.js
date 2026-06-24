document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
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

    // Store all topics from CSV
    let allTopics = [];

    // Store topics by category
    const topicsByCategory = {
        Science: [],
        Physics: [],
        Chemistry: [],
        Biology: [],
        Astronomy: [],
        Mathematics: [],
        Computer_science: [],
        Earth_science: []
    };

    // Track viewed topics to minimize repeats
    const viewedTopics = new Set();
    const MAX_VIEWED_TOPICS = 50;
    const MAX_HISTORY_ITEMS = 5;

    // Which area random "Discover" draws from ('Science' = all areas)
    let topicFilter = 'Science';

    // Unique topics the user has ever opened (persisted; powers the Explored count)
    let exploredTopics = new Set();

    // Prevent overlapping requests
    let isLoading = false;

    // Saved bookmarks and the article currently on screen
    let bookmarks = [];
    let currentArticle = null;

    // Video sidebar state (latest request wins; tracks the playing card)
    let videoRequestId = 0;
    let activeVideoCard = null;

    // Related-topics and read-aloud state
    let relatedRequestId = 0;
    let isSpeaking = false;

    // Working copy of the on-screen article body (kept out of currentArticle so
    // bookmarks/history stay lean); powers the reading-level toggle and read-aloud
    let articleState = null;

    // Initialize: load the topic list, then the shared or a random article
    loadTopicsFromCSV().then(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const sharedTopic = urlParams.get('topic');

        if (sharedTopic) {
            loadSpecificArticle(decodeURIComponent(sharedTopic));
        } else {
            loadRandomArticle();
        }
    });

    // Load persisted state
    loadSettings();
    loadBookmarks();
    loadHistory();
    loadExplored();
    if (categorySelect) categorySelect.value = topicFilter;

    // Event listeners
    newTopicBtn.addEventListener('click', () => {
        if (!isLoading) loadRandomArticle();
    });

    themeToggle.addEventListener('click', toggleTheme);
    bookmarkBtn.addEventListener('click', toggleBookmark);
    shareBtn.addEventListener('click', shareArticle);

    if (simpleToggle) simpleToggle.addEventListener('click', toggleReadingLevel);
    if (listenBtn) {
        if ('speechSynthesis' in window) {
            listenBtn.addEventListener('click', toggleListen);
        } else {
            listenBtn.style.display = 'none'; // browser has no speech synthesis
        }
    }

    closeBookmarks.addEventListener('click', () => {
        bookmarksPanel.classList.remove('open');
    });

    if (bookmarksStat) {
        bookmarksStat.addEventListener('click', () => {
            bookmarksPanel.classList.toggle('open');
        });
    }

    if (categorySelect) {
        categorySelect.addEventListener('change', () => {
            topicFilter = categorySelect.value;
            if (!isLoading) loadRandomArticle();
        });
    }

    // Keyboard navigation: ArrowRight or "n" jumps to the next topic
    document.addEventListener('keydown', (e) => {
        const tag = (e.target && e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') {
            e.preventDefault();
            if (!isLoading) loadRandomArticle();
        }
    });

    // Update reading progress as the article scrolls
    articleContent.addEventListener('scroll', updateProgressBar);

    // Load topics from the bundled CSV file
    async function loadTopicsFromCSV() {
        try {
            const response = await fetch('science_topics.csv');
            if (!response.ok) {
                throw new Error(`Failed to load CSV: ${response.status}`);
            }

            const csvText = await response.text();
            const lines = csvText.split('\n');

            // Skip the header row
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line) {
                    const [category, topic] = line.split(',');

                    if (category && topic && topicsByCategory[category]) {
                        topicsByCategory[category].push(topic);
                        allTopics.push({ category, topic });
                    }
                }
            }

            console.log(`Loaded ${allTopics.length} topics from CSV`);
        } catch (error) {
            console.error('Error loading topics from CSV:', error);
            // Fall back to a small hardcoded set if the CSV cannot be fetched
            // (e.g. when opened directly via file:// instead of through a server)
            setupFallbackTopics();
        }
    }

    // Minimal topic set used only if the CSV fails to load
    function setupFallbackTopics() {
        const fallbackTopics = [
            { category: 'Science', topic: 'Scientific method' },
            { category: 'Physics', topic: 'Quantum mechanics' },
            { category: 'Chemistry', topic: 'Periodic table' },
            { category: 'Biology', topic: 'Evolution' },
            { category: 'Astronomy', topic: 'Black hole' },
            { category: 'Mathematics', topic: 'Calculus' },
            { category: 'Computer_science', topic: 'Algorithm' },
            { category: 'Earth_science', topic: 'Geology' }
        ];

        allTopics = fallbackTopics;
        fallbackTopics.forEach(({ category, topic }) => {
            if (topicsByCategory[category]) {
                topicsByCategory[category].push(topic);
            }
        });
    }

    // Load a random article from Wikipedia
    async function loadRandomArticle() {
        if (isLoading) return;
        isLoading = true;

        // Preserve the current height to avoid layout shift while loading
        const currentHeight = articleContent.offsetHeight;
        if (currentHeight > 0) {
            articleContent.style.minHeight = `${currentHeight}px`;
        }

        // Reset UI
        articleTitle.textContent = 'Loading article…';
        articleContent.innerHTML = '<div class="loading-spinner" aria-label="Loading"></div>';
        wikiToc.style.display = 'none';
        categoryLink.textContent = topicFilter === 'Science' ? 'Science' : topicFilter.replace('_', ' ');

        try {
            const topic = getRandomTopic(topicFilter);
            if (!topic) {
                throw new Error(`No topics available for area: ${topicFilter}`);
            }

            markTopicAsViewed(topic);

            const wikiData = await fetchWikipediaArticle(topic);
            if (!wikiData || !wikiData.title || !wikiData.extract_html) {
                throw new Error('Failed to fetch Wikipedia article or received invalid data');
            }

            updateUIWithArticleData(wikiData, topic, identifyCategory(topic));
        } catch (error) {
            console.error('Error loading content:', error);
            showArticleError("Couldn't load this article. Tap “Discover new topic” to try another, or check your connection.");
            updateYouTubeSearchLink('science');
            resetVideoSidebar();
            clearArticleExtras();
            currentArticle = null;
            updateBookmarkButtonState();
        } finally {
            isLoading = false;
        }
    }

    // Load one specific article by topic (used by shares, bookmarks, history)
    async function loadSpecificArticle(topic) {
        if (isLoading) return;
        isLoading = true;

        articleTitle.textContent = 'Loading article…';
        articleContent.innerHTML = '<div class="loading-spinner" aria-label="Loading"></div>';
        wikiToc.style.display = 'none';

        try {
            const wikiData = await fetchWikipediaArticle(topic);
            if (!wikiData || !wikiData.title || !wikiData.extract_html) {
                throw new Error('Failed to fetch Wikipedia article or received invalid data');
            }

            const category = identifyCategory(topic) || 'Science';

            markTopicAsViewed(topic);
            updateUIWithArticleData(wikiData, topic, category);
        } catch (error) {
            console.error('Error loading shared content:', error);
            showArticleError("Couldn't load this article. Tap “Discover new topic” to load a random one instead.");
            updateYouTubeSearchLink('science');
            resetVideoSidebar();
            clearArticleExtras();
            currentArticle = null;
            updateBookmarkButtonState();
        } finally {
            isLoading = false;
        }
    }

    // Render an error state inside the article area
    function showArticleError(message) {
        articleTitle.textContent = 'Error Loading Content';
        articleContent.innerHTML = `<p>${message}</p>`;
        wikiToc.style.display = 'none';
    }

    // Populate the UI from a fetched Wikipedia summary
    function updateUIWithArticleData(wikiData, topic, category) {
        articleTitle.textContent = wikiData.title;
        articleContent.innerHTML = wikiData.extract_html;

        // Reset progress and release the loading min-height
        progressBar.style.width = '0';
        setTimeout(() => {
            articleContent.style.minHeight = '';
        }, 100);

        // Read-more link
        if (wikiData.content_urls && wikiData.content_urls.desktop && wikiData.content_urls.desktop.page) {
            readMore.href = wikiData.content_urls.desktop.page;
        } else {
            readMore.href = `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiData.title)}`;
        }

        currentArticle = {
            title: wikiData.title,
            topic: topic,
            category: category,
            url: readMore.href,
            timestamp: new Date().toISOString()
        };

        updateBookmarkButtonState();
        addToHistory(currentArticle);
        markExplored(topic);
        clearURLParams();

        // Category link
        categoryLink.textContent = category.replace('_', ' ');
        categoryLink.href = `https://en.wikipedia.org/wiki/Category:${category}`;

        // Working copy of the body for the reading-level toggle / read-aloud
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

        generateTableOfContents();
        updateYouTubeSearchLink(wikiData.title);
        loadVideosForTopic(wikiData.title);
        loadRelatedTopics(wikiData.title);
    }

    // Remove the ?topic= parameter once an article is shown
    function clearURLParams() {
        if (window.history.replaceState) {
            const cleanURL = window.location.protocol + '//' + window.location.host + window.location.pathname;
            window.history.replaceState({ path: cleanURL }, '', cleanURL);
        }
    }

    // Find which category a topic belongs to (for display)
    function identifyCategory(topic) {
        for (const category in topicsByCategory) {
            if (topicsByCategory[category].includes(topic)) {
                return category;
            }
        }
        return 'Science';
    }

    // Pick a random topic, avoiding recently viewed ones when possible
    function getRandomTopic(category) {
        const availableTopics = category === 'Science'
            ? allTopics.map(t => t.topic) // All topics when no category filter is active
            : topicsByCategory[category];

        if (!availableTopics || availableTopics.length === 0) {
            return null;
        }

        const unseenTopics = availableTopics.filter(topic => !viewedTopics.has(topic));
        const topicsToChooseFrom = unseenTopics.length > 0 ? unseenTopics : availableTopics;

        const randomIndex = Math.floor(Math.random() * topicsToChooseFrom.length);
        return topicsToChooseFrom[randomIndex];
    }

    // Remember a topic as viewed (bounded set)
    function markTopicAsViewed(topic) {
        viewedTopics.add(topic);
        if (viewedTopics.size > MAX_VIEWED_TOPICS) {
            const iterator = viewedTopics.values();
            viewedTopics.delete(iterator.next().value);
        }
    }

    // Fetch a Wikipedia article summary by title, with a timeout
    async function fetchWikipediaArticle(title) {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out')), 10000)
        );

        try {
            const encodedTitle = encodeURIComponent(title);
            const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`;

            const response = await Promise.race([fetch(apiUrl), timeoutPromise]);
            if (!response.ok) {
                throw new Error(`Wikipedia API returned status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching Wikipedia article:', error);
            throw error;
        }
    }

    // Point the YouTube button at a search for the current topic
    function updateYouTubeSearchLink(title) {
        const encodedSearch = encodeURIComponent(title);
        if (youtubeSearchLink) {
            youtubeSearchLink.href = `https://www.youtube.com/results?search_query=${encodedSearch}`;
        }
    }

    // ===== Topic videos (Dailymotion open API, keyless) with a YouTube fallback =====

    // Fetch and render related videos for the current topic into the sidebar.
    function loadVideosForTopic(title) {
        if (!videoList) return;

        const requestId = ++videoRequestId;
        clearVideoPlayer();
        if (videoTopicLabel) videoTopicLabel.textContent = title;
        videoList.innerHTML = '<div class="video-loading"><div class="loading-spinner" aria-label="Loading videos"></div></div>';

        const fields = 'id,title,duration,thumbnail_360_url,owner.screenname,views_total';
        const url = `https://api.dailymotion.com/videos?search=${encodeURIComponent(title)}` +
            `&fields=${fields}&limit=12&sort=relevance`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        fetch(url, { signal: controller.signal })
            .then(res => {
                clearTimeout(timeout);
                if (!res.ok) throw new Error(`Video API returned status ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (requestId !== videoRequestId) return; // superseded by a newer topic
                const videos = (data.list || []).filter(v => v && v.id);
                renderVideoList(videos, title);
            })
            .catch(error => {
                clearTimeout(timeout);
                if (requestId !== videoRequestId) return;
                console.error('Error loading videos:', error);
                renderVideoFallback(title, 'Could not load videos right now.');
            });
    }

    function renderVideoList(videos, title) {
        videoList.innerHTML = '';

        if (videos.length === 0) {
            renderVideoFallback(title, 'No related videos found.');
            return;
        }

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
        channel.textContent = (video.views_total != null)
            ? `${owner} • ${formatViews(video.views_total)} views`
            : owner;

        meta.appendChild(cardTitle);
        meta.appendChild(channel);

        card.appendChild(thumb);
        card.appendChild(meta);

        const play = () => playVideo(video.id, video.title, card);
        card.addEventListener('click', play);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                play();
            }
        });

        return card;
    }

    // Load the chosen video into the single "now playing" frame at the top
    function playVideo(videoId, title, card) {
        if (!videoPlayer) return;

        const frame = document.createElement('div');
        frame.className = 'video-player-frame';

        const iframe = document.createElement('iframe');
        iframe.src = `https://www.dailymotion.com/embed/video/${encodeURIComponent(videoId)}?autoplay=1`;
        iframe.title = title || 'Video player';
        iframe.allow = 'autoplay; fullscreen; picture-in-picture';
        iframe.allowFullscreen = true;
        frame.appendChild(iframe);

        videoPlayer.innerHTML = '';
        videoPlayer.appendChild(frame);
        videoPlayer.hidden = false;

        if (activeVideoCard) activeVideoCard.classList.remove('active');
        if (card) {
            card.classList.add('active');
            activeVideoCard = card;
        }

        videoPlayer.scrollIntoView({ block: 'nearest' });
    }

    function clearVideoPlayer() {
        if (!videoPlayer) return;
        videoPlayer.innerHTML = '';
        videoPlayer.hidden = true;
        if (activeVideoCard) {
            activeVideoCard.classList.remove('active');
            activeVideoCard = null;
        }
    }

    // Used when there are no results, the fetch fails, or an article fails to load
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
        if (videoList) {
            videoList.innerHTML = '<div class="video-empty"><p>Pick a topic to see related videos.</p></div>';
        }
    }

    function buildMoreOnYouTube(title) {
        const wrap = document.createElement('div');
        wrap.className = 'video-more';
        const link = document.createElement('a');
        link.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'More on YouTube →';
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

    // ===== Hero image, related topics, reading level, and read-aloud =====

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

    // Fetch "more like this" topics from Wikipedia and render them as chips
    function loadRelatedTopics(title) {
        if (!relatedTopics || !relatedList) return;

        const requestId = ++relatedRequestId;
        relatedTopics.hidden = true;
        relatedList.innerHTML = '';

        const api = 'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
            '&generator=search&gsrnamespace=0&gsrlimit=12' +
            '&gsrsearch=' + encodeURIComponent('morelike:' + title);

        // Skip navigation/meta pages — they make weak "keep exploring" chips
        const META = /^(List|Lists|Outline|Index|Glossary|Bibliography|Timeline) of |\(disambiguation\)/i;

        fetch(api)
            .then(res => res.ok ? res.json() : Promise.reject(new Error(`status ${res.status}`)))
            .then(data => {
                if (requestId !== relatedRequestId) return; // superseded by a newer topic
                const pages = Object.values((data.query && data.query.pages) || {});
                pages.sort((a, b) => (a.index || 0) - (b.index || 0));
                const titles = pages
                    .map(p => p.title)
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
        if (!titles.length) {
            relatedTopics.hidden = true;
            return;
        }
        titles.forEach(title => {
            const chip = document.createElement('button');
            chip.className = 'related-chip';
            chip.textContent = title;
            chip.addEventListener('click', () => loadSpecificArticle(title));
            relatedList.appendChild(chip);
        });
        relatedTopics.hidden = false;
    }

    // Hide the hero/related/read-aloud extras (used when an article fails to load)
    function clearArticleExtras() {
        articleState = null;
        stopListening();
        updateLevelToggleUI('standard');
        if (articleHero) articleHero.hidden = true;
        if (relatedTopics) relatedTopics.hidden = true;
    }

    // Toggle between the standard and Simple English versions of the article
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

        // Fetch the Simple English summary on demand
        const title = articleState.title;
        if (simpleToggle) simpleToggle.disabled = true;

        fetch(`https://simple.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
            .then(res => res.ok ? res.json() : Promise.reject(new Error('no simple version')))
            .then(data => {
                if (!data.extract_html) throw new Error('no simple version');
                if (!articleState || articleState.title !== title) return; // navigated away
                articleState.simpleHtml = data.extract_html;
                articleState.simpleExtract = data.extract || '';
                setArticleBody(data.extract_html, articleState.simpleExtract, 'simple');
            })
            .catch(() => {
                if (!articleState || articleState.title !== title) return;
                showLevelUnavailable();
            })
            .finally(() => {
                if (simpleToggle) simpleToggle.disabled = false;
            });
    }

    function setArticleBody(html, plaintext, level) {
        stopListening();
        articleContent.innerHTML = html;
        articleContent.scrollTop = 0;
        progressBar.style.width = '0';
        if (articleState) {
            articleState.extract = plaintext;
            articleState.level = level;
        }
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

    // Read the current article aloud via the browser's speech synthesis
    function toggleListen() {
        if (!('speechSynthesis' in window)) return;

        if (isSpeaking) {
            stopListening();
            return;
        }

        const text = (articleState && articleState.extract) || articleContent.textContent || '';
        if (!text.trim()) return;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.onend = stopListening;
        utterance.onerror = stopListening;

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);

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
        isSpeaking = false;
        if (listenBtn) {
            listenBtn.classList.remove('active');
            const icon = listenBtn.querySelector('i');
            if (icon) icon.className = 'fas fa-volume-up';
            listenBtn.setAttribute('aria-label', 'Listen to this article');
        }
    }

    // Build a table of contents from the article's headings
    function generateTableOfContents() {
        const headings = articleContent.querySelectorAll('h2, h3, h4');

        if (headings.length === 0) {
            wikiToc.style.display = 'none';
            return;
        }

        const tocList = document.createElement('ol');
        let currentLevel = 0;
        let currentList = tocList;
        let lists = [tocList];

        headings.forEach((heading, index) => {
            const level = parseInt(heading.tagName.charAt(1));

            if (!heading.id) {
                heading.id = `section-${index}`;
            }

            const item = document.createElement('li');
            const link = document.createElement('a');
            link.href = `#${heading.id}`;
            link.textContent = heading.textContent;
            item.appendChild(link);

            if (level > currentLevel) {
                const nestedList = document.createElement('ol');
                lists[currentLevel].lastElementChild.appendChild(nestedList);
                lists.push(nestedList);
                currentList = nestedList;
                currentLevel = level;
            } else if (level < currentLevel) {
                const levelsUp = currentLevel - level;
                lists = lists.slice(0, lists.length - levelsUp);
                currentList = lists[lists.length - 1];
                currentLevel = level;
            }

            currentList.appendChild(item);
        });

        wikiToc.querySelector('ol').replaceWith(tocList);
        wikiToc.style.display = 'block';

        const tocToggle = wikiToc.querySelector('.wiki-toc-toggle');
        tocToggle.addEventListener('click', () => {
            const ol = wikiToc.querySelector('ol');
            ol.style.display = ol.style.display === 'none' ? '' : 'none';
            tocToggle.textContent = ol.style.display === 'none' ? '[show]' : '[hide]';
        });
    }

    // Toggle light/dark theme
    function toggleTheme() {
        const html = document.documentElement;
        const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';

        html.setAttribute('data-theme', newTheme);
        applyThemeToToggle(newTheme);
        localStorage.setItem('theme', newTheme);
    }

    // Keep the toggle's icon and label in sync with the active theme
    function applyThemeToToggle(theme) {
        const icon = themeToggle.querySelector('i');
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }

    // Restore the saved theme
    function loadSettings() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            applyThemeToToggle(savedTheme);
        }
    }

    // Add or remove the current article from bookmarks
    function toggleBookmark() {
        if (!currentArticle) return;

        if (isArticleBookmarked(currentArticle.topic)) {
            bookmarks = bookmarks.filter(bookmark => bookmark.topic !== currentArticle.topic);
            bookmarkBtn.querySelector('i').className = 'far fa-bookmark';
        } else {
            bookmarks.push(currentArticle);
            bookmarkBtn.querySelector('i').className = 'fas fa-bookmark';
            bookmarksPanel.classList.add('open');
        }

        saveBookmarks();
        renderBookmarksList();
    }

    function isArticleBookmarked(topic) {
        return bookmarks.some(bookmark => bookmark.topic === topic);
    }

    function updateBookmarkButtonState() {
        const bookmarked = currentArticle && isArticleBookmarked(currentArticle.topic);
        bookmarkBtn.querySelector('i').className = bookmarked ? 'fas fa-bookmark' : 'far fa-bookmark';
    }

    function saveBookmarks() {
        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    }

    function loadBookmarks() {
        const savedBookmarks = localStorage.getItem('bookmarks');
        if (savedBookmarks) {
            bookmarks = JSON.parse(savedBookmarks);
            renderBookmarksList();
        }
    }

    function renderBookmarksList() {
        bookmarksList.innerHTML = '';

        const bookmarksCount = document.getElementById('bookmarks-count');
        if (bookmarksCount) {
            bookmarksCount.textContent = bookmarks.length;
        }

        if (bookmarks.length === 0) {
            bookmarksList.innerHTML = '<div class="empty-bookmarks">No bookmarks yet. Save interesting articles to read later!</div>';
            return;
        }

        bookmarks.forEach(bookmark => {
            const bookmarkItem = document.createElement('div');
            bookmarkItem.className = 'bookmark-item';
            bookmarkItem.dataset.topic = bookmark.topic;

            const title = document.createElement('h4');
            title.textContent = bookmark.title;

            const category = document.createElement('p');
            category.textContent = `Category: ${bookmark.category.replace('_', ' ')}`;

            bookmarkItem.appendChild(title);
            bookmarkItem.appendChild(category);

            bookmarkItem.addEventListener('click', () => {
                loadSpecificArticle(bookmark.topic);
                bookmarksPanel.classList.remove('open');
            });

            bookmarksList.appendChild(bookmarkItem);
        });
    }

    // Copy a shareable link to the current article
    function shareArticle() {
        if (!currentArticle) return;

        const url = new URL(window.location.href);
        url.searchParams.set('topic', currentArticle.topic);

        navigator.clipboard.writeText(url.toString())
            .then(() => {
                copyTooltip.classList.add('show');
                setTimeout(() => copyTooltip.classList.remove('show'), 2000);
            })
            .catch(err => {
                console.error('Failed to copy link: ', err);
                alert('Failed to copy link. Please try again.');
            });
    }

    // Maintain the "recently viewed" list in localStorage
    function addToHistory(article) {
        let history = JSON.parse(localStorage.getItem('history') || '[]');
        history = history.filter(item => item.topic !== article.topic);
        history.unshift(article);
        history = history.slice(0, MAX_HISTORY_ITEMS);
        localStorage.setItem('history', JSON.stringify(history));
        renderHistoryList(history);
    }

    function loadHistory() {
        const history = JSON.parse(localStorage.getItem('history') || '[]');
        renderHistoryList(history);
    }

    // Explored-topics counter (unique topics ever opened)
    function loadExplored() {
        const saved = localStorage.getItem('exploredTopics');
        if (saved) {
            try { exploredTopics = new Set(JSON.parse(saved)); } catch (e) { exploredTopics = new Set(); }
        }
        updateExploredCount();
    }

    function markExplored(topic) {
        if (!topic) return;
        const sizeBefore = exploredTopics.size;
        exploredTopics.add(topic);
        if (exploredTopics.size !== sizeBefore) {
            localStorage.setItem('exploredTopics', JSON.stringify([...exploredTopics]));
            updateExploredCount();
        }
    }

    function updateExploredCount() {
        if (exploredCount) exploredCount.textContent = exploredTopics.size;
    }

    function renderHistoryList(history) {
        historyList.innerHTML = '';

        if (history.length === 0) {
            historyContainer.style.display = 'none';
            return;
        }

        historyContainer.style.display = 'block';

        history.forEach(item => {
            const historyItem = document.createElement('button');
            historyItem.className = 'history-item';
            historyItem.textContent = item.title;
            historyItem.dataset.topic = item.topic;
            historyItem.addEventListener('click', () => loadSpecificArticle(item.topic));
            historyList.appendChild(historyItem);
        });
    }

    // Update the top reading-progress bar as the article scrolls
    function updateProgressBar() {
        const totalHeight = articleContent.scrollHeight - articleContent.clientHeight;
        if (totalHeight <= 0) {
            progressBar.style.width = '0';
            return;
        }
        const progress = (articleContent.scrollTop / totalHeight) * 100;
        progressBar.style.width = `${Math.min(progress, 100)}%`;
    }
});
