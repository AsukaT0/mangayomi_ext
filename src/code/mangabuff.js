const mangayomiSources = [
  {
    name: "MangaBuff",
    langs: ["ru"],
    baseUrl: "https://mangabuff.ru",
    apiUrl: "",
    iconUrl: "https://mangabuff.ru/favicon.ico",
    typeSource: "single",
    itemType: 0,
    version: "1.0.3",
    pkgPath: "manga/src/ru/mangabuff.js"
  }
];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }
parseChapters(document) {
  const chapters = [];
  

  // Берем элементы глав и ссылки внутри них
  let elements = document.select(".chapters__item");

  if (elements.length === 0) {
    elements = document.select(".chapter-item");
  }

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];

    // 1. Получение URL
    let url = this.getElementAttr(element, "href");
    if (!url) {
      const linkEl = element.select("a");
      if (linkEl.length > 0) {
        url = this.getElementAttr(linkEl[0], "href");
      }
    }
    if (!url) continue;

    url = this.absoluteUrl(url);

    // 2. Номер главы (сначала из data-атрибута)
    let number = this.getElementAttr(element, "data-chapter");
    if (number) {
      number = number.trim();
    }

    // Извлечение номера из текста .chapters__value / .chapters__name
    if (!number) {
      const value = element.select(".chapters__value, .chapters__number");
      if (value.length > 0) {
        const text = this.getElementText(value[0]).trim();
        const match = text.match(/(\d+(?:\.\d+)?)/);
        if (match) number = match[1];
      }
    }

    // Извлечение из URL
    
    if (!number) {
      const match = url.match(/\/(\d+(?:\.\d+)?)\/?$/);
      if (match) number = match[1];
    }

    
    // 4. Дополнительное название
    let extraName = "";
    const nameElements = element.select(".chapters__name");
    if (nameElements.length > 0) {
      extraName = this.getElementText(nameElements[0]).trim();
    }

    // 5. Название главы
    let name = number ? `Глава ${number}` : "Глава";
    if (extraName && extraName !== number) {
      name += ` - ${extraName}`;
    }

    // 6. Дата
    let dateText = this.getElementAttr(element, "data-chapter-date");
    if (!dateText) {
      const dateElements = element.select(".chapters__add-date, .chapters__date");
      if (dateElements.length > 0) {
        dateText = this.getElementText(dateElements[0]).trim();
      }
    }

    let dateUpload = null;
    if (dateText) {
      const match = dateText.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (match) {
        const day = Number(match[1]);
        const month = Number(match[2]) - 1;
        const year = Number(match[3]);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          dateUpload = date.getTime().toString();
        }
      }
    }

    chapters.push({
      name: name,
      url: url,
      dateUpload: dateUpload
    });
  }

  return chapters;
}

  getHeaders() {
    return {
      "Referer": this.source.baseUrl + "/",
      "User-Agent": this.getPreference("custom_user_agent")
    };
  }

  async getDocument(url) {
    const response = await this.client.get(url, this.getHeaders());
    return new Document(response.body);
  }

  absoluteUrl(url) {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("//")) return "https:" + url;
    if (url.startsWith("/")) return this.source.baseUrl + url;
    return this.source.baseUrl + "/" + url;
  }

  getBgImageUrl(style) {
    if (!style) return "";
    const match = style.match(/background-image\s*:\s*url\(['"]?([^'")]+)['"]?\)/i);
    return match && match[1] ? this.absoluteUrl(match[1]) : "";
  }

  // Вспомогательная функция для безопасного получения текста из элемента Mangayomi
  getElementText(el) {
    if (!el) return "";
    if (typeof el.text === "function") return el.text() || "";
    if (typeof el.text === "string") return el.text;
    if (el.textContent) return el.textContent;
    if (el["text"]) return el["text"];
    return "";
  }

  // Вспомогательная функция для безопасного получения атрибута
  getElementAttr(el, attr) {
    if (!el) return "";
    if (typeof el.attr === "function") return el.attr(attr) || "";
    if (el[attr]) return el[attr];
    if (el.attributes && el.attributes[attr]) return el.attributes[attr];
    return "";
  }

  parseMangaCards(document) {
    const list = [];
    const cards = document.select(".cards__item, .manga-cards__item, .catalog-item");

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];

      // 1. Ссылка (получаем через helper)
      let href = this.getElementAttr(card, "href");
      if (!href) {
        const innerLink = card.select('a[href^="/manga/"], a');
        if (innerLink.length > 0) {
          href = this.getElementAttr(innerLink[0], "href");
        }
      }

      if (!href) continue;

      // 2. Название
      let name = "";
      const nameEls = card.select(".cards__name, .media-name__main, .title, h3");
      
      if (nameEls.length > 0) {
        name = this.getElementText(nameEls[0]);
      }

      if (!name) {
        const attrTitle = this.getElementAttr(card, "title");
        name = attrTitle ? attrTitle : this.getElementText(card);
      }

      name = name ? name.trim() : "";

      // 3. Обложка из background-image (div.cards__img)
      let imageUrl = "";
      const imgEls = card.select(".cards__img");
      if (imgEls.length > 0) {
        const style = this.getElementAttr(imgEls[0], "style");
        imageUrl = this.getBgImageUrl(style);
      }

      // Запасной вариант для <img>
      if (!imageUrl) {
        const imgs = card.select("img");
        if (imgs.length > 0) {
          const img = imgs[0];
          const src = this.getElementAttr(img, "src") || 
                   this.getElementAttr(img, "data-src") || 
                   this.getElementAttr(img, "data-original");
          imageUrl = this.absoluteUrl(src);
        }
      }

      if (!name) continue;

      list.push({
        name: name,
        link: href,
        imageUrl: imageUrl
      });
    }

    return list;
  }

  async getPopular(page) {
    const url = page <= 1 ? `${this.source.baseUrl}/manga` : `${this.source.baseUrl}/manga?page=${page}`;
    const document = await this.getDocument(url);
    const list = this.parseMangaCards(document);

    return {
      list: list,
      hasNextPage: list.length > 0
    };
  }

  async getLatestUpdates(page) {
    const url = page <= 1 ? `${this.source.baseUrl}/manga?sort=updated_at` : `${this.source.baseUrl}/manga?sort=updated&page=${page}`;
    const document = await this.getDocument(url);
    const list = this.parseMangaCards(document);

    return {
      list: list,
      hasNextPage: list.length > 0
    };
  }

  async search(query, page, filters) {
    let url = `${this.source.baseUrl}/search?page=${page}`;
    if (query && query.trim() !== "") {
      url = `${this.source.baseUrl}/search?q=${encodeURIComponent(query.trim())}&page=${page}`;
    }

    const document = await this.getDocument(url);
    
    const list = this.parseMangaCards(document);

    return {
      list: list,
      hasNextPage: list.length > 0
    };
  }

  async getDetail(url) {
  const absoluteUrl = this.absoluteUrl(url);
  const document = await this.getDocument(absoluteUrl);

  const manga = {
    description: "",
    author: "",
    genre: [],
    status: 5,
    chapters: []
  };

  // ========================================
  // Описание
  // ========================================

  const descriptionSelectors = [
    ".manga__description",
    ".description",
    ".full-description"
  ];

  for (const selector of descriptionSelectors) {
    const els = document.select(selector);

    if (els.length > 0) {
      const text = this.getElementText(els[0]).trim();

      if (text) {
        manga.description = text;
        break;
      }
    }
  }

  // ========================================
  // Жанры
  // ========================================

  const genreEls = document.select(
    ".genres a, .tags a, .manga__genres a"
  );

  const genres = [];

  for (let i = 0; i < genreEls.length; i++) {
    const text = this.getElementText(genreEls[i]).trim();

    if (text && !genres.includes(text)) {
      genres.push(text);
    }
  }

  manga.genre = genres;

  // ========================================
  // Автор
  // ========================================

  const authorEls = document.select(
    ".manga__author a, .author a"
  );

  if (authorEls.length > 0) {
    manga.author = this.getElementText(authorEls[0]).trim();
  }

  // ========================================
  // Manga ID
  // ========================================

  const mangaEls = document.select(".manga");

  if (mangaEls.length === 0) {
    return manga;
  }

  const mangaId = this.getElementAttr(
    mangaEls[0],
    "data-id"
  );

  if (!mangaId) {
    return manga;
  }

  // ========================================
  // CSRF TOKEN
  // ========================================

  let csrfToken = "";

  const csrfEls = document.select(
    'meta[name="csrf-token"]'
  );

  if (csrfEls.length > 0) {
    csrfToken = this.getElementAttr(
      csrfEls[0],
      "content"
    ) || "";
  }

  // ========================================
  // Загружаем все главы
  // ========================================

  const chaptersUrl = this.absoluteUrl(
    "/chapters/load"
  );

  const client = new Client({});

  const headers = {
    "Content-Type":
      "application/x-www-form-urlencoded; charset=UTF-8",

    "X-Requested-With":
      "XMLHttpRequest",

    "Accept":
      "*/*",

    "Referer":
      absoluteUrl
  };

  if (csrfToken) {
    headers["X-CSRF-TOKEN"] = csrfToken;
  }

  const response = await client.post(
    chaptersUrl,
    headers,
    `manga_id=${encodeURIComponent(mangaId)}`
  );

  // ========================================
  // Проверяем ответ
  // ========================================

  if (!response || response.statusCode !== 200) {
    return manga;
  }

  if (!response.body) {
    return manga;
  }

  // ========================================
  // Парсим HTML ответа
  // ========================================

  let htmlContent = "";

  try {
    const jsonResponse = JSON.parse(response.body);
    htmlContent = jsonResponse.content || "";
  } catch (e) {
    htmlContent = response.body;
  }




const chaptersDocument = new Document(htmlContent);
  manga.chapters = this.parseChapters(chaptersDocument);
manga.chapters = manga.chapters.concat(this.parseChapters(document));

 /*
  let elements = manga.chapters;
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];

l
      manga.description += `Первичных глав: ${JSON.stringify(elements)}\n`
    }*/


return manga;
}





  
  async getPageList(url) {
    const document = await this.getDocument(this.absoluteUrl(url));
    const pages = [];

    let images = document.select(".reader__item img, .reader__page img");
    if (images.length === 0) images = document.select(".reader-page img");

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      let imageUrl = image.attr("src") || image.attr("data-src") || image.attr("data-original") || "";

      if (!imageUrl) continue;

      imageUrl = this.absoluteUrl(imageUrl);
      if (!pages.includes(imageUrl)) {
        pages.push(imageUrl);
      }
    }

    return pages;
  }

  getPreference(key, defaultValue) {
    const preferences = new SharedPreferences();
    return preferences.get(key, defaultValue);
  }

  getSourcePreferences() {
    return [
      {
        "key": "custom_user_agent",
        "editTextPreference": {
          "title": "User-Agent",
          "summary": "Настройка заголовка User-Agent для запросов",
          "value": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
          "dialogTitle": "Указать User-Agent",
          "dialogMessage": "Введите пользовательский User-Agent"
        }
      }
    ];
  }

  getFilterList() {
    return [];
  }
  
  }
