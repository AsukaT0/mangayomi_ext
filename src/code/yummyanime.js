const mangayomiSources = [
  {
    name: "YummyAnime",
    lang: "ru",
    baseUrl: "https://ru.yummyani.me",
    apiUrl: "https://api.yani.tv",
    iconUrl: "https://ru.yummyani.me/favicon.ico",
    version: "0.0.4",
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
      const paramArray = [];

      for (const key in query) {
        if (query[key] !== undefined && query[key] !== null) {
          if (Array.isArray(query[key])) {
            query[key].map((i, _) => {
              paramArray.push(`${key}=${encodeURIComponent(String(i))}`);
            })
          } else {
            paramArray.push(`${key}=${encodeURIComponent(String(query[key]))}`);
          }
        }
      }

      const params = paramArray.join('&');
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
    const response = await this.yummyGet(`/anime?offset=${(page - 1) * 20}`);
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
    const response = await this.yummyGet("/anime?sort_forward=false&sort=id");
    const items = this.extractAnimeArray1(response);
    return {
      list: items,
      hasNextPage: items.length == 20
    };
  }

  async search(query, page, filters) {
    const limit = 30;
    const offset = (page - 1) * limit;
    
    
    let 
      genres = [], 
      exgenres = [], 
      status = [], 
      types = [],
      translate = [],
      season = [];


    if (filters && Array.isArray(filters)) {
      filters.forEach(filter => {
        if (filter.type === "GenreFilter" && Array.isArray(filter.state)) {
          filter.state.map((item, index) => {
            if (item.value) {
              if (item.state === 1) {
                genres.push(item.value);
              }
              if (item.state === 2) {
                exgenres.push(item.value);
              }
            }
          })
        } else if (filter.type === "StatusList" && Array.isArray(filter.state)) {
          filter.state.filter(e => e.state).map((item, index) => {
            if (item.value) {
              status.push(item.value);
            }
          })
        } else if (filter.type === "TypesList" && Array.isArray(filter.state)) {
          filter.state.filter(e => e.state).map((item, index) => {
            if (item.value) {
              types.push(item.value);
            }
          })
        }
        else if (filter.type === "TranslatesList" && Array.isArray(filter.state)) {
          filter.state.filter(e => e.state).map((item, index) => {
            if (item.value) {
              translate.push(item.value);
            }
          })
        }
        else if (filter.type === "SeasonList" && Array.isArray(filter.state)) {
          filter.state.filter(e => e.state).map((item, index) => {
            if (item.value) {
              season.push(item.value);
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
    if (exgenres != []) {
      params.exclude_genres = exgenres;
    }
    if (genres != []) {
      params.genres = genres;
    }
    if (status != []) {
      params.status = status;
    }
    if (types != []) {
      params.types = types;
    }
    if (translate != []) {
      params.translates = translate;
    }
    if (season != []) {
      params.season = season;
    }
    
    season
    const response = await this.yummyGet("/anime", params);

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
      const priorityA = this.getPlayerPriority(a);
      const priorityB = this.getPlayerPriority(b);
      return priorityA - priorityB;
    });

    const episodes = [];
    const addedEpisodeNumbers = new Set(); // Mножество для отслеживания добавленных серий

    for (const video of videos) {
      if (!video || video.number === undefined || video.number === null) {
        continue;
      }

      // Если серия с таким номером уже добавлена — пропускаем


      let dubbing = video.data && video.data.dubbing ? video.data.dubbing : "";
      let episodeName = String(video.number);

      if (dubbing) {
        episodeName += " — " + dubbing;
      }
      let chapterUrl = `${this.normalizeUrl(video.iframe_url)}`;
      if (chapterUrl.includes('iframeCVH')) {
        chapterUrl += `&chapter=${episodeName}`;
      }
      if (addedEpisodeNumbers.has(episodeName)) {
        continue;
      }
      episodes.push({
        name: episodeName,
        url: chapterUrl,
        scanlator: dubbing || "YummyAnime",
        dateUpload: video.date ? String(video.date) : null
      });

      // Фиксируем, что серия с этим номером обработана
      addedEpisodeNumbers.add(episodeName);
    }

    let type = 16;
    switch (anime.type.value) {
      case 1:
      case 6:
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
      case 7:
        type = 11;
        break;
    }

    return {
      name: anime.title || "",
      description: anime.description || "",
      imageUrl: imageTile,
      author: "",
      type: type,
      genre: this.extractGenres(anime),
      status: this.convertStatus(anime),
      episodes: episodes
    };
  }
  getPlayerPriority(video) {
    const player = (video.data?.player || "").toLowerCase();
    const url = (video.iframe_url || "").toLowerCase();

    if (player.includes('kodik') || url.includes('kodik')) return 1; // Самый высокий приоритет
    if (player.includes('sibnet') || url.includes('sibnet')) return 2;
    if (player.includes('iframeCVH') || url.includes('iframeCVH')) return 3;
    if (player.includes('alloha') || url.includes('alloha')) return 4;

    return 99; // Для всех остальных плееров
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
      url2 = url2.replace(":hls", "").replace(":manifest.m3u8", "")
      result.push({
        url: url2,
        originalUrl: url.replace("720", quality).replace("360", quality).replace("480", quality),
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
  async CVHParse(url) {
    const match = url.match(/[?&]anime_id=(\d+)/);
    const animeId = match ? match[1] : null;
    const link = `https://plapi.cdnvideohub.com/api/v1/player/sv/playlist?pub=745&aggr=mali&id=${animeId}`
    const playerResponse = await this.client.get(link, this.getHeaders());
    const playerHtml = playerResponse.body;
    if (!playerHtml) {
      throw new Error("CVH: empty player page");
    }
    const items = JSON.parse(playerHtml).items;
    const match2 = url.match(/[?&]chapter=(\d+)/);
    const chNum = match2 ? match2[1] : null;
    let ch = items[chNum - 1].vkId;

    const link2 = `https://plapi.cdnvideohub.com/api/v1/player/sv/video/${ch}`
    const playerResponse2 = await this.client.get(link2, this.getHeaders());
    const playerHLS = playerResponse2.body;
    if (!playerHLS) {
      throw new Error("CVH: empty vk response");
    }
    let hls = JSON.parse(playerHLS).sources.hlsUrl
    return {
      url: hls,
      quality: "auto",
      originalUrl: url,
      headers: this.getHeaders(),
    };
  }

  async SibnetParse(url) {
    const playerResponse = await this.client.get(url);
    const playerHtml = playerResponse.body;
    if (!playerHtml) {
      throw new Error("Sibnet: empty player page");
    }
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

  getToken(url) {
    const match = url.match(/[?&]token=([^&]+)/);
    const token = match ? match[1] : null;
    return token;
  }

  getTranslation(url) {
    const match = url.match(/[?&]translation=([^&]+)/);
    const token = match ? match[1] : null;
    return token - 0;
  }

  getSeasons(url) {
    const match = url.match(/[?&]season=([^&]+)/);
    const token = match ? match[1] : null;
    return token - 0;
  }

  getEpisode(url) {
    const match = url.match(/[?&]episode=([^&]+)/);
    const token = match ? match[1] : null;
    return token - 0;
  }

  getviewporti(playerHtml) {
    const match = playerHtml.match(
      /<meta\b[^>]*\bname\s*=\s*["']viewporti["'][^>]*\bcontent\s*=\s*["']([^"']+)["'][^>]*>/i
    );

    if (match) return match[1];

    // Поддерживаем и обратный порядок атрибутов.
    const tags = playerHtml.match(/<meta\b[^>]*>/gi) || [];

    for (const tag of tags) {
      if (!/\bname\s*=\s*["']viewporti["']/i.test(tag)) continue;

      const content = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i);
      if (content) return content[1];
    }

    return "";
  }

  buildBorthSuffix(viewporti) {
    if (!viewporti) {
      throw new Error("Alloha: viewporti is empty");
    }

    return this.ycTransform(
      this.ycInverseTransform(
        this.yfInverseTransform(viewporti)
      )
    );
  }

  generateBorth(viewporti) {
    return this.AcceptsControlsPrefix + "|" +
      this.buildBorthSuffix(viewporti);
  }

  async AllohaParse(url) {
    // ==========================================
    // 1. Получение страницы плеера
    // ==========================================
    const playerResponse = await this.client.get(url, {
      "User-Agent": this.getHeaders()["User-Agent"],
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Referer": this.YUMMY_URL
    });

    const playerHtml = playerResponse.body;

    if (!playerHtml) {
      throw new Error("Alloha: пустая страница плеера");
    }

    // ==========================================
    // 2. Получение параметров
    // ==========================================
    const token = decodeURIComponent(this.getToken(url) || "");
    const translationId = this.getTranslation(url);

    if (!token) {
      throw new Error("Alloha: token не найден");
    }

    if (isNaN(translationId)) {
      throw new Error("Alloha: translation не найден");
    }

    const viewporti = this.getviewporti(playerHtml);

    if (!viewporti) {
      throw new Error("Alloha: viewporti не найден");
    }

    // Формирование Borth
    const borth = this.generateBorth(viewporti);

    // ==========================================
    // 3. Получение fileList
    // ==========================================
    const fileListMatch = playerHtml.match(
      /(?:const|let|var)\s+fileList\s*=\s*JSON\.parse\(\s*(['"])((?:\\.|(?!\1)[\s\S])*)\1\s*\)/i
    );

    if (!fileListMatch) {
      throw new Error("Alloha: fileList не найден");
    }

    let fileListData;

    try {
      let jsonString = fileListMatch[2];

      // Восстановление экранированной JS-строки
      jsonString = jsonString
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");

      jsonString = jsonString
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");

      fileListData = JSON.parse(jsonString);
    } catch (e) {
      throw new Error("Alloha: ошибка разбора fileList: " + e);
    }

    // ==========================================
    // 4. Поиск нужного перевода
    // ==========================================
    const entries = [];
    const visited = [];

    const findTranslation = (node, version) => {
      if (!node || typeof node !== "object") return;

      if (visited.indexOf(node) !== -1) return;
      visited.push(node);

      if (
        node.id_translation !== undefined &&
        String(node.id_translation) === String(translationId)
      ) {
        entries.push({
          data: node,
          version: version || "auto"
        });
        return;
      }

      if (Array.isArray(node)) {
        for (const item of node) {
          findTranslation(item, version);
        }
        return;
      }

      for (const key in node) {
        if (!Object.prototype.hasOwnProperty.call(node, key)) continue;

        findTranslation(
          node[key],
          version || key
        );
      }
    };

    findTranslation(
      fileListData.all && fileListData.all.theatrical
        ? fileListData.all.theatrical
        : fileListData,
      ""
    );

    if (entries.length === 0) {
      throw new Error(
        "Alloha: перевод " + translationId + " не найден"
      );
    }

    // ==========================================
    // 5. Определение ID фильма
    // ==========================================
    const findMovieId = (node) => {
      const idKeys = [
        "movie_id",
        "id_movie",
        "movieId",
        "idMovie",
        "id_item",
        "idItem",
        "video_id",
        "id_video",
        "file_id",
        "id_file"
      ];

      const checked = [];

      const searchId = (value) => {
        if (!value || typeof value !== "object") return null;
        if (checked.indexOf(value) !== -1) return null;

        checked.push(value);

        for (const key of idKeys) {
          const id = value[key];

          if (
            id !== undefined &&
            id !== null &&
            /^\d+$/.test(String(id)) &&
            String(id) !== String(translationId)
          ) {
            return String(id);
          }
        }

        for (const key in value) {
          if (!Object.prototype.hasOwnProperty.call(value, key)) continue;

          const result = searchId(value[key]);
          if (result) return result;
        }

        return null;
      };

      // Сначала проверяем HTML на готовый endpoint
      const htmlMatch = playerHtml.match(
        /\/bnsi\/movies\/(\d+)/i
      );

      if (htmlMatch) return htmlMatch[1];

      // Затем проверяем HTML на ID
      const htmlId = playerHtml.match(
        /(?:movie_id|id_movie|movieId|idMovie)\s*[:=]\s*["']?(\d+)/i
      );

      if (htmlId) return htmlId[1];

      return searchId(node);
    };

    // ==========================================
    // 6. POST-запрос к Alloha
    // ==========================================
    const originMatch = url.match(/^(https?:\/\/[^/]+)/i);
    const origin = originMatch
      ? originMatch[1]
      : "https://alloha.yani.tv";

    const results = [];
    const requestedIds = [];

    for (const entryInfo of entries) {
      const entry = entryInfo.data;

      const movieId = findMovieId(entry);

      if (!movieId) {
        throw new Error(
          "Alloha: не удалось определить ID фильма"
        );
      }

      if (requestedIds.indexOf(movieId) !== -1) continue;
      requestedIds.push(movieId);

      const postUrl = origin + "/bnsi/movies/" + movieId;

      const postHeaders = {
        "User-Agent": this.getHeaders()["User-Agent"],
        "Accept": "*/*",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Origin": origin,
        "Referer": url,
        "Borth": borth
      };

      // Тело POST-запроса
      const postBody = {
        token: token,
        av1: "true",
        autoplay: "0",
        audio: "",
        subtitle: ""
      };

      const response = await this.client.post(
        postUrl,
        postHeaders,
        postBody
      );

      if (!response || !response.body) {
        throw new Error(
          "Alloha: пустой ответ POST " + postUrl
        );
      }

      let responseData;

      try {
        responseData = JSON.parse(response.body);
      } catch (e) {
        throw new Error(
          "Alloha: ошибка JSON ответа: " +
          String(response.body).substring(0, 300)
        );
      }

      // ==========================================
      // 7. Извлечение видеоссылок
      // ==========================================
      const mediaPattern =
        /\.(?:m3u8|mp4|mpd|m4v)(?:[?#]|$)/i;

      const visitedNodes = [];

      const normalizeVideoUrl = (value) => {
        let videoUrl = String(value || "")
          .replace(/\\\//g, "/")
          .replace(/&amp;/g, "&")
          .trim();

        if (videoUrl.indexOf("//") === 0) {
          videoUrl = "https:" + videoUrl;
        }

        if (videoUrl.charAt(0) === "/") {
          videoUrl = origin + videoUrl;
        }

        return videoUrl;
      };

      const addVideo = (value, quality) => {
        const videoUrl = normalizeVideoUrl(value);

        if (
          !/^https?:\/\//i.test(videoUrl) ||
          !mediaPattern.test(videoUrl)
        ) {
          return;
        }

        if (results.some(item => item.url === videoUrl)) {
          return;
        }

        results.push({
          url: videoUrl,
          originalUrl: url,
          quality: quality || entryInfo.version || "auto",
          headers: {
            "User-Agent": this.getHeaders()["User-Agent"],
            "Referer": url,
            "Origin": origin
          }
        });
      };

      const scanResponse = (node, quality, depth) => {
        if (
          node === null ||
          node === undefined ||
          depth > 20
        ) {
          return;
        }

        if (typeof node === "string") {
          const text = node.replace(/\\\//g, "/");

          const matches = text.match(
            /(?:https?:)?\/\/[^\s"'<>\\]+/gi
          ) || [];

          if (matches.length > 0) {
            for (const match of matches) {
              addVideo(match, quality);
            }
          } else if (mediaPattern.test(text)) {
            addVideo(text, quality);
          }

          return;
        }

        if (typeof node !== "object") return;

        if (visitedNodes.indexOf(node) !== -1) return;
        visitedNodes.push(node);

        if (Array.isArray(node)) {
          for (const item of node) {
            scanResponse(item, quality, depth + 1);
          }
          return;
        }

        let currentQuality = quality;

        if (
          node.quality ||
          node.resolution ||
          node.video_quality ||
          node.label
        ) {
          currentQuality =
            node.quality ||
            node.resolution ||
            node.video_quality ||
            node.label;
        }

        for (const key in node) {
          if (!Object.prototype.hasOwnProperty.call(node, key)) continue;

          let nextQuality = currentQuality;

          if (/^(2160|1440|1080|720|480|360)p?$/i.test(key)) {
            nextQuality = key;
          }

          scanResponse(
            node[key],
            nextQuality,
            depth + 1
          );
        }
      };

      scanResponse(responseData, entryInfo.version, 0);
    }

    // ==========================================
    // 8. Сортировка качества
    // ==========================================
    const qualityNumber = (value) => {
      const match = String(value).match(/\d+/);
      return match ? Number(match[0]) : 0;
    };

    results.sort((a, b) => {
      return qualityNumber(b.quality) - qualityNumber(a.quality);
    });

    if (results.length === 0) {
      throw new Error(
        "Alloha: POST выполнен, но видеоссылки не найдены"
      );
    }

    return results;
  }

  async getVideoList(url) {
    const iframeUrl = this.normalizeUrl(url);
    let list = [];

    if (
      iframeUrl.includes("kodikplayer.com") ||
      iframeUrl.includes("kodik.biz")
    ) {
      list = await this.kodikParse(iframeUrl);
    } else if (iframeUrl.includes("iframeCVH")) {
      list.push(await this.CVHParse(iframeUrl));
    } else if (iframeUrl.includes("sibnet")) {
      list.push(await this.SibnetParse(iframeUrl));
    } else if (iframeUrl.includes("alloha.yani.tv")) {
      list = await this.AllohaParse(iframeUrl);
    } else {
      throw new Error("YummyAnime: unsupported player: " + iframeUrl);
    }

    return list;
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
      {
        type_name: "GroupFilter",
        type: "SeasonList",
        name: "Сезон",
        state: [
          ["Зима", "winter"],
          ["Осень", "fall"],
          ["Лето", "summer"],
          ["Весна", "spring"]
        ].map(x => ({ type_name: 'CheckBox', name: x[0], value: x[1] }))
      },
      {
        type_name: "GroupFilter",
        type: "StatusList",
        name: "Статус",
        state: [
          ["Вышло", "released"],
          ["Выходит", "ongoing"],
          ["Анонс", "announcement"]
        ].map(x => ({ type_name: 'CheckBox', name: x[0], value: x[1] }))
      },
      {
        type_name: "GroupFilter",
        type: "TranslatesList",
        name: "Перевод",
        state: [
          ["Полный", "full"],
          ["Дубляж", "dubbing"],
          ["Многоголосый", "multivoice"],
          ["Одноголосый", "onevoice"],
          ["Двухголосый", "twovoice"],
          ["Сингл", "single"],
          ["Субтитры", "subtitles"],
          ["Дуэт", "duet"],
        ].map(x => ({ type_name: 'CheckBox', name: x[0], value: x[1] }))
      },
      {
        type_name: "GroupFilter",
        type: "TypesList",
        name: "Тип",
        state: [
          ["Сериал", "tv"],
          ["Фильм", "movie"],
          ["Короткий фильм", "shortfilm"],
          ["OVA", "ova"],
          ["ONA", "ona"],
          ["Короткий сериал", "shorttv"],
          ["Спешл", "special"]
        ].map(x => ({ type_name: 'CheckBox', name: x[0], value: x[1] }))
      },
      {
        type_name: "GroupFilter",
        type: "GenreFilter",
        name: "Жанры",
        state: [
          ["bisenen", "Би-сёнен"],
          ["dzesej", "Дзёсей"],
          ["maho-sedze", "Махо-сёдзе"],
          ["sedze", "Сёдзе"],
          ["sedze-aj", "Сёдзе-ай"],
          ["senen", "Сёнен"],
          ["senen-aj", "Сёнен-ай"],
          ["sejnen", "Сейнен"],
          ["etti", "Эччи"],
          ["vestern", "Вестерн"],
          ["detektiv", "Детектив"],
          ["drama", "Драма"],
          ["komediya", "Комедия"],
          ["parodiya", "Пародия"],
          ["prestupnyj-mir", "Преступный мир"],
          ["vori", "Воры"],
          ["mafiya-yakudza", "Мафия/Якудза"],
          ["ohotniki-za-golovami", "Охотники за головами"],
          ["piraty", "Пираты"],
          ["terroristy", "Террористы"],
          ["ubijcy", "Убийцы"],
          ["meha", "Хема"],
          ["androidy", "Андроиды"],
          ["pilotiruemye-roboty", "Пилотируемые роботы"],
          ["silovye-kostyumy", "Силовые костюмы"],
          ["ii", "ИИ"],
          ["transformery", "Трансформеры"],
          ["mistika", "Мистика"],
          ["priklyucheniya", "Приключения"],
          ["romantika", "Романтика"],
          ["lyubovnyj-treugol-nik", "Любовный треугольник"],
          ["triller", "Триллер"],
          ["ugasy", "ugasy"],
          ["fantastika", "Фантастика"],
          ["inoplanetyane", "Инопланетяне"],
          ["kiborgi", "kiborgi"],
          ["kosmicheskie-priklyucheniya", "Космические приключения"],
          ["puteshestviya-vo-vremeni", "Путешествия во времени"],
          ["fentezi", "Фентези"],
          ["al-ternativnaya-real-nost", "Альтернативная реальность"],
          ["angely", "Ангелы"],
          ["bogi", "Боги"],
          ["vampiry", "Вампиры"],
          ["ved-my", "Ведьмы"],
          ["demony", "Демоны"],
          ["drakony", "Драконы"],
          ["zombi", "Зомби"],
          ["magiya", "Магия"],
          ["prizraki", "Призраки"],
          ["rysalki", "Русалки"],
          ["sovremennoe-fentezi", "Современное фентези"],
          ["sukkuby", "Суккубы"],
          ["temnoe-fentezi", "Тёмное фентези"],
          ["temnye-el-fy", "Тёмные эльфы"],
          ["fei", "Феи"],
          ["celyj-fentezi-mir", "celyj-fentezi-mir"],
          ["el-fy", "Эльфы"],
          ["virtual-naya-real-nost", "Виртуальная реальность"],
          ["parallel-nyj-mir", "Парралельный мир"],
          ["ekshen", "Экшен"],
          ["boevye-iskusstva", "Боевые искусства"],
          ["nindzya", "Ниндзя"],
          ["perestrelki", "Перестрелкт"],
          ["proksi-boi", "proksi-boi"],
          ["samurai", "Самураи"],
          ["srazheniya-na-mechah", "Сражения на мехах"],
          ["supersposobnosti", "Суперспособности"],
          ["al-ternativnaya-istoriya", "Альтернативная история"],
          ["antivojna", "Антивоенная"],
          ["antiutopiya", "Антиутопия"],
          ["vojna", "Война"],
          ["voennaya-tematika", "Военная тематика"],
          ["garem", "Гарем"],
          ["iskusstvo", "Искусство"],
          ["muzyka", "Музыка"],
          ["istoricheskij", "Историческое"],
          ["kiberpank", "Киберпанк"],
          ["kulinariya", "Кулинария"],
          ["lolikon", "Лоликон"],
          ["nelinejnyj-syuzhet", "Нелинейный сюжет"],
          ["povsednevnost", "Повседневность"],
          ["politika", "Политика"],
          ["policejskie", "Полицейское"],
          ["postapokaliptika", "Постапокалипсис"],
          ["rossiya-v-anime", "Россия в аниме"],
          ["sport", "Спорт"],
          ["basketbol", "Баскетбол"],
          ["stimpank", "Стимпанк"],
          ["tajnyj-zagovor", "Тайный заговор"],
          ["shkola", "Школа"],
          ["garem-dlya-devochek", "Гарем(для девушек)"],
          ["lyudi-zveri", "Зверолюди"],
          ["psihologiya", "Психология"],
          ["manga", "Манга"],
          ["erotica", "Эротика"],
          ["ne-yaponskoe", "Неяпонское"],
          ["trap", "Трап"],
          ["sverh-estestvennoe", "Сверхъестественное"],
          ["igry", "Игры"],
          ["isekai", "Исекай"],
          ["chinese3d", "Китайское"],
          ["motorcycles", "Мотоциклы"],
          ["badguys", "Плохие парни"],
          ["bezumie", "Безумие"]
        ].map(x => ({ type_name: 'TriState', name: x[1], value: x[0] }))
      },
    ];
  }
  getSourcePreferences() {
    throw new Error("getSourcePreferences not implemented");
  }



  AcceptsControlsPrefix = "9badb2c5dd28e9cd0bed84e7391523d9d308a48b690428dae6049233218645d9";

  getGroup(index, maxGroup, inverse = false) {
    if (index === 0) {
      return inverse ? maxGroup : 0;
    }

    if (inverse) {
      let group = 0;
      while ((index & 1) === 0) {
        group++;
        index >>= 1;
      }
      return group;
    } else {
      let group = 1;
      while (index > 1) {
        group++;
        index >>= 1;
      }
      return group;
    }
  }

  yfInverseTransform(value) {
    const length = value ? value.length : 0;
    if (length <= 0) return "";

    let maxGroup = 0;
    while ((1 << maxGroup) < length) maxGroup++;

    const counts = new Array(maxGroup + 1).fill(0);
    for (let i = 0; i < length; i++) {
      counts[this.getGroup(i, maxGroup, false)]++;
    }

    const slices = new Array(maxGroup + 1);
    let offset = 0;
    for (let group = maxGroup; group >= 0; group--) {
      const count = counts[group];
      slices[group] = value.substring(offset, offset + count);
      offset += count;
    }

    const positions = new Array(maxGroup + 1).fill(0);
    const output = new Array(length);
    for (let i = 0; i < length; i++) {
      const group = this.getGroup(i, maxGroup, false);
      output[i] = slices[group][positions[group]++];
    }

    return output.join("");
  }

  ycInverseTransform(value) {
    const length = value ? value.length : 0;
    if (length <= 0) return "";

    let maxGroup = 0;
    while ((1 << maxGroup) < length) maxGroup++;

    const counts = new Array(maxGroup + 1).fill(0);
    for (let i = 0; i < length; i++) {
      counts[this.getGroup(i, maxGroup, true)]++;
    }

    const slices = new Array(maxGroup + 1);
    let offset = 0;
    for (let group = 0; group <= maxGroup; group++) {
      const count = counts[group];
      slices[group] = value.substring(offset, offset + count);
      offset += count;
    }

    const positions = new Array(maxGroup + 1).fill(0);
    const output = new Array(length);
    for (let i = 0; i < length; i++) {
      const group = this.getGroup(i, maxGroup, true);
      output[i] = slices[group][positions[group]++];
    }

    return output.join("");
  }

  isPrime(value) {
    if (value < 2) return false;
    if (value % 2 === 0) return value === 2;
    for (let factor = 3; factor * factor <= value; factor += 2) {
      if (value % factor === 0) return false;
    }
    return true;
  }

  ycTransform(value) {
    const length = value ? value.length : 0;
    if (length <= 0) return "";

    let modulus = Math.max(2, length + 1);
    while (!this.isPrime(modulus)) modulus++;

    const used = new Array(length).fill(false);
    const order = [];
    let cursor = 0;

    while (order.length < length) {
      cursor = (cursor + 2) % modulus;
      if (cursor < length && !used[cursor]) {
        order.push(cursor);
        used[cursor] = true;
      }
    }

    const output = new Array(length);
    for (let i = 0; i < length; i++) {
      output[order[i]] = value[i];
    }

    return output.join("");
  }

  buildBorthSuffix(viewporti) {
    return this.ycTransform(this.ycInverseTransform(this.yfInverseTransform(viewporti)));
  }

  generateBorth(viewporti) {
    const suffix = this.buildBorthSuffix(viewporti);
    return this.AcceptsControlsPrefix + "|" + suffix;
  }
}