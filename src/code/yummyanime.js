  const mangayomiSources = [
    {
      name: "YummyAnime",
      lang: "ru",
      baseUrl: "https://ru.yummyani.me",
      apiUrl: "https://api.yani.tv",
      iconUrl: "https://ru.yummyani.me/favicon.ico",
      version: "0.0.1",
      isNsfw: false,
      isManga: false,
      pkgName: "yummyanime",
      itemType: 0
    }
  ];
  
  class DefaultExtension extends MProvider {
    constructor() {
      super();
      this.client = new Client();
      this.YUMMY_APPLICATION_TOKEN = "ii73rfrkq49pj7uz";
      this.API_URL = "https://api.yani.tv";
      this.YUMMY_URL = "https://ru.yummyani.me";
      this.KODIK_URL = "https://kodikplayer.com";
    }
  
    getHeaders() {
      return {
        "X-Application": this.YUMMY_APPLICATION_TOKEN,
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
        "Referer": this.YUMMY_URL
      };
    }
  
    extractSlug(url) {
      let pathname = url;
      if (pathname.endsWith("/")) {
        pathname = pathname.substring(0, pathname.length - 1);
      }
      const parts = pathname.split("/");
      return parts[parts.length - 1];
    }
  
    normalizeUrl(url, parent) {
      if (!url) return "";
      if (url.indexOf("//") === 0) {
        return "https:" + url;
      }
      if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) {
        return url;
      }
      const base = parent || this.YUMMY_URL;
      if (url.indexOf("/") === 0) {
        return base + url;
      }
      return base + "/" + url;
    }
  
    async yummyGet(path, query) {
      let url = this.API_URL + path;
      if (query) {
        let params = "";
        for (const key in query) {
          if (query[key] !== undefined && query[key] !== null) {
            params += `${key}=${String(query[key])}&`;
          }
        }
        if (params) {
          url += "?" + params;
        }
      }
      const res = await this.client.get(url, this.getHeaders());
      const ret = JSON.parse(res.body);
      return ret.response;
    }
  
    async getAnime(identifier, needVideos) {
      const query = {};
      if (needVideos) {
        query.need_videos = 1;
      }
      return await this.yummyGet(
        "/anime/" + encodeURIComponent(identifier),
        query
      );
    }
  
    getPoster(anime) {
      if (!anime.poster) return "";
      return anime.poster.big || anime.poster.medium || anime.poster.fullsize || "";
    }
  
    extractAnimeArray1(data) {
      let list = [];
      data.map((item) => {
        const nameTile = item.title || "";
        const linkTile = `/anime/${item.anime_url || item.anime_id || ""}`;
        const imageTile = this.normalizeUrl(this.getPoster(item) || "");
        const descriptionTile = item.description || "";
        const statusTile = item.anime_status && item.anime_status.value == 0 ? 1 : 0;
  
        list.push({
          name: nameTile,
          imageUrl: imageTile,
          link: linkTile,
          description: descriptionTile,
          status: statusTile
        });
      });
      return list;
    }
  
    extractGenres(anime) {
      if (!anime.genres) return [];
      return anime.genres
        .map((genre) => genre.title || genre.name || "")
        .filter((value) => value !== "");
    }
  
    convertStatus(anime) {
      if (!anime.anime_status) return 5;
      const status = anime.anime_status.alias || anime.anime_status.title || "";
      const value = String(status).toLowerCase();
  
      if (value.indexOf("ongoing") !== -1 || value.indexOf("выходит") !== -1) {
        return 0;
      }
      if (value.indexOf("finished") !== -1 || value.indexOf("заверш") !== -1) {
        return 1;
      }
      return 5;
    }
  
    async getPopular(page) {
      const response = await this.yummyGet("/anime");
      const items = this.extractAnimeArray1(response);
      return {
        list: items,
        hasNextPage: items.length == 20
      };
    }
  
    get supportsLatest() {
      throw new Error("supportsLatest not implemented");
    }
  
    async getLatestUpdates(page) {
      throw new Error("getLatestUpdates not implemented");
    }
  
    async search(query, page, filters) {
      const limit = 30;
      const offset = (page - 1) * limit;
      let genres = "", exgenres = "";
      if (filters && Array.isArray(filters)) {
        filters.forEach(filter => {
            if (filter.type === "GenreFilter" && Array.isArray(filter.state)) {
                filter.state.filter(e => e.state).map((item,index)=>{
                  if(item.value){
                  genres += genres == "" ? "": "&" ;
                  genres += item.value;
                  }
                })
            } else if (filter.type === "ExcludeGenreFilter" && Array.isArray(filter.state)) {
                filter.state.filter(e => e.state).map((item,index)=>{
                  if(item.value){
                  exgenres += exgenres == "" ? "": "&" ;
                  exgenres += item.value;
                  }
                })
            } 
        });
        }
        let params = {
        q: query,
        limit: limit,
        offset: offset,
      };
      if(genres != ""){
        params.genre =  genres;
      }
      if(exgenres != ""){
        params.exclude_genres =  exgenres;
      }      
      const response = await this.yummyGet("/anime",params );
      
      const items = this.extractAnimeArray1(response);
      return {
        list: items,
        hasNextPage: items.length == 20
      };
    }
  
    async getDetail(url) {
      const slug = this.extractSlug(url);
      const anime = await this.getAnime(slug, true);
  
      if (!anime) {
        throw new Error("Anime not found");
      }
  
      const imageTile = this.normalizeUrl(this.getPoster(anime) || "");
      const videos = (anime.videos || []).slice().sort((a, b) => {
        const isKodikA = (a.data && a.data.player && a.data.player.toLowerCase().includes('kodik')) ||
                        (a.iframe_url && a.iframe_url.toLowerCase().includes('kodik'));
        const isKodikB = (b.data && b.data.player && b.data.player.toLowerCase().includes('kodik')) ||
                        (b.iframe_url && b.iframe_url.toLowerCase().includes('kodik'));
      
        if (isKodikA && !isKodikB) return -1;
        if (!isKodikA && isKodikB) return 1;
        return 0;
      });
      const episodes = [];
  
      for (const video of videos) {
        if (!video || video.number === undefined || video.number === null) {
          continue;
        }
  
        let dubbing = video.data && video.data.dubbing ? video.data.dubbing : "";
        let episodeName = String(video.number);
  
        if (dubbing) {
          episodeName += " — " + dubbing;
        }
        let chapterUrl = `${this.normalizeUrl(video.iframe_url)}`;
        if(chapterUrl.includes('iframeCVH'))
          chapterUrl +=  `&chapter=${episodeName}`
        episodes.push({
          name: episodeName,
          url: chapterUrl,
          scanlator: dubbing || "YummyAnime",
          dateUpload: video.date ? String(video.date) : null
        });
      }
      let type = 16;
      switch(anime.type.value){
       case 1:
       case  6:
        type = 13;
       break;
       case 2:
       case 3:
       type = 12;
       break;
       case 4:
       type = 10;
       break; 
       case 5:
       type = 14;
       break;
       case  7:
       type = 11;
       break;
      }
  
      return {
        name: anime.title || "",
        description: anime.description || "",
        imageUrl: imageTile,
        author: "",
        genre: this.extractGenres(anime),
        status: this.convertStatus(anime),
        episodes: episodes
      };
    }
    async kodikParse(url) {
      const playerResponse = await this.client.get(url, {
        "Referer": this.YUMMY_URL,
        "Origin": this.YUMMY_URL
      });
  
      const playerHtml = playerResponse.body;
      if (!playerHtml || playerHtml.length === 0) {
        throw new Error("Kodik: empty player page");
      }
  
      let d = "", dSign = "", pd = "", pdSign = "", ref = "", refSign = "";
  
      const urlParamsMatch = /var\s+urlParams\s*=\s*'([\s\S]*?)';/i.exec(playerHtml);
      if (urlParamsMatch) {
        try {
          const params = JSON.parse(urlParamsMatch[1]);
          d = params.d || "";
          dSign = params.d_sign || "";
          pd = params.pd || "";
          pdSign = params.pd_sign || "";
          ref = params.ref || "";
          refSign = params.ref_sign || "";
        } catch (e) { }
      }
  
      if (!d) {
        const match = /var\s+domain\s*=\s*["']([^"']+)["']/i.exec(playerHtml);
        if (match) d = match[1];
      }
      if (!dSign) {
        const match = /var\s+d_sign\s*=\s*["']([^"']+)["']/i.exec(playerHtml);
        if (match) dSign = match[1];
      }
      if (!pd) {
        const match = /var\s+pd\s*=\s*["']([^"']+)["']/i.exec(playerHtml);
        if (match) pd = match[1];
      }
      if (!pdSign) {
        const match = /var\s+pd_sign\s*=\s*["']([^"']+)["']/i.exec(playerHtml);
        if (match) pdSign = match[1];
      }
      if (!ref) {
        const match = /var\s+ref\s*=\s*["']([^"']+)["']/i.exec(playerHtml);
        if (match) ref = match[1];
      }
      if (!refSign) {
        const match = /var\s+ref_sign\s*=\s*["']([^"']+)["']/i.exec(playerHtml);
        if (match) refSign = match[1];
      }
  
      let videoType = "", kodikId = "", hash = "";
  
      let match = /vInfo\.type\s*=\s*['"]([^'"]+)['"]/i.exec(playerHtml);
      if (match) videoType = match[1];
  
      match = /vInfo\.hash\s*=\s*['"]([^'"]+)['"]/i.exec(playerHtml);
      if (match) hash = match[1];
  
      match = /vInfo\.id\s*=\s*['"]([^'"]+)['"]/i.exec(playerHtml);
      if (match) kodikId = match[1];
  
      if (!videoType) {
        match = /videoInfo\.type\s*=\s*['"]([^'"]+)['"]/i.exec(playerHtml);
        if (match) videoType = match[1];
      }
      if (!hash) {
        match = /videoInfo\.hash\s*=\s*['"]([^'"]+)['"]/i.exec(playerHtml);
        if (match) hash = match[1];
      }
      if (!kodikId) {
        match = /videoInfo\.id\s*=\s*['"]([^'"]+)['"]/i.exec(playerHtml);
        if (match) kodikId = match[1];
      }
      if (!kodikId) {
        match = /var\s+videoId\s*=\s*["']([^"']+)["']/i.exec(playerHtml);
        if (match) kodikId = match[1];
      }
  
      if (!d || !dSign || !pd || !pdSign || !ref || !refSign || !videoType || !hash || !kodikId) {
        throw new Error(`Kodik: required params not found, ${d} ${dSign} ${pd} ${pdSign} ${ref} ${refSign} ${videoType} ${hash} ${kodikId}`);
      }
  
      try {
        if (ref.indexOf("%") !== -1) {
          ref = decodeURIComponent(ref);
        }
      } catch (e) { }
  
      const ftorBody = {
        d: d,
        d_sign: dSign,
        pd: pd,
        pd_sign: pdSign,
        ref: ref,
        ref_sign: refSign,
        bad_user: "false",
        cdn_is_working: "true",
        type: videoType,
        hash: hash,
        id: kodikId,
        info: "{}"
      };
  
      const ftorResponse = await this.client.post(
        "https://kodikplayer.com/ftor",
        {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "Origin": "https://kodikplayer.com",
          "Referer": url
        },
        ftorBody
      );
      if (!ftorResponse.body) {
        throw new Error("Kodik: empty /ftor response");
      }
  
      let ftorData;
      try {
        ftorData = JSON.parse(ftorResponse.body);
      } catch (e) {
        throw new Error("Kodik: invalid /ftor JSON");
      }
  
      const links = ftorData.links;
      if (!links) {
        throw new Error("Kodik: links not found");
      }
  
      const result = [];
  
      for (const quality in links) {
        if (!links.hasOwnProperty(quality)) continue;
  
        const item = links[quality];
        if (!item) continue;
        const src = item[0].src;
        let url2 = this.normalizeUrl(this.rot18(src));
        url2 = url.replace(":hls", "").replace(":manifest.m3u8", "")
        result.push({
          url: url2,
          originalUrl: url,
          quality: quality
        });
      }
  
      result.sort(function (a, b) {
        const aQuality = parseInt(a.quality, 10);
        const bQuality = parseInt(b.quality, 10);
        if (isNaN(aQuality)) return 1;
        if (isNaN(bQuality)) return -1;
        return bQuality - aQuality;
      });
  
      return result;
    }
    async CVHParse(url){
      const match = url.match(/[?&]anime_id=(\d+)/);
      const animeId = match ? match[1] : null;
      const link = `https://plapi.cdnvideohub.com/api/v1/player/sv/playlist?pub=745&aggr=mali&id=${animeId}`
      const playerResponse = await this.client.get(link, this.getHeaders());
      const playerHtml = playerResponse.body;
      if (!playerHtml) {
        throw new Error("CVH: empty player page");}
      const items = JSON.parse(playerHtml).items;
      const match2 = url.match(/[?&]chapter=(\d+)/);
      const chNum = match2 ? match2[1] : null;
      let ch = items[chNum-1].vkId;
      
      const link2 = `https://plapi.cdnvideohub.com/api/v1/player/sv/video/${ch}`
      const playerResponse2 = await this.client.get(link2, this.getHeaders());
      const playerHLS = playerResponse2.body;
      if (!playerHLS) {
        throw new Error("CVH: empty vk response");}
      let hls = JSON.parse(playerHLS).sources.hlsUrl
      return {
        url: hls,
        quality: "auto",
        originalUrl: url,
        headers: this.getHeaders(),
      };
    }
    async SibnetParse(url){
      const playerResponse = await this.client.get(url);
      const playerHtml = playerResponse.body;
      if (!playerHtml) {
        throw new Error("Sibnet: empty player page");}
      const regex = /\/v\/[a-f0-9]+\/\d+\.mp4/i;
      const match = playerHtml.match(regex);
      const videoUrl = match ? match[0] : null;
      return {
        url: `https://video.sibnet.ru${videoUrl}`,
        originalUrl: url,
        quality: "auto",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          "Accept": "application/json, text/javascript, */*; q=0.01",
           "Referer": "https://video.sibnet.ru/"
        }
      }
    }
  
  
    async getVideoList(url) {
      let iframeUrl = this.normalizeUrl(url);
      let list = [];
      if (iframeUrl.indexOf("kodikplayer.com") != -1 || iframeUrl.indexOf("kodik.biz") != -1) {
        list = await this.kodikParse(url);
      } else if (iframeUrl.indexOf('iframeCVH')!==-1){
        const item = await this.CVHParse(iframeUrl);
        list.push(item);
      } else if (iframeUrl.indexOf('sibnet')!==-1){
        const item = await this.SibnetParse(iframeUrl);
        list.push(item);
      } else {
        throw new Error("YummyAnime: unsupported player: " + iframeUrl);
      }
      return list
    }
    decodeBase64(input) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let str = String(input).replace(/=+$/, '');
      let output = '';
  
      if (str.length % 4 === 1) {
        throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
      }
  
      for (
        let bc = 0, bs, buffer, idx = 0;
        (buffer = str.charAt(idx++));
        ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
          ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
          : 0
      ) {
        buffer = chars.indexOf(buffer);
      }
  
      return output;
    }
  
    rot18(value) {
      const originalSrc = value;
  
      // 1. Сдвиг букв (ROT18)
      const shiftedSrc = originalSrc.replace(/[a-zA-Z]/g, function (char) {
        const code = char.charCodeAt(0);
        const maxCode = char <= "Z" ? 90 : 122; // 90 = 'Z', 122 = 'z'
        const shiftedCode = code + 18;
  
        return String.fromCharCode(
          maxCode >= shiftedCode ? shiftedCode : shiftedCode - 26
        );
      });
  
      // 2. Декодирование из Base64 и присвоение обратно
      return this.decodeBase64(shiftedSrc);
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
        return [
            /*{
                type_name: "CheckBox",
                type: "HasAvailableChaptersFilter",
                name: "Has available chapters",
                value: ""
            },
            {
                type_name: "GroupFilter",
                type: "OriginalLanguageList",
                name: "Original language",
                state: [
                    ["Japanese (Manga)", "originalLanguage[]=ja"],
                ].map(x => ({ type_name: 'CheckBox', name: x[0], value: x[1] }))
            },
            {
                type_name: "GroupFilter",
                type: "ContentRatingList",
                name: "Content rating",
                state: [
                    ["Safe", "contentRating[]=safe"],
                ].map(x => ({ type_name: 'CheckBox', name: x[0], value: x[1], state: true }))
            },
            {
                type_name: "GroupFilter",
                type: "DemographicList",
                name: "Publication demographic",
                state: [
                    ["None", "publicationDemographic[]=none"],
                ].map(x => ({ type_name: 'CheckBox', name: x[0], value: x[1] }))
            },
            {
                type_name: "GroupFilter",
                type: "StatusList",
                name: "Status",
                state: [
                    ["Ongoing", "status[]=ongoing"],
                ].map(x => ({ type_name: 'CheckBox', name: x[0], value: x[1] }))
            },*/
            {
                type_name: "SortFilter",
                type: "SortFilter",
                name: "Sort",
                state: {
                    type_name: "SortState",
                    index: 0,
                    ascending: false
                },
                values: [
                    [
    [
        "Название",
        "title"
    ],
    [
        "Год выхода",
        "year"
    ],
    [
        "Рейтинг",
        "rating"
    ],
    [
        "Число оценивших",
        "rating_counters"
    ],
    [
        "Просмотры",
        "views"
    ],
    [
        "Топ",
        "top"
    ],
    [
        "Случайгл",
        "random"
    ],
    [
        "ID",
        "id"
    ]
],
                ].map(x => ({ type_name: 'SelectOption', name: x[0], value: x[1] }))
            },
            /*{
                type_name: "GroupFilter",
                type: "TagsFilter",
                name: "Tags mode",
                state: [
                    {
                        type_name: "SelectFilter",
                        type: "TagInclusionMode",
                        name: "Included tags mode",
                        state: 0,
                        values: [
                            ["AND", "includedTagsMode=AND"],
                            ["OR", "includedTagsMode=OR"]
                        ].map(x => ({ type_name: 'SelectOption', name: x[0], value: x[1] }))
                    },
                    {
                        type_name: "SelectFilter",
                        type: "TagExclusionMode",
                        name: "Excluded tags mode",
                        state: 1,
                        values: [
                            ["AND", "excludedTagsMode=AND"],
                            ["OR", "excludedTagsMode=OR"]
                        ].map(x => ({ type_name: 'SelectOption', name: x[0], value: x[1] }))
                    }]
            },
            {
                type_name: "GroupFilter",
                type: "ContentsFilter",
                name: "Content",
                state: [
                    ["Gore", "b29d6a3d-1569-4e7a-8caf-7557bc92cd5d"],
                ].map(x => ({ type_name: 'TriState', name: x[0], value: x[1] }))
            },
            {
                type_name: "GroupFilter",
                type: "FormatFilter",
                name: "Format",
                state: [
                    ["4-Koma", "b11fda93-8f1d-4bef-b2ed-8803d3733170"],
                ].map(x => ({ type_name: 'TriState', name: x[0], value: x[1] }))
            },*/
            {
                type_name: "GroupFilter",
                type: "GenreFilter",
                name: "Жанры",
                state: [
    ["bisenen","Би-сёнен"],
    ["dzesej","Дзёсей"],
    ["maho-sedze","Махо-сёдзе"],
    ["sedze","Сёдзе"],
    ["sedze-aj","Сёдзе-ай"],
    ["senen","Сёнен"],
    ["senen-aj","Сёнен-ай"],
    ["sejnen","Сейнен"],
    ["etti","Эччи"],
    ["vestern","Вестерн"],
    ["detektiv","Детектив"],
    ["drama","Драма"],
    ["komediya","Комедия"],
    ["parodiya","Пародия"],
    ["prestupnyj-mir","Преступный мир"],
    ["vori","Воры"],
    ["mafiya-yakudza","Мафия/Якудза"],
    ["ohotniki-za-golovami","Охотники за головами"],
    ["piraty","Пираты"],
    ["terroristy","Террористы"],
    ["ubijcy","Убийцы"],
    ["meha","Хема"],
    ["androidy","Андроиды"],
    ["pilotiruemye-roboty","Пилотируемые роботы"],
    ["silovye-kostyumy","Силовые костюмы"],
    ["ii","ИИ"],
    ["transformery","Трансформеры"],
    ["mistika","Мистика"],
    ["priklyucheniya","Приключения"],
    ["romantika","Романтика"],
    ["lyubovnyj-treugol-nik","Любовный треугольник"],
    ["triller","Триллер"],
    ["ugasy","ugasy"],
    ["fantastika","Фантастика"],
    ["inoplanetyane","Инопланетяне"],
    ["kiborgi","kiborgi"],
    ["kosmicheskie-priklyucheniya","Космические приключения"],
    ["puteshestviya-vo-vremeni","Путешествия во времени"],
    ["fentezi","Фентези"],
    ["al-ternativnaya-real-nost","Альтернативная реальность"],
    ["angely","Ангелы"],
    ["bogi","Боги"],
    ["vampiry","Вампиры"],
    ["ved-my","Ведьмы"],
    ["demony","Демоны"],
    ["drakony","Драконы"],
    ["zombi","Зомби"],
    ["magiya","Магия"],
    ["prizraki","Призраки"],
    ["rysalki","Русалки"],
    ["sovremennoe-fentezi","Современное фентези"],
    ["sukkuby","Суккубы"],
    ["temnoe-fentezi","Тёмное фентези"],
    ["temnye-el-fy","Тёмные эльфы"],
    ["fei","Феи"],
    ["celyj-fentezi-mir","celyj-fentezi-mir"],
    ["el-fy","Эльфы"],
    ["virtual-naya-real-nost","Виртуальная реальность"],
    ["parallel-nyj-mir","Парралельный мир"],
    ["ekshen","Экшен"],
    ["boevye-iskusstva","Боевые искусства"],
    ["nindzya","Ниндзя"],
    ["perestrelki","Перестрелкт"],
    ["proksi-boi","proksi-boi"],
    ["samurai","Самураи"],
    ["srazheniya-na-mechah","Сражения на мехах"],
    ["supersposobnosti","Суперспособности"],
    ["al-ternativnaya-istoriya","Альтернативная история"],
    ["antivojna","Антивоенная"],
    ["antiutopiya","Антиутопия"],
    ["vojna","Война"],
    ["voennaya-tematika","Военная тематика"],
    ["garem","Гарем"],
    ["iskusstvo","Искусство"],
    ["muzyka","Музыка"],
    ["istoricheskij","Историческое"],
    ["kiberpank","Киберпанк"],
    ["kulinariya","Кулинария"],
    ["lolikon","Лоликон"],
    ["nelinejnyj-syuzhet","Нелинейный сюжет"],
    ["povsednevnost","Повседневность"],
    ["politika","Политика"],
    ["policejskie","Полицейское"],
    ["postapokaliptika","Постапокалипсис"],
    ["rossiya-v-anime","Россия в аниме"],
    ["sport","Спорт"],
    ["basketbol","Баскетбол"],
    ["stimpank","Стимпанк"],
    ["tajnyj-zagovor","Тайный заговор"],
    ["shkola","Школа"],
    ["garem-dlya-devochek","Гарем(для девушек)"],
    ["lyudi-zveri","Зверолюди"],
    ["psihologiya","Психология"],
    ["manga","Манга"],
    ["erotica","Эротика"],
    ["ne-yaponskoe","Неяпонское"],
    ["trap","Трап"],
    ["sverh-estestvennoe","Сверхъестественное"],
    ["igry","Игры"],
    ["isekai","Исекай"],
    ["chinese3d","Китайское"],
    ["motorcycles","Мотоциклы"],
    ["badguys","Плохие парни"],
    ["bezumie","Безумие"]
].map(x => ({ type_name: 'TriState', name: x[1], value: x[0] }))
            },
            {
                type_name: "GroupFilter",
                type: "ExcludeGenreFilter",
                name: "Исключить жанры",
                state: [
    ["bisenen","Би-сёнен"],
    ["dzesej","Дзёсей"],
    ["maho-sedze","Махо-сёдзе"],
    ["sedze","Сёдзе"],
    ["sedze-aj","Сёдзе-ай"],
    ["senen","Сёнен"],
    ["senen-aj","Сёнен-ай"],
    ["sejnen","Сейнен"],
    ["etti","Эччи"],
    ["vestern","Вестерн"],
    ["detektiv","Детектив"],
    ["drama","Драма"],
    ["komediya","Комедия"],
    ["parodiya","Пародия"],
    ["prestupnyj-mir","Преступный мир"],
    ["vori","Воры"],
    ["mafiya-yakudza","Мафия/Якудза"],
    ["ohotniki-za-golovami","Охотники за головами"],
    ["piraty","Пираты"],
    ["terroristy","Террористы"],
    ["ubijcy","Убийцы"],
    ["meha","Хема"],
    ["androidy","Андроиды"],
    ["pilotiruemye-roboty","Пилотируемые роботы"],
    ["silovye-kostyumy","Силовые костюмы"],
    ["ii","ИИ"],
    ["transformery","Трансформеры"],
    ["mistika","Мистика"],
    ["priklyucheniya","Приключения"],
    ["romantika","Романтика"],
    ["lyubovnyj-treugol-nik","Любовный треугольник"],
    ["triller","Триллер"],
    ["ugasy","ugasy"],
    ["fantastika","Фантастика"],
    ["inoplanetyane","Инопланетяне"],
    ["kiborgi","kiborgi"],
    ["kosmicheskie-priklyucheniya","Космические приключения"],
    ["puteshestviya-vo-vremeni","Путешествия во времени"],
    ["fentezi","Фентези"],
    ["al-ternativnaya-real-nost","Альтернативная реальность"],
    ["angely","Ангелы"],
    ["bogi","Боги"],
    ["vampiry","Вампиры"],
    ["ved-my","Ведьмы"],
    ["demony","Демоны"],
    ["drakony","Драконы"],
    ["zombi","Зомби"],
    ["magiya","Магия"],
    ["prizraki","Призраки"],
    ["rysalki","Русалки"],
    ["sovremennoe-fentezi","Современное фентези"],
    ["sukkuby","Суккубы"],
    ["temnoe-fentezi","Тёмное фентези"],
    ["temnye-el-fy","Тёмные эльфы"],
    ["fei","Феи"],
    ["celyj-fentezi-mir","celyj-fentezi-mir"],
    ["el-fy","Эльфы"],
    ["virtual-naya-real-nost","Виртуальная реальность"],
    ["parallel-nyj-mir","Парралельный мир"],
    ["ekshen","Экшен"],
    ["boevye-iskusstva","Боевые искусства"],
    ["nindzya","Ниндзя"],
    ["perestrelki","Перестрелкт"],
    ["proksi-boi","proksi-boi"],
    ["samurai","Самураи"],
    ["srazheniya-na-mechah","Сражения на мехах"],
    ["supersposobnosti","Суперспособности"],
    ["al-ternativnaya-istoriya","Альтернативная история"],
    ["antivojna","Антивоенная"],
    ["antiutopiya","Антиутопия"],
    ["vojna","Война"],
    ["voennaya-tematika","Военная тематика"],
    ["garem","Гарем"],
    ["iskusstvo","Искусство"],
    ["muzyka","Музыка"],
    ["istoricheskij","Историческое"],
    ["kiberpank","Киберпанк"],
    ["kulinariya","Кулинария"],
    ["lolikon","Лоликон"],
    ["nelinejnyj-syuzhet","Нелинейный сюжет"],
    ["povsednevnost","Повседневность"],
    ["politika","Политика"],
    ["policejskie","Полицейское"],
    ["postapokaliptika","Постапокалипсис"],
    ["rossiya-v-anime","Россия в аниме"],
    ["sport","Спорт"],
    ["basketbol","Баскетбол"],
    ["stimpank","Стимпанк"],
    ["tajnyj-zagovor","Тайный заговор"],
    ["shkola","Школа"],
    ["garem-dlya-devochek","Гарем(для девушек)"],
    ["lyudi-zveri","Зверолюди"],
    ["psihologiya","Психология"],
    ["manga","Манга"],
    ["erotica","Эротика"],
    ["ne-yaponskoe","Неяпонское"],
    ["trap","Трап"],
    ["sverh-estestvennoe","Сверхъестественное"],
    ["igry","Игры"],
    ["isekai","Исекай"],
    ["chinese3d","Китайское"],
    ["motorcycles","Мотоциклы"],
    ["badguys","Плохие парни"],
    ["bezumie","Безумие"]
].map(x => ({ type_name: 'TriState', name: x[1], value: x[0] }))
            },/*
            {
                type_name: "GroupFilter",
                type: "ThemeFilter",
                name: "Theme",
                state: [
                    ["Aliens", "e64f6742-c834-471d-8d72-dd51fc02b835"],
                ].map(x => ({ type_name: 'TriState', name: x[0], value: x[1] }))
            },
*/
        ];
    }
    getSourcePreferences() {
      throw new Error("getSourcePreferences not implemented");
    }
  }
