const mangayomiSources = [{
    "name": "Animelib",
    "lang": "ru",
    "baseUrl": "https://animelib.org/",
    "apiUrl": "https://hapi.hentaicdn.org/api/",
    "iconUrl": "https://animelib.org/",
    "typeSource": "single",
    "itemType": 1,
    "version": "0.0.1",
    "pkgPath": "",
    "notes": ""
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
        this.baseUrl = "https://animelib.org";
        this.apiUrl = "https://hapi.hentaicdn.org/api";
    }

    getHeaders() {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": `${this.baseUrl}/`
        };
    }
    
    
    
    
    async _fetchApi(endpoint) {
        try {
            const response = await this.client.get(`${this.apiUrl}${endpoint}`, this.getHeaders());
            if (response.statusCode !== 200) return null;

            const json = JSON.parse(response.body);
            if (json && json.success === false) return null;
            return json;
        } catch (e) {
            return null;
        }
    }

    _parseDescription(summary) {
        if (!summary) return "";
        if (typeof summary === "string") return summary;
        if (typeof summary === "object") {
            let res = "";
            if (summary.text) res += summary.text;
            if (Array.isArray(summary.content)) {
                for (const item of summary.content) {
                    const parsed = this._parseDescription(item);
                    if (parsed) {
                        res += parsed;
                        if (summary.type === "paragraph" || summary.type === "doc") {
                            res += "\n\n";
                        }
                    }
                }
            }
            return res.trim();
        }
        return String(summary);
    }

    _animeFromJsonObject(json) {
        const slug = json["slug_url"] || json["slug"] || "";
        const name = json["rus_name"] || json["name"] || json["eng_name"] || "";
        const cover = json["cover"] || {};
        const imageUrl = cover["default"] || cover["md"] || cover["thumbnail"] || "";

        return {
            name: name,
            link: `/anime/${slug}`,
            imageUrl: imageUrl
        };
    }

    _parseList(rawData) {
        if (!rawData) return [];
        let data = rawData;
        if (typeof data === "object" && !Array.isArray(data)) {
            data = data.data || data.items || data.popular || data.results || [];
        }
        if (!Array.isArray(data)) return [];

        return data.map(item => this._animeFromJsonObject(item));
    }

    get supportsLatest() {
        return true;
    }

    async getPopular(page) {
        const data = await this._fetchApi(`/anime?site_id[]=5&sort_by=views&sort_type=desc&page=${page}`);
        if (!data) return { list: [], hasNextPage: false };
        return {
            list: this._parseList(data),
            hasNextPage: !!(data.links && data.links.next)
        };
    }

    async getLatestUpdates(page) {
        const data = await this._fetchApi(`/anime?site_id[]=5&sort_by=last_episode_at&sort_type=desc&page=${page}`);
        if (!data) return { list: [], hasNextPage: false };
        return {
            list: this._parseList(data),
            hasNextPage: !!(data.links && data.links.next)
        };
    }

    async search(query, page, filters) {
        const data = await this._fetchApi(`/anime?site_id[]=5&q=${encodeURIComponent(query)}&page=${page}`);
        if (!data) return { list: [], hasNextPage: false };
        return {
            list: this._parseList(data),
            hasNextPage: !!(data.links && data.links.next)
        };
    }

    async getDetail(url) {
        const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
        const slug = cleanUrl.split('/').pop();

        const data = await this._fetchApi(`/anime/${slug}?fields[]=summary&fields[]=genres`);
        if (!data || !data.data) return {};

        const item = data.data;
        const anime = {
            name: item.rus_name || item.name || item.eng_name || "",
            description: this._parseDescription(item.summary),
            genre: Array.isArray(item.genres) ? item.genres.map(g => (typeof g === "object" ? g.name : g)) : [],
            status: 0,
            chapters: []
        };

        const statusLabel = typeof item.status === "object" ? item.status.label : item.status;
        if (statusLabel === "Завершен" || statusLabel === "Вышел") {
            anime.status = 2;
        } else if (statusLabel === "Онгоинг") {
            anime.status = 1;
        }

        if (item.cover) {
            anime.imageUrl = item.cover.default || item.cover.md || "";
        }

        const animeId = item.id;
        if (animeId) {
            let epData = await this._fetchApi(`/episodes?manga_id=${animeId}`);
            if (!epData) epData = await this._fetchApi(`/episodes?anime_id=${animeId}`);

            if (epData && Array.isArray(epData.data)) {
                anime.chapters = epData.data.map(ep => {
                    const episodeNum = ep.number || "0";
                    const epNameStr = ep.name || "";
                    const episodeName = epNameStr ? ` - ${epNameStr}` : "";

                    return {
                        name: `Серия ${episodeNum}${episodeName}`,
                        url: `/anime/${slug}/episode/${ep.id}`,
                        dateUpload: ep.created_at ? new Date(ep.created_at).getTime().toString() : ""
                    };
                });

                anime.chapters.sort((a, b) => {
                    const an = parseFloat(a.name.replace(/[^0-9.]/g, '')) || 0;
                    const bn = parseFloat(b.name.replace(/[^0-9.]/g, '')) || 0;
                    return an - bn;
                });
            }
        }

        return anime;
    }
    // For novel html content
    async getHtmlContent(name, url) {
        throw new Error("getHtmlContent not implemented");
    }
    // Clean html up for reader
    async cleanHtmlContent(html) {
        throw new Error("cleanHtmlContent not implemented");
    }
    // For anime episode video list
     async getVideoList(url) {    
    const videos = [];    
    const eid = url.split("/").pop();    
    const d = await this._fetchApi(`/episodes/${eid}`);    
    if (!d || !d.data || !d.data.players) return videos;    

    for (const p of d.data.players) {    
        let src = String(p.src || "");    
        if (!src) continue;    
        if (src.startsWith("//")) src = "https:" + src;    

        const team = (p.team && p.team.name) || p.player || "Player";    
        const playerName = p.player || "Kodik";    

        // Все плееры (включая Kodik) открываем во встроенном WebView    
        videos.push({    
            url: src,    
            quality: `${team} • ${playerName}`,    
            originalUrl: src,    
            playerType: "webview",    
            headers: {    
                "Referer": this.baseUrl,    
                "Origin": this.baseUrl    
            }    
        });    
    }    
    return videos;    
    }
    // For manga chapter pages
    async getPageList(url) {
        throw new Error("getPageList not implemented");
    }
    getFilterList() {
        throw new Error("getFilterList not implemented");
    }
    getSourcePreferences() {
        throw new Error("getSourcePreferences not implemented");
    }
}
