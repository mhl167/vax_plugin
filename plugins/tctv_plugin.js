// =============================================================================
// CONFIGURATION & METADATA
// =============================================================================

function getManifest() {
    return JSON.stringify({
        "id": "tctv",
        "name": "TCTV",
        "version": "1.0.0",
        "baseUrl": "https://tctv.pro",
        "iconUrl": "https://tctv.pro/10cam-logo-app-light.jpg",
        "isEnabled": true,
        "type": "VIDEO",
        "layoutType": "HORIZONTAL"
    });
}

function getHomeSections() {
    return JSON.stringify([
        { slug: 'live', title: '🔴 Live', type: 'Grid', path: '' }
    ]);
}

function getPrimaryCategories() {
    return JSON.stringify([
        { name: 'Trực tiếp', slug: 'live' }
    ]);
}

function getFilterConfig() {
    return JSON.stringify({});
}

// =============================================================================
// URL GENERATION
// =============================================================================

var BASE_URL = "https://tctv.pro";

function getUrlList(slug, filtersJson) {
    return BASE_URL + "/";
}

function getUrlSearch(keyword, filtersJson) {
    return BASE_URL + "/";
}

function getUrlDetail(slug) {
    // Nếu slug là URL stream endpoint → trả thẳng để fetch stream_links
    if (slug.indexOf("http") === 0) {
        return slug;
    }
    // Nếu là channel ID → fetch match detail
    return BASE_URL + "/match/" + encodeURIComponent(slug);
}

function getUrlCategories() { return ""; }
function getUrlCountries() { return ""; }
function getUrlYears() { return ""; }

// =============================================================================
// HELPERS
// =============================================================================

function extractIdFromUrl(url) {
    if (!url) return "";
    // Lấy match ID từ URL dạng /match/{id}
    var match = url.match(/\/match\/([^/?&]+)/);
    return match ? decodeURIComponent(match[1]) : "";
}

function findChannelById(groups, channelId) {
    for (var g = 0; g < groups.length; g++) {
        var channels = groups[g].channels || [];
        for (var c = 0; c < channels.length; c++) {
            if (String(channels[c].id) === String(channelId)) {
                return channels[c];
            }
        }
    }
    return null;
}

// =============================================================================
// PARSERS
// =============================================================================

function parseListResponse(apiResponseJson) {
    try {
        var response = JSON.parse(apiResponseJson);
        var groups = response.groups || [];
        var allItems = [];
        var seenIds = {};

        groups.forEach(function (group) {
            var channels = group.channels || [];
            channels.forEach(function (channel) {
                // Loại bỏ trùng lặp theo ID
                if (seenIds[channel.id]) return;
                seenIds[channel.id] = true;

                allItems.push({
                    id: String(channel.id),
                    title: channel.name,
                    posterUrl: channel.image ? channel.image.url : "",
                    backdropUrl: channel.image ? channel.image.url : "",
                    year: 0,
                    quality: "LIVE",
                    episode_current: channel.labels && channel.labels.length > 0 ? channel.labels[0].text : "Live",
                    lang: channel.org_metadata ? (channel.org_metadata.league || "") : ""
                });
            });
        });

        return JSON.stringify({
            items: allItems,
            pagination: { currentPage: 1, totalPages: 1, totalItems: allItems.length, itemsPerPage: 100 }
        });
    } catch (error) {
        return JSON.stringify({ items: [], pagination: { currentPage: 1, totalPages: 1 } });
    }
}

function parseSearchResponse(apiResponseJson) {
    return parseListResponse(apiResponseJson);
}

function parseMovieDetail(apiResponseJson, apiUrl) {
    try {
        // apiResponseJson = response từ /match/{id} → chứa sources
        var response = JSON.parse(apiResponseJson);
        var channelId = extractIdFromUrl(apiUrl);

        // Response từ /match/{id} trả về { sources: [...] }
        var sources = response.sources || [];

        // Build servers + episodes
        var servers = [];
        sources.forEach(function (source) {
            var episodes = [];
            var contents = source.contents || [];
            contents.forEach(function (content) {
                var streams = content.streams || [];
                streams.forEach(function (stream) {
                    // Kiểm tra nếu stream có stream_links trực tiếp (fallback)
                    if (stream.stream_links && stream.stream_links.length > 0) {
                        stream.stream_links.forEach(function (link) {
                            episodes.push({
                                id: link.url,
                                name: (stream.name || link.name || "Link"),
                                slug: link.id || "stream"
                            });
                        });
                    }
                    // Nếu stream có remote_data.url → episode ID = URL stream endpoint
                    else if (stream.remote_data && stream.remote_data.url) {
                        episodes.push({
                            id: stream.remote_data.url,
                            name: stream.name || "Server " + (stream.id || ""),
                            slug: stream.id || "stream"
                        });
                    }
                });
            });
            if (episodes.length > 0) {
                servers.push({ name: source.name || "Live Source", episodes: episodes });
            }
        });

        var title = channelId || "Live";
        var description = "Trực tiếp thể thao - TCTV";

        return JSON.stringify({
            id: channelId,
            title: title,
            originName: "",
            posterUrl: "",
            backdropUrl: "",
            description: description,
            year: 0,
            rating: 0,
            quality: "LIVE",
            servers: servers,
            episode_current: "Live",
            lang: "Việt",
            category: "Thể thao trực tiếp",
            country: "Việt",
            director: "TCTV",
            casts: ""
        });
    } catch (error) {
        return "null";
    }
}

// parseDetailResponse: nhận response từ stream endpoint
// Trả về link m3u8 để play
function parseDetailResponse(apiResponseJson, apiUrl) {
    try {
        var response = JSON.parse(apiResponseJson);

        // Response từ /stream/{id}/{streamId} → { stream_links: [{url: "...m3u8"}] }
        var streamLinks = response.stream_links || [];
        if (streamLinks.length > 0) {
            return JSON.stringify({
                url: streamLinks[0].url,
                headers: { "User-Agent": "Mozilla/5.0", "Referer": BASE_URL + "/" },
                subtitles: []
            });
        }

        // Fallback: apiUrl chính là link m3u8
        return JSON.stringify({
            url: apiUrl,
            headers: { "User-Agent": "Mozilla/5.0", "Referer": BASE_URL + "/" },
            subtitles: []
        });
    } catch (error) {
        return JSON.stringify({
            url: apiUrl,
            headers: { "User-Agent": "Mozilla/5.0", "Referer": BASE_URL + "/" },
            subtitles: []
        });
    }
}

function parseCategoriesResponse(apiResponseJson) {
    return JSON.stringify([{ name: 'Trực tiếp', slug: 'live' }]);
}

function parseCountriesResponse(apiResponseJson) { return "[]"; }
function parseYearsResponse(apiResponseJson) { return "[]"; }
