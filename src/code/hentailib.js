const mangayomiSources = [{
    "name": "Slashlib",
    "lang": "ru",
    "baseUrl": "https://slashlib.me",
    "apiUrl": "https://hapi.hentaicdn.org/api",
    "iconUrl": "https://slashlib.me/favicon.ico",
    "typeSource": "single",
    "itemType": 0, // 0 = Manga
    "isNsfw": true, // Контент 18+
    "version": "0.0.2",
    "pkgPath": "",
    "notes": ""
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
        this.baseUrl = "https://slashlib.me";
        this.apiUrl = "https://hapi.hentaicdn.org/api";
        this.siteId = "4"; // I
    }

    getHeaders() {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": `${this.baseUrl}/`,
            "Site-Id":"4"
        };
    }
    
    async _fetchApi(endpoint) {
        try {
            const response = await this.client.get(`${this.apiUrl}${endpoint}`, this.getHeaders());
            if (response.statusCode !== 200) return response;

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

    _mangaFromJsonObject(json) {        
        const slug = json["slug_url"] || json["slug"] || "";
        const name = json["rus_name"] || json["name"] || json["eng_name"] || "";
        const cover = json["cover"] || {};
        const imageUrl = cover["default"] || cover["md"] || cover["thumbnail"] || "";

        return {
            name: name,
            link: `/manga/${slug}`,
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

        return data.map(item => this._mangaFromJsonObject(item));
    }

    get supportsLatest() {
        return true;
    }

    async getPopular(page) {
        const data = await this._fetchApi(`/manga?site_id[]=${this.siteId}&sort_by=views&sort_type=desc&page=${page}`);
        if (!data) return { list: [], hasNextPage: false };
        return {
            list: this._parseList(data),
            hasNextPage: !!(data.links && data.links.next)
        };
    }

    async getLatestUpdates(page) {
        const data = await this._fetchApi(`/manga?site_id[]=${this.siteId}&sort_by=last_chapter_at&sort_type=desc&page=${page}`);
        if (!data) return { list: [], hasNextPage: false };
        return {
            list: this._parseList(data),
            hasNextPage: !!(data.links && data.links.next)
        };
    }

    async search(query, page, filters) {
        let sortBy = "rate_avg";
        let sortType = "desc";
        
        

        let url = `/manga?site_id[]=${this.siteId}&page=${page}&sort_by=${sortBy}&sort_type=${sortType}`;
        if (query) {
            url += `&q=${encodeURIComponent(query)}`;
        }

        const data = await this._fetchApi(url);
        if (!data) return { list: [], hasNextPage: false };
        return {
            list: this._parseList(data),
            hasNextPage: !!(data.links && data.links.next)
        };
    }

    async getDetail(url) {
        try {
            const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
            const slug = cleanUrl.split('/').pop();

            // Добавил fields[]=authors и fields[]=tags для полных деталей
            const data = await this._fetchApi(`/manga/${slug}?fields[]=summary&fields[]=genres&fields[]=authors&fields[]=tags`);
            if (!data || !data.data) return { name: "Тайтл не найден" };

            const item = data.data;
            const manga = {
                name: item.rus_name || item.name || item.eng_name || "",
                description: this._parseDescription(item.summary),
                genre: [],
                status: 0,
                chapters: [],
                author: "",
                url: url
            };
            
            // Безопасный парсинг Жанров и Тегов
            if (Array.isArray(item.genres)) {
                item.genres.forEach(g => manga.genre.push(typeof g === "object" ? g.name : g));
            }
            if (Array.isArray(item.tags)) {
                item.tags.forEach(t => manga.genre.push(typeof t === "object" ? t.name : t));
            }

            // Безопасный парсинг Авторов
            if (Array.isArray(item.authors)) {
                manga.author = item.authors.map(a => a.name).join(", ");
            }
            
            // ИСПРАВЛЕНО: Безопасная проверка статуса (раньше крашилось на null)
            if (item.status && typeof item.status === "object") {
                const statusLabel = item.status.label || "";
                if (statusLabel === "Завершен" || statusLabel === "Вышел") {
                    manga.status = 2;
                } else if (statusLabel === "Продолжается" || statusLabel === "Онгоинг") {
                    manga.status = 1;
                }
            }

            // Обложка
            if (item.cover) {
                manga.imageUrl = typeof item.cover === "string" ? item.cover : (item.cover.default || item.cover.md || "");
            }
             
            // Главы: пробуем основной эндпоинт, если пусто - запасной по ID
            let chaptersList = [];
const chaptersData = await this._fetchApi(`/manga/${slug}/chapters`);

if (chaptersData && Array.isArray(chaptersData.data)) {
    chaptersList = chaptersData.data;
} else if (typeof item !== 'undefined' && item && item.id) {
    const altData = await this._fetchApi(`/chapters?manga_id=${item.id}`);
    if (altData && Array.isArray(altData.data)) {
        chaptersList = altData.data;
    }
}

if (chaptersList.length > 0) {
    const formattedChapters = [];
    // Сохраняем сформированный список в объект manga
    for (let i = 0; i < chaptersList.length; i++) {
        const item = chaptersList[i];

        // Если внутри элемента есть массив chapters — берем его, иначе работаем с сам элемента
        const innerChapters = Array.isArray(item.chapters) ? item.chapters : [item];

        for (let j = 0; j < innerChapters.length; j++) {
            const ch = innerChapters[j];

            // 1. Берем том из главы или из родительского объекта тома
            const vol = ch.volume || item.volume || "1";

            // 2. Проверяем все возможные варианты имени поля для номера главы
            const rawNum = ch.number ?? ch.chapter ?? ch.num ?? ch.chapter_number;
            const num = rawNum !== undefined && rawNum !== null ? rawNum : "0";

            const chNameStr = ch.name || "";
            let chapterName = "";
            if (chNameStr) {
                chapterName = ` - ${chNameStr}`;
            }

            let timeStampStr = "";
            if (ch.created_at) {
                timeStampStr = new Date(ch.created_at).getTime().toString();
            }

            const branchParam = typeof branch !== 'undefined' ? branch : "";

            formattedChapters.push({
                name: `Том ${vol} Глава ${num}${chapterName}`,
                url: `/manga/${slug}/chapter?number=${num}&volume=${vol}${branchParam}`,
                dateUpload: timeStampStr
            });
        }
    }
    manga.chapters = formattedChapters;

    // Сортировка: новые главы сверху
    /*manga.chapters.sort((a, b) => {
        const aVolMatch = a.name.match(/Том (\d+)/);
        const bVolMatch = b.name.match(/Том (\d+)/);
        const aVol = parseFloat(aVolMatch ? aVolMatch[1] : 0);
        const bVol = parseFloat(bVolMatch ? bVolMatch[1] : 0);

        if (aVol !== bVol) {
            return bVol - aVol;
        }

        const aNumMatch = a.name.match(/Глава ([\d.]+)/);
        const bNumMatch = b.name.match(/Глава ([\d.]+)/);
        const aNum = parseFloat(aNumMatch ? aNumMatch[1] : 0);
        const bNum = parseFloat(bNumMatch ? bNumMatch[1] : 0);

        return bNum - aNum;
    });*/
}

            return manga;
        } catch (e) {
            // Если произойдет непредвиденная ошибка, приложение не зависнет белым экраном
            return { name: "Ошибка парсинга", description: String(e) };
        }
    }

 async getPageList(url) {
        const data = await this._fetchApi(url);
        if (!data || !data.data || !data.data.pages) return [];
        
        const pagesData = data.data.pages;
        if (!Array.isArray(pagesData)) return [];

        // Получаем выбранный пользователем сервер из настроек (по умолчанию второй — сжатый cdnlibs)
        const prefs = await this.getSourcePreferences();
        let selectedServer = "https://img3.cdnlibs.org"; // значение по умолчанию
        
        // Попытка найти выбранное значение в настройках Mangayomi
        // (зависит от того, как клиент передает preferences, обрабатываем безопасно)
        try {
            if (global.settings && global.settings["image_server"]) {
                selectedServer = global.settings["image_server"];
            }
        } catch (e) {}

        return pagesData.map(page => {
            let imgUrl = page.url || page.image || "";
            if (!imgUrl) return "";

            if (imgUrl.startsWith("http")) return imgUrl;

            // Если путь начинается с //, убираем их, чтобы корректно склеить с сервером
            if (imgUrl.startsWith("//")) {
                imgUrl = imgUrl.substring(1); // оставляем один слеш или корректный путь
            }
            if (!imgUrl.startsWith("/")) {
                imgUrl = "/" + imgUrl;
            }

            return `${selectedServer}${imgUrl}`;
        }).filter(url => url !== "");
    }
    getFilterList() {
        return [
            
        ];
    }

    async getVideoList(url) {
        throw new Error("getVideoList not implemented for Manga");
    }
    async getHtmlContent(name, url) {
        throw new Error("getHtmlContent not implemented");
    }
    async cleanHtmlContent(html) {
        throw new Error("cleanHtmlContent not implemented");
    }
    getSourcePreferences() {
        return [
            {
                key: "image_server",
                listPreference: {
                    title: "Сервер изображений",
                    summary: "Выберите источник загрузки картинок",
                    valueIndex: 1, // По умолчанию выбран индекс 1 (img3.cdnlibs.org)
                    entries: [
                        "Основной (img2.imglib.info)",
                        "Сжатый / Быстрый (img3.cdnlibs.org)"
                    ],
                    entryValues: [
                        "https://img2.imglib.info",
                        "https://img3.cdnlibs.org"
                    ]
                }
            }
        ];
    }
}