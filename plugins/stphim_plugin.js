// ========================================================
// SIÊU TẦM PHIM VAAPP PLUGIN (ʚʚ Ƭ Ɗųƴ ɞɞ)
// ========================================================

const BASE_URL = "https://www.sieutamphim.pro";

// ========================================================
// CONFIGURATION & METADATA
// ========================================================

function getManifest() {
    return JSON.stringify({
        "id": "stphim",
        "name": "Sưu Tầm Phim",
        "version": "1.0.1",
        "baseUrl": "https://www.sieutamphim.pro",
        "iconUrl": "https://www.sieutamphim.pro/posts/2024/06/cropped-logosieutamphim-192x192.png",
        "isEnabled": true,
        "isAdult": false,
        "type": "MOVIE",
        "layoutType": "VERTICAL",
        "playerType": "auto"
    });
}

// ========================================================
// HOME
// ========================================================

function getHomeSections() {
    return JSON.stringify([
        { slug: "phim-bo", title: "Phim Bộ", type: "Horizontal" },
        { slug: "phim-le", title: "Phim Lẻ", type: "Horizontal" },
        { slug: "cgv-cinemas-vietnam", title: "CGV Cinemas Việt Nam", type: "Horizontal" },
        { slug: "long-tieng", title: "Phim Lồng Tiếng", type: "Horizontal" },
        { slug: "phim-moi", title: "Mới cập nhật", type: "Grid" }
    ]);
}
// ========================================================
// CATEGORY
// ========================================================

function getPrimaryCategories() {
    return JSON.stringify([
        { name: 'VieON', slug: 'vieon' },
        { name: 'Netflix', slug: 'netflix' },
        { name: 'IQIYI', slug: 'iqiyi' },
        { name: 'Kplus', slug: 'kplus' },
        { name: 'HBO', slug: 'hbo' },
        { name: 'Phim Việt Nam', slug: 'phim-viet-nam' },
        { name: 'Phim Hàn Quốc', slug: 'phim-han-quoc' },
        { name: 'Phim Trung', slug: 'phim-trung-quoc' },
        { name: 'Phim Nhật Bản', slug: 'phim-nhat-ban' }
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
    const filters = JSON.parse(filtersJson || "{}");
    const page = filters.page || 1;

    if (page === 1) {
        return `${BASE_URL}/search/label/${slug}`;
    }

    return `${BASE_URL}/search/label/${slug}/page/${page}`;
}

function getUrlSearch(keyword, filtersJson) {
    const filters = JSON.parse(filtersJson || "{}");
    const page = filters.page || 1;

    return `${BASE_URL}/page/${page}?s=${encodeURIComponent(keyword)}`;
}

function getUrlDetail(id) {
    return id.startsWith("http") ? id : BASE_URL + "/" + id;
}

function getUrlCategories() { return ""; }
function getUrlCountries() { return ""; }
function getUrlYears() { return ""; }

// ========================================================
// PARSE LIST
// ========================================================

function parseListResponse(html) {
    try {
        let items = [];
        let used = {};

        // tách từng block phim
        const blockRegex = /<div[^>]*class="[^"]*box-image[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi;
        let block;

        while ((block = blockRegex.exec(html)) !== null) {
            let blockHtml = block[0];

            // link phim
            let urlMatch = blockHtml.match(/<a[^>]+href="([^"]+\.html)"/i);
            if (!urlMatch) continue;

            let url = urlMatch[1];

            if (!url.startsWith("http")) {
                url = BASE_URL + url;
            }

            if (used[url]) continue;
            used[url] = true;

            // title
            let titleMatch =
                blockHtml.match(/alt="([^"]+)"/i) ||
                blockHtml.match(/title="([^"]+)"/i);

            let title = titleMatch
                ? decodeHtmlEntities(titleMatch[1])
                : "Unknown";

            // poster (ưu tiên nhiều kiểu)
            let posterMatch =
                blockHtml.match(/data-lazy-src="([^"]+)"/i) ||
                blockHtml.match(/data-src="([^"]+)"/i) ||
                blockHtml.match(/src="([^"]+)"/i) ||
                blockHtml.match(/srcset="([^"]+)"/i);

            let poster = posterMatch ? posterMatch[1] : "";

            // nếu srcset -> lấy ảnh đầu tiên
            if (poster.includes(",")) {
                poster = poster.split(",")[0].trim().split(" ")[0];
            }

            // fix protocol //
            if (poster.startsWith("//")) {
                poster = "https:" + poster;
            }

            items.push({
                id: url,
                title: title,
                posterUrl: poster
            });
        }

        return JSON.stringify({
            items: items,
            pagination: {
                currentPage: 1,
                totalPages: 999
            }
        });

    } catch (e) {
        return JSON.stringify({
            items: [],
            pagination: {
                currentPage: 1,
                totalPages: 1
            }
        });
    }
}

function parseSearchResponse(html) {
    return parseListResponse(html);
}

// ========================================================
// FIX HTML ENTITY TITLE
// ========================================================

function decodeHtmlEntities(str) {
    if (!str) return "";

    return str
        .replace(/&#8211;/g, "-")
        .replace(/&#8212;/g, "-")
        .replace(/&#8220;/g, '"')
        .replace(/&#8221;/g, '"')
        .replace(/&#8216;/g, "'")
        .replace(/&#8217;/g, "'")
        .replace(/&#038;/g, "&")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .trim();
}

// ========================================================
// PARSE DETAIL
// ========================================================

function parseMovieDetail(html) {
    try {
        const title =
            (html.match(/<meta property="og:title" content="([^"]+)"/i) || [])[1] ||
            (html.match(/<title>(.*?)<\/title>/i) || [])[1] ||
            "Unknown";

        const poster =
            (html.match(/<meta property="og:image" content="([^"]+)"/i) || [])[1] ||
            "";

        const description =
            (html.match(/<meta property="og:description" content="([^"]+)"/i) || [])[1] ||
            "";

        const movieUrl =
            (html.match(/<meta property="og:url" content="([^"]+)"/i) || [])[1] ||
            "";

        let servers = [];
let usedServer = {};

// lấy toàn bộ tag có episodeGroup
const groupRegex = /<div[^>]*episodeGroup[^>]*>/gi;
let match;

while ((match = groupRegex.exec(html)) !== null) {
    let tagHtml = match[0];

    // lấy server linh hoạt hơn
    let serverMatch = tagHtml.match(/data-server=['"]([^'"]+)['"]/i);

    if (!serverMatch) continue;

    let serverId = serverMatch[1];

    if (usedServer[serverId]) continue;
    usedServer[serverId] = true;

    // lấy data-episodes nếu có
    let epCount = 1;

// lấy toàn bộ data-episodes từ html gốc thay vì tagHtml
let serverBlockRegex = new RegExp(
    'data-server=["\']' + serverId + '["\'][\\s\\S]*?data-episodes="([\\s\\S]*?)"\\s*>',
    "i"
);

let epBlockMatch = html.match(serverBlockRegex);

if (epBlockMatch) {
    let rawEpisodes = epBlockMatch[1];

    // đếm đúng số tập:
    // ,"1"}
    // ,"2"}
    // ,"3"}
    let epMatches = rawEpisodes.match(/,&quot;\d+&quot;\s*}/g);

    if (epMatches && epMatches.length > 0) {
        epCount = epMatches.length;
    }
}

    if (epCount <= 0) {
        epCount = 1;
    }

    let episodes = [];

    for (let i = 1; i <= epCount; i++) {
        episodes.push({
            id:
                movieUrl +
                "?server=" +
                encodeURIComponent(serverId) +
                "&tap=" +
                i,
            name: epCount === 1 ? "Full" : "Tập " + i,
            slug: String(i)
        });
    }

    servers.push({
        name: serverId.toUpperCase(),
        episodes: episodes
    });
}

        // phim lẻ fallback
        if (servers.length === 0) {
            servers.push({
                name: "Default",
                episodes: [
                    {
                        id: movieUrl,
                        name: "Full",
                        slug: "full"
                    }
                ]
            });
        }

        return JSON.stringify({
            id: movieUrl,
            title: decodeHtmlEntities(
                title.replace(" - Siêu Tầm Phim", "").trim()
            ),
            posterUrl: poster,
            backdropUrl: poster,
            description: description,
            servers: servers,
            quality: "HD",
            status: "Completed"
        });

    } catch (e) {
        return JSON.stringify({
            servers: []
        });
    }
}

// ========================================================
// PARSE VIDEO
// ========================================================

function parseDetailResponse(html) {
    try {
        let iframe = html.match(/<iframe[^>]+src="([^"]+)"/i);

        if (iframe) {
            return JSON.stringify({
                url: iframe[1],
                headers: {
                    Referer: BASE_URL
                },
                isEmbed: true
            });
        }

        let m3u8 = html.match(/(https?:\/\/[^"' ]+\.m3u8[^"' ]*)/i);

        if (m3u8) {
            return JSON.stringify({
                url: m3u8[1],
                mimeType: "application/x-mpegURL",
                isEmbed: false
            });
        }

        let mp4 = html.match(/(https?:\/\/[^"' ]+\.mp4[^"' ]*)/i);

        if (mp4) {
            return JSON.stringify({
                url: mp4[1],
                isEmbed: false
            });
        }

        return JSON.stringify({
            url: "",
            isEmbed: false
        });

    } catch (e) {
        return JSON.stringify({
            url: "",
            isEmbed: false
        });
    }
}

// ========================================================
// EMBED
// ========================================================

function parseEmbedResponse(html, sourceUrl) {
    return parseDetailResponse(html);
}

// ========================================================


function parseCategoriesResponse(html) { return "[]"; }
function parseCountriesResponse(html) { return "[]"; }
function parseYearsResponse(html) { return "[]"; }