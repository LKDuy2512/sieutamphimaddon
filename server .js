const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const axios = require("axios");
const cheerio = require("cheerio");

const DOMAIN = "https://www.sieutamphim.pro";

// 1. Khai báo Manifest cho Addon
const manifest = {
  id: "org.lkduy.sieutamphim",
  version: "1.0.0",
  name": "Siêu Tầm Phim",
  description": "Xem phim từ sieutamphim.pro trên Nuvio / Stremio",
  resources": ["catalog", "stream"],
  types": ["movie", "series"],
  catalogs: [
    {
      type: "movie",
      id: "stp_movies",
      name: "Siêu Tầm Phim - Mới Cập Nhật"
    }
  ]
};

const builder = new addonBuilder(manifest);

// 2. Xử lý Catalog (Danh sách phim ở trang chủ)
builder.defineCatalogHandler(async ({ type, id }) => {
  if (type === "movie" && id === "stp_movies") {
    try {
      const response = await axios.get(DOMAIN, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });
      const $ = cheerio.load(response.data);
      const metas = [];

      // Bóc tách danh sách phim từ HTML của trang
      $("a").each((i, el) => {
        const title = $(el).attr("title") || $(el).text().trim();
        const href = $(el).attr("href");
        const img = $(el).find("img").attr("src");

        if (href && href.includes(DOMAIN) && img && title) {
          const filmSlug = href.replace(DOMAIN, "").replace(/\//g, "");
          if (filmSlug && !metas.some(m => m.id === `stp:${filmSlug}`)) {
            metas.push({
              id: `stp:${filmSlug}`,
              type: "movie",
              name: title,
              poster: img.startsWith("http") ? img : `${DOMAIN}${img}`
            });
          }
        }
      });

      return { metas: metas.slice(0, 20) };
    } catch (error) {
      console.error("Lỗi cào Catalog:", error.message);
      return { metas: [] };
    }
  }
  return { metas: [] };
});

// 3. Xử lý Stream (Bóc tách link video m3u8/MP4 hoặc Embed)
builder.defineStreamHandler(async ({ type, id }) => {
  if (id.startsWith("stp:")) {
    const filmSlug = id.replace("stp:", "");
    const filmUrl = `${DOMAIN}/${filmSlug}/`;

    try {
      const response = await axios.get(filmUrl, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const $ = cheerio.load(response.data);

      // Tìm iframe hoặc player link trong trang chi tiết phim
      let streamUrl = $("iframe").attr("src");

      if (streamUrl) {
        if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;

        return {
          streams: [
            {
              title: "Siêu Tầm Phim - Player VIP",
              type: "embed", // Nếu là iframe embed
              url: streamUrl
            }
          ]
        };
      }
    } catch (error) {
      console.error("Lỗi cào Stream:", error.message);
    }
  }
  return { streams: [] };
});

// 4. Khởi chạy Server
const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port });
            
