const mangayomiSources = [{
    "name": "Shikimori",
    "lang": "ru",
    "baseUrl": "https://shikimori.io",
    "apiUrl": "https://shikimori.io/api",
    "iconUrl": "https://shikimori.io/favicons/favicon-32x32.png",
    "typeSource": "single",
    "itemType": 1,
    "version": "0.0.2",
    "pkgPath": "",
    "notes": ""
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
        this.baseUrl = "https://shikimori.io";
        this.apiUrl = "https://shikimori.io/api";
    }

    getHeaders() {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "Referer": `${this.baseUrl}/`
        };
    }

    async _fetchApi(endpoint) {
        try {
            const response = await this.client.get(`${this.apiUrl}${endpoint}`, this.getHeaders());
            if (response.statusCode !== 200) return null;
            return JSON.parse(response.body);
        } catch (e) {
            return null;
        }
    }

    _animeFromJsonObject(item) {
        const name = item.russian || item.name || "";
        const imagePath = item.image ? (item.image.original || item.image.preview || "") : "";
        const imageUrl = imagePath.startsWith("/") ? `${this.baseUrl}${imagePath}` : imagePath;

        return {
            name: name,
            link: `/animes/${item.id}`,
            imageUrl: imageUrl
        };
    }

    _parseList(rawData) {
        if (!rawData || !Array.isArray(rawData)) return [];
        return rawData.map(item => this._animeFromJsonObject(item));
    }

    get supportsLatest() {
        return true;
    }

    async getPopular(page) {
        const limit = 20;
        const data = await this._fetchApi(`/animes?page=${page}&limit=${limit}&order=popularity`);
        return {
            list: this._parseList(data),
            hasNextPage: Array.isArray(data) && data.length === limit
        };
    }

    async getLatestUpdates(page) {
        const limit = 20;
        const data = await this._fetchApi(`/animes?page=${page}&limit=${limit}&order=ranked`);
        return {
            list: this._parseList(data),
            hasNextPage: Array.isArray(data) && data.length === limit
        };
    }

    async search(query, page, filters) {
        const limit = 20;
        const encodedQuery = encodeURIComponent(query);
        const data = await this._fetchApi(`/animes?search=${encodedQuery}&page=${page}&limit=${limit}`);
        return {
            list: this._parseList(data),
            hasNextPage: Array.isArray(data) && data.length === limit
        };
    }

    async getDetail(url) {
        const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
        const id = cleanUrl.split('/').pop().split('-')[0];

        const item = await this._fetchApi(`/animes/${id}`);
        if (!item) return {};

        const imagePath = item.image ? (item.image.original || item.image.preview || "") : "";
        const imageUrl = imagePath.startsWith("/") ? `${this.baseUrl}${imagePath}` : imagePath;

        const anime = {
            name: item.russian || item.name || "",
            description: item.description || "",
            genre: Array.isArray(item.genres) ? item.genres.map(g => g.russian || g.name) : [],
            status: 0,
            imageUrl: imageUrl,
            chapters: [],
            related: []
        };

        if (item.status === "released") {
            anime.status = 2;
        } else if (item.status === "ongoing") {
            anime.status = 1;
        }

        const totalEpisodes = item.episodes_aired || item.episodes || 0;
        const chapters = [];
        for (let i = 1; i <= totalEpisodes; i++) {
            chapters.push({
                name: `Серия ${i}`,
                url: `/animes/${id}/episode/${i}`,
                dateUpload: item.aired_on ? new Date(item.aired_on).getTime().toString() : ""
            });
        }
        
        anime.chapters = chapters.sort((a, b) => {
            const an = parseFloat(a.name.replace(/[^0-9.]/g, '')) || 0;
            const bn = parseFloat(b.name.replace(/[^0-9.]/g, '')) || 0;
            return an - bn;
        });

        return anime;
    }

    async getVideoList(url) {
        const videos = [];
        const parts = url.split('/');
        
        // Извлекаем ID аниме и номер серии из URL
        const animeId = parts[2] ? parts[2].split('-')[0] : null;
        const episodeNum = parseInt(parts[4] || "1", 10);

        if (!animeId) return videos;

        try {
            // 1. Запрашиваем полный список серий и озвучек
            const playlistUrl = `https://plapi.cdnvideohub.com/api/v1/player/sv/playlist?pub=3058&aggr=mali&id=${animeId}`;
            const playlistRes = await this.client.get(playlistUrl, this.getHeaders());

            if (playlistRes.statusCode === 200 && playlistRes.body) {
                const playlistData = JSON.parse(playlistRes.body);
                const items = playlistData.items || [];

                // 2. Фильтруем элементы только для нужного номера серии
                const currentEpisodeItems = items.filter(item => item.episode === episodeNum);

                // 3. Для каждой озвучки получаем прямые ссылки на видео
                for (const item of currentEpisodeItems) {
                    if (!item.vkId) continue;

                    const videoApiUrl = `https://plapi.cdnvideohub.com/api/v1/player/sv/video/${item.vkId}`;
                    const videoRes = await this.client.get(videoApiUrl, this.getHeaders());

                    if (videoRes.statusCode === 200 && videoRes.body) {
                        const videoData = JSON.parse(videoRes.body);
                        const sources = videoData.sources || {};

                        // Приоритет отдаем HLS (.m3u8), если его нет — берём MP4
                        const streamUrl = sources.hlsUrl || 
                                          sources.mpegFullHdUrl || 
                                          sources.mpegHighUrl || 
                                          sources.mpegMediumUrl;

                        
                        if (streamUrl) {
                            const studio = item.voiceStudio || "Озвучка";
                            const type = item.voiceType ? ` (${item.voiceType})` : "";

                            videos.push({
                                url: streamUrl,
                                quality: `${studio}${type}`,
                                originalUrl: streamUrl,
                                headers: {
        "Referer": "https://player.cdnvideohub.com",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
                            });
                        }
                    }
                }
            }
        } catch (e) {
            // Ошибка при обработке запросов
        }

        return videos;
    }

    
            
    async getHtmlContent(name, url) {
        throw new Error("getHtmlContent not implemented");
    }

    async cleanHtmlContent(html) {
        throw new Error("cleanHtmlContent not implemented");
    }

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
