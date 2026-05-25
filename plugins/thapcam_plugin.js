// =============================================================================
// CONFIGURATION & METADATA
// =============================================================================

function getManifest() {
    return JSON.stringify({
        "id": "thapcam",
        "name": "Thập Cẩm",
        "version": "1.0.3",
        "baseUrl": "https://pub-26bab83910ab4b5781549d12d2f0ef6f.r2.dev",
        "iconUrl": "https://tctv.pro/10cam-logo-app-light.jpg",
        "isEnabled": true,
        "type": "VIDEO",
        "layoutType": "HORIZONTAL"
    });
}

function getHomeSections() {
    return JSON.stringify([
        { slug: 'live', title: '🔴 Live', type: 'Grid', path: 'thapcam.json' }
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

var R2_URL = "https://pub-26bab83910ab4b5781549d12d2f0ef6f.r2.dev/thapcam.json";

function getUrlList(slug, filtersJson) {
    return R2_URL;
}

function getUrlSearch(keyword, filtersJson) {
    return R2_URL;
}

function getUrlDetail(slug) {
    // Nếu slug là URL m3u8 → trả thẳng cho ExoPlayer
    if (slug.indexOf("http") === 0) {
        return slug;
    }
    // Nếu là channel ID → fetch R2 JSON với ?id= để parseMovieDetail tách được
    return R2_URL + "?id=" + encodeURIComponent(slug);
}

function getUrlCategories() { return ""; }
function getUrlCountries() { return ""; }
function getUrlYears() { return ""; }

// =============================================================================
// HELPERS
// =============================================================================

function extractIdFromUrl(url) {
    if (!url) return "";
    var match = url.match(/[?&]id=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : "";
}

function findChannelById(jsonStr, channelId) {
    try {
        var response = JSON.parse(jsonStr);
        var groups = response.groups || [];
        for (var g = 0; g < groups.length; g++) {
            var channels = groups[g].channels || [];
            for (var c = 0; c < channels.length; c++) {
                if (String(channels[c].id) === String(channelId)) {
                    return channels[c];
                }
            }
        }
    } catch (e) { }
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

        groups.forEach(function (group) {
            var channels = group.channels || [];
            channels.forEach(function (channel) {
                allItems.push({
                    id: String(channel.id),
                    title: channel.name,
                    posterUrl: channel.image ? channel.image.url : "",
                    backdropUrl: channel.image ? channel.image.url : "",
                    year: 0,
                    quality: "LIVE",
                    episode_current: channel.labels && channel.labels.length > 0 ? channel.labels[0].text : "Live",
                    lang: channel.org_metadata ? channel.org_metadata.league : ""
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
        // Tách channel ID từ URL ?id=xxx
        var channelId = extractIdFromUrl(apiUrl);
        if (!channelId) return "null";

        // Tìm channel trong JSON
        var channel = findChannelById(apiResponseJson, channelId);
        if (!channel) return "null";

        // Build servers + episodes → episode ID = link m3u8 trực tiếp
        var servers = [];
        var sources = channel.sources || [];
        sources.forEach(function (source) {
            var episodes = [];
            var contents = source.contents || [];
            contents.forEach(function (content) {
                var streams = content.streams || [];
                streams.forEach(function (stream) {
                    var links = stream.stream_links || [];
                    links.forEach(function (link) {
                        // ID = link m3u8 trực tiếp, không cần encode
                        episodes.push({
                            id: link.url,
                            name: (source.name || "Server") + " - " + (link.name || "Link"),
                            slug: link.id || "stream"
                        });
                    });
                });
            });
            if (episodes.length > 0) {
                servers.push({ name: source.name || "Live Source", episodes: episodes });
            }
        });

        var metadata = channel.org_metadata || {};
        var description = "Trận đấu giữa " + (metadata.team_a || "Đội A") + " và " + (metadata.team_b || "Đội B");
        if (metadata.league) description += " tại giải " + metadata.league;

        return JSON.stringify({
            id: String(channel.id),
            title: channel.name,
            originName: metadata.league || "",
            posterUrl: channel.image ? channel.image.url : "",
            backdropUrl: channel.image ? channel.image.url : "",
            description: description,
            year: 0,
            rating: 0,
            quality: "LIVE",
            servers: servers,
            episode_current: "Live",
            lang: "Việt",
            category: "Bóng đá trực tiếp",
            country: "Việt",
            director: "Thập Cẩm TV",
            casts: (metadata.team_a || "") + ", " + (metadata.team_b || "")
        });
    } catch (error) {
        return "null";
    }
}

// parseDetailResponse: nhận episode ID (= URL m3u8 trực tiếp)
// getUrlDetail trả thẳng URL m3u8 → app fetch → trả response ở đây
function parseDetailResponse(apiResponseJson, apiUrl) {
    try {
        // apiUrl chính là link m3u8 (vì getUrlDetail trả thẳng khi slug là http URL)
        var streamUrl = apiUrl || "";

        return JSON.stringify({
            url: streamUrl,
            headers: { "User-Agent": "Mozilla/5.0" },
            subtitles: []
        });
    } catch (error) {
        return JSON.stringify({
            url: apiUrl,
            headers: { "User-Agent": "Mozilla/5.0" },
            subtitles: []
        });
    }
}

function parseCategoriesResponse(apiResponseJson) {
    return JSON.stringify([{ name: 'Trực tiếp', slug: 'live' }]);
}

function parseCountriesResponse(apiResponseJson) { return "[]"; }
function parseYearsResponse(apiResponseJson) { return "[]"; }
