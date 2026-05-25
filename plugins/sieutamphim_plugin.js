// ========================================================
// SIÊU TẦM PHIM VAAPP PLUGIN (Code thêm từ bản của bạn ʚʚ Ƭ Ɗųƴ ɞɞ)
// ========================================================

const BASE_URL = "https://www.sieutamphim.pro";

// ========================================================
// CONFIGURATION & METADATA
// ========================================================

function getManifest() {
    return JSON.stringify({
        "id": "sieutamphim",
        "name": "Sưu Tầm Phim",
        "version": "1.0.0",
        "baseUrl": "https://www.sieutamphim.pro",
        "iconUrl": "https://www.sieutamphim.pro/posts/2024/06/cropped-logosieutamphim-192x192.png",
        "isEnabled": true,
        "isAdult": false,
        "type": "MOVIE",
        "layoutType": "VERTICAL",
        "playerType": "auto"
    });
}

function log(msg) {
    if (typeof nativeLog !== 'undefined') {
        nativeLog("[STPhim] " + msg);
    }
}

// ========================================================
// HOME
// ========================================================

function getHomeSections() {
    return JSON.stringify([
        { slug: "phim-bo", title: "Phim Bộ Mới", type: "Horizontal" },
        { slug: "phim-le", title: "Phim Lẻ Mới", type: "Horizontal" },
        { slug: "long-tieng", title: "Phim Lồng Tiếng", type: "Horizontal" },
        { slug: "thuyet-minh", title: "Phim Thuyết Minh", type: "Horizontal" },
        { slug: "phim-moi", title: "Mới cập nhật", type: "Grid" }
    ]);
}

// ========================================================
// CATEGORY
// ========================================================

function getPrimaryCategories() {
    return JSON.stringify([
        { name: 'Phim Lẻ', slug: 'phim-le' },
        { name: 'Phim Bộ', slug: 'phim-bo' },
        { name: 'Hoạt Hình', slug: 'hoat-hinh' },
        { name: 'Phim Việt Nam', slug: 'phim-viet-nam' },
        { name: 'Phim Hàn Quốc', slug: 'phim-han-quoc' },
        { name: 'Phim Trung Quốc', slug: 'phim-trung-quoc' },
        { name: 'Phim Nhật Bản', slug: 'phim-nhat-ban' },
        { name: 'Hành Động', slug: 'hanh-dong' },
        { name: 'Viễn Tưởng', slug: 'vien-tuong' }
    ]);
}

function getFilterConfig() {
    return JSON.stringify({
        sort: [],
        category: []
    });
}

// ========================================================
// URL GENERATION
// ========================================================

function getUrlList(slug, filtersJson) {
    var filters = JSON.parse(filtersJson || "{}");
    var page = filters.page || 1;
    if (page === 1) return BASE_URL + "/search/label/" + slug;
    return BASE_URL + "/search/label/" + slug + "/page/" + page;
}

function getUrlSearch(keyword, filtersJson) {
    var filters = JSON.parse(filtersJson || "{}");
    var page = filters.page || 1;
    return BASE_URL + "/page/" + page + "?s=" + encodeURIComponent(keyword);
}

function getUrlDetail(id) {
    log("Resolving ID: " + id);
    if (id && id.startsWith("play-")) {
        var resolved = id.replace("play-", "");
        log("Resolved Stream ID to: " + resolved);
        return resolved;
    }
    return id.startsWith("http") ? id : BASE_URL + "/" + id;
}

// ========================================================
// PARSE LIST
// ========================================================

function parseListResponse(html) {
    try {
        var items = [];
        var used = {};

        // Tách từng item phim để tránh regex chạy sai giữa các item
        var chunks = html.split('class="col post-item"');
        for (var i = 1; i < chunks.length; i++) {
            var blockHtml = chunks[i];

            // link phim
            var urlMatch = blockHtml.match(/href="([^"]+\.html)"/i);
            if (!urlMatch) continue;

            var url = urlMatch[1];
            if (!url.startsWith("http")) url = BASE_URL + url;
            if (used[url]) continue;
            used[url] = true;

            // title & poster
            var titleMatch = blockHtml.match(/post-title[^>]*?>([\s\S]*?)<\/a>/i) || blockHtml.match(/alt="([^"]+)"/i);
            var title = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]*>/g, "")) : "Unknown";

            var posterMatch = blockHtml.match(/data-src="([^"]+)"/i) || blockHtml.match(/src="([^"]+)"/i);
            var poster = posterMatch ? posterMatch[1] : "";

            if (poster.startsWith("//")) poster = "https:" + poster;

            items.push({
                id: url,
                title: title,
                posterUrl: poster
            });
        }

        return JSON.stringify({
            items: items,
            pagination: { currentPage: 1, totalPages: 999 }
        });
    } catch (e) {
        return JSON.stringify({ items: [], pagination: { currentPage: 1, totalPages: 1 } });
    }
}

function parseSearchResponse(html) {
    return parseListResponse(html);
}

// ========================================================
// PARSE DETAIL
// ========================================================

function parseMovieDetail(html, url) {
    // Nếu URL chứa 'server=', đây là link lấy stream, không phải lấy detail.
    // Trả về kết quả rỗng để App không push thêm màn hình Detail.
    if (url && url.includes("server=")) {
        return JSON.stringify({ id: url, servers: [] });
    }
    try {
        var title = (html.match(/<meta property="og:title" content="([^"]+)"/i) || [])[1] || "";
        var poster = (html.match(/<meta property="og:image" content="([^"]+)"/i) || [])[1] || "";
        var description = (html.match(/<meta property="og:description" content="([^"]+)"/i) || [])[1] || "";
        var movieUrl = (html.match(/<meta property="og:url" content="([^"]+)"/i) || [])[1] || url;
        
        // Tìm Post ID (thường có trong shortlink hoặc các biến script)
        var postIdMatch = html.match(/\/\?p=(\d+)/) || html.match(/post-id=["'](\d+)/) || html.match(/postId\s*:\s*(\d+)/) || html.match(/post-id:(\d+)/);
        var postId = postIdMatch ? postIdMatch[1] : "";
        log("Found Movie: " + title + " (PostID: " + postId + ")");

        var servers = [];
        var usedServer = {};

        // Pattern bóc tách Server và Danh sách tập từ data-episodes (JSON encoded)
        // Đây là phần sửa lỗi: Quét toàn bộ HTML để tìm server
        var groupRegex = /data-server=['"]([^'"]+)['"]/gi;
        var m;
        while ((m = groupRegex.exec(html)) !== null) {
            var serverId = m[1];
            if (usedServer[serverId]) continue;
            usedServer[serverId] = true;

            // Tìm block chứa data-episodes của server này
            var epBlockRegex = new RegExp('data-server=["\']' + serverId + '["\'][\\s\\S]*?data-episodes="([^"]+)"', "i");
            var epBlockMatch = html.match(epBlockRegex);

            var epCount = 0;
            if (epBlockMatch) {
                var rawEpisodes = epBlockMatch[1].replace(/&quot;/g, '"');
                try {
                    var epJson = JSON.parse(rawEpisodes);
                    epCount = Object.keys(epJson).length;
                } catch (e) {
                    // Fallback: Đếm số lượng key trong chuỗi encoded
                    var matches = epBlockMatch[1].match(/&quot;\d+&quot;/g);
                    epCount = matches ? matches.length : 1;
                }
            }

            if (epCount === 0) epCount = 1;

            var episodes = [];
            for (var j = 1; j <= epCount; j++) {
                episodes.push({
                    // QUAN TRỌNG: Không dùng :// để App nhảy vào getUrlDetail
                    id: "play-" + movieUrl + "?id=" + postId + "&server=" + encodeURIComponent(serverId) + "&tap=" + j,
                    name: epCount === 1 ? "Full" : "Tập " + j,
                    slug: String(j)
                });
            }

            servers.push({
                name: serverId.toUpperCase(),
                episodes: episodes
            });
        }

        // Fallback cho phim lẻ không có episodeGroup
        if (servers.length === 0) {
            servers.push({
                name: "Mặc định",
                episodes: [{ id: "play://" + movieUrl, name: "Full", slug: "full" }]
            });
        }

        return JSON.stringify({
            id: movieUrl,
            title: decodeHtmlEntities(title.replace(" - Siêu Tầm Phim", "").trim()),
            posterUrl: poster,
            backdropUrl: poster,
            description: description,
            servers: servers,
            quality: "HD",
            status: "Hoàn thành"
        });
    } catch (e) {
        return JSON.stringify({ servers: [] });
    }
}

// ========================================================
// PARSE VIDEO (STREAM)
// ========================================================

function parseDetailResponse(html, url) {
    log("Parsing Stream for: " + url);
    try {
        if (url.includes("?id=") && url.includes("&server=")) {
            var postId = (url.match(/id=(\d+)/) || [])[1];
            var server = (url.match(/server=([^&]+)/) || [])[1];
            var tap = (url.match(/tap=(\d+)/) || [])[1];
            
            if (postId && server && tap) {
                var playerUrl = BASE_URL + "/p/player.html?id=" + postId + "&server=" + server + "&tap=" + tap;
                log("Constructed Player URL: " + playerUrl);
                return JSON.stringify({
                    url: playerUrl,
                    headers: { "Referer": BASE_URL + "/" },
                    isEmbed: true
                });
            }
        }

        var iframeMatch = html.match(/<iframe[^>]*src="([^"]+)"/i);
        if (iframeMatch) {
            var embedUrl = iframeMatch[1];
            log("Found iframe in HTML: " + embedUrl);
            if (embedUrl.startsWith("//")) embedUrl = "https:" + embedUrl;
            if (embedUrl === url || embedUrl.length < 5) {
                return JSON.stringify({ url: url, isEmbed: true, headers: { "Referer": BASE_URL } });
            }
            return JSON.stringify({ url: embedUrl, headers: { "Referer": BASE_URL }, isEmbed: true });
        }

        var m3u8 = html.match(/(https?:\/\/[^"' ]+\.m3u8[^"' ]*)/i);
        if (m3u8) {
            log("Found direct M3U8: " + m3u8[1]);
            return JSON.stringify({ url: m3u8[1], mimeType: "application/x-mpegURL", isEmbed: false });
        }

        log("No stream found, returning fallback URL");
        return JSON.stringify({ url: url, isEmbed: true, headers: { "Referer": BASE_URL } });
    } catch (e) { 
        log("Error in parseDetailResponse: " + e.message);
        return JSON.stringify({ url: "", isEmbed: false }); 
    }
}

function parseEmbedResponse(html, sourceUrl) {
    return parseDetailResponse(html, sourceUrl);
}

// ========================================================
// HELPERS
// ========================================================

function decodeHtmlEntities(str) {
    if (!str) return "";
    return str
        .replace(/&#8211;/g, "-").replace(/&#8212;/g, "-")
        .replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
        .replace(/&#8216;/g, "'").replace(/&#8217;/g, "'")
        .replace(/&#038;/g, "&").replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ").trim();
}

function parseCategoriesResponse(html) { return "[]"; }
function parseCountriesResponse(html) { return "[]"; }
function parseYearsResponse(html) { return "[]"; }
