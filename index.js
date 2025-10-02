const express = require("express");
const { addonBuilder } = require("stremio-addon-sdk");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const Fuse = require("fuse.js");

// Replace with your TMDb API key
const TMDB_API_KEY = "2b855e5dedf0a8d134b2b2324d051065";

let tmdbCache = {};

const manifest = {
  id: "org.tamil.stremio",
  version: "1.0.0",
  name: "Tamil Movies & Shows (TMDb + Piratebay)",
  description: "Tamil Movies & Series with episode-level scraping",
  types: ["movie", "series"],
  catalogs: [
    { type: "movie", id: "tamil-movies", name: "Tamil Movies" },
    { type: "series", id: "tamil-series", name: "Tamil Series" }
  ],
  resources: ["catalog", "meta", "stream"]
};

const builder = new addonBuilder(manifest);

// ----- Catalog Handler -----
builder.defineCatalogHandler(async args => {
  let metas = [];
  if (args.id === "tamil-movies") {
    const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=ta&sort_by=release_date.desc&page=1`;
    const res = await fetch(url);
    const data = await res.json();
    metas = data.results.map(movie => {
      tmdbCache["movie-" + movie.id] = movie;
      return {
        id: "movie-" + movie.id,
        type: "movie",
        name: movie.title,
        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "",
        description: movie.overview
      };
    });
  } else if (args.id === "tamil-series") {
    const url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_original_language=ta&sort_by=first_air_date.desc&page=1`;
    const res = await fetch(url);
    const data = await res.json();
    metas = data.results.map(series => {
      tmdbCache["series-" + series.id] = series;
      return {
        id: "series-" + series.id,
        type: "series",
        name: series.name,
        poster: series.poster_path ? `https://image.tmdb.org/t/p/w500${series.poster_path}` : "",
        description: series.overview
      };
    });
  }
  return { metas };
});

// ----- Meta Handler -----
builder.defineMetaHandler(async args => {
  const id = args.id.split("-")[1];
  const type = args.type === "series" ? "tv" : "movie";
  const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=en-US`);
  const meta = await res.json();
  return {
    meta: {
      id: args.id,
      type: args.type,
      name: meta.title || meta.name,
      poster: meta.poster_path ? `https://image.tmdb.org/t/p/w500${meta.poster_path}` : "",
      description: meta.overview,
      releaseInfo: meta.release_date || meta.first_air_date
    }
  };
});

// ----- Stream Handler -----
builder.defineStreamHandler(async args => {
  const tmdbId = args.id;
  const tmdbMeta = tmdbCache[tmdbId];
  if (!tmdbMeta) return { streams: [] };

  const title = tmdbMeta.title || tmdbMeta.name;
  let streams = [];

  // Piratebay placeholder
  streams.push({
    title: `${title} (Piratebay)`,
    url: "magnet:?xt=urn:btih:EXAMPLEHASH&dn=" + encodeURIComponent(title)
  });

  // Placeholder for other Tamil streaming sites
  const sites = [
    "https://tamilblasters.media",
    "https://www.1tamilmv.mba",
    "https://einthusan.tv",
    "https://tamildhool.net",
    "https://tamilcrow.net"
  ];

  for (let site of sites) {
    try {
      const res = await fetch(site);
      const html = await res.text();
      const $ = cheerio.load(html);
      $("a").each((i, el) => {
        const linkTitle = $(el).text().trim();
        const url = $(el).attr("href");
        if (linkTitle.toLowerCase().includes(title.toLowerCase()) && url) {
          streams.push({ title: `${linkTitle} (${site})`, url });
        }
      });
    } catch (err) {
      console.log("Error scraping site:", site, err);
    }
  }

  return { streams };
});

// ----- Express Setup -----
const addonInterface = builder.getInterface();
const port = process.env.PORT || 3000;

const app = express();
app.use(addonInterface);

// ----- Error Handling -----
process.on('unhandledRejection', (reason, p) => {
  console.error('UNHANDLED REJECTION:', reason, p);
});
process.on('uncaughtException', err => {
  console.error('UNCAUGHT EXCEPTION:', err && err.stack ? err.stack : err);
  process.exit(1);
});

// ----- Start Server -----
app.listen(port, () => {
  console.log(`Stremio addon running on port ${port}`);
});
