import { readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import https from "node:https";

const query = process.env.OSINT_QUERY ?? [
  "Pakistan",
  "(terror OR terrorist OR terrorism OR militant OR militants OR suicide attack OR bombing OR blast OR gunmen OR TTP OR BLA)",
  "sourcelang:english",
].join(" ");
const timespan = process.env.OSINT_TIMESPAN ?? "3days";
const maxRecords = process.env.OSINT_MAX_RECORDS ?? "75";

const reviewedIncidents = await readJson("../data/incidents.json");
const payload = await fetchGdeltArticles();
const articles = (payload.articles ?? []).map(normalizeArticle).filter(isRelevantArticle);
const candidates = articles
  .filter((article) => !isReviewedDuplicate(article, reviewedIncidents))
  .map(articleToCandidateIncident)
  .slice(0, 30);

const liveData = {
  metadata: {
    schemaVersion: "1.0",
    mode: "automatic-gdelt-plus-reviewed",
    generatedAt: new Date().toISOString(),
    query,
    timespan,
    reviewedCount: reviewedIncidents.length,
    autoCandidateCount: candidates.length,
    caveat: "自动候选来自 GDELT 新闻检索，尚未完成逐条人工核验；用于态势发现，不等同于最终事实裁定。",
  },
  incidents: [
    ...reviewedIncidents.map((incident) => ({ reviewStatus: "reviewed", ...incident })),
    ...candidates,
  ],
};

await writeFile(
  new URL("../data/gdelt-articles.latest.json", import.meta.url),
  `${JSON.stringify({ fetchedAt: liveData.metadata.generatedAt, query, timespan, articles }, null, 2)}\n`,
);
await writeFile(
  new URL("../data/live-incidents.json", import.meta.url),
  `${JSON.stringify(liveData, null, 2)}\n`,
);

console.log(`Reviewed incidents: ${reviewedIncidents.length}`);
console.log(`GDELT candidate articles: ${articles.length}`);
console.log(`Auto candidate incidents: ${candidates.length}`);
console.log("Wrote data/live-incidents.json and data/gdelt-articles.latest.json.");

async function fetchGdeltArticles() {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "ArtList");
  url.searchParams.set("format", "json");
  url.searchParams.set("timespan", timespan);
  url.searchParams.set("maxrecords", maxRecords);
  url.searchParams.set("sort", "HybridRel");
  return getJson(url);
}

async function readJson(relativePath) {
  const raw = await readFile(new URL(relativePath, import.meta.url), "utf8");
  return JSON.parse(raw);
}

function normalizeArticle(article) {
  return {
    title: article.title ?? "",
    url: article.url ?? "",
    source: article.domain ?? article.sourceCountry ?? "Unknown source",
    publishedAt: parseGdeltDate(article.seendate),
    language: article.language,
    imageUrl: article.socialimage || "",
  };
}

function parseGdeltDate(value) {
  if (!value) {
    return new Date().toISOString();
  }

  const compact = String(value).replace(/\D/g, "");
  if (compact.length >= 14) {
    const iso = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}T${compact.slice(8, 10)}:${compact.slice(10, 12)}:${compact.slice(12, 14)}Z`;
    return iso;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? new Date().toISOString() : parsed.toISOString();
}

function isRelevantArticle(article) {
  const text = `${article.title} ${article.source}`.toLowerCase();
  const include = [
    "attack",
    "blast",
    "bomb",
    "bombing",
    "gunmen",
    "militant",
    "militants",
    "suicide",
    "terror",
    "terrorist",
    "ttp",
    "tehrik-i-taliban",
    "baloch liberation",
    "bla",
  ];
  const exclude = [
    "cricket",
    "movie",
    "stock",
    "market",
    "weather",
    "recipe",
  ];

  return include.some((term) => text.includes(term)) && !exclude.some((term) => text.includes(term));
}

function isReviewedDuplicate(article, reviewedIncidents) {
  const articleText = normalizeText(`${article.title} ${article.url}`);
  return reviewedIncidents.some((incident) => {
    const incidentText = normalizeText(`${incident.title} ${incident.summary}`);
    const sourceUrls = (incident.sources ?? []).map((source) => source.url);
    return sourceUrls.includes(article.url) || hasMeaningfulOverlap(articleText, incidentText);
  });
}

function hasMeaningfulOverlap(a, b) {
  const wordsA = new Set(a.split(" ").filter((word) => word.length > 4));
  const wordsB = new Set(b.split(" ").filter((word) => word.length > 4));
  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) {
      overlap += 1;
    }
  }
  return overlap >= 5;
}

function articleToCandidateIncident(article) {
  const location = inferLocation(article.title);
  const date = article.publishedAt.slice(0, 10);
  const id = `gdelt-${date}-${hash(`${article.title}-${article.url}`)}`;
  const incidentType = inferIncidentType(article.title);

  return {
    id,
    date,
    country: "Pakistan",
    region: location.region,
    city: location.city,
    latitude: location.latitude,
    longitude: location.longitude,
    title: article.title,
    incidentType,
    severity: inferSeverity(article.title),
    confidence: "自动候选",
    reviewStatus: "auto-candidate",
    actor: inferActor(article.title),
    target: "待人工核验",
    fatalities: {
      reportedMinimum: null,
      reportedMaximum: null,
      note: "自动候选未解析可靠伤亡数字，需回看原文核验。",
    },
    summary: `GDELT 自动检索到的涉恐候选报道：${article.title}。该条目尚未人工核验，地点为基于标题关键词的粗定位。`,
    sources: [
      {
        name: article.source,
        url: article.url,
      },
    ],
    media: [],
    mediaNote: "自动候选不自动展示图片；需人工核验图注、署名和现场关联性后补充。",
    lastReviewed: null,
  };
}

function inferLocation(title) {
  const text = title.toLowerCase();
  const locations = [
    ["karachi", "Karachi", "Sindh", 24.8607, 67.0011],
    ["sindh", "Sindh", "Sindh", 25.8943, 68.5247],
    ["peshawar", "Peshawar", "Khyber Pakhtunkhwa", 34.0151, 71.5249],
    ["bannu", "Bannu", "Khyber Pakhtunkhwa", 32.9861, 70.6042],
    ["dera ismail khan", "Dera Ismail Khan", "Khyber Pakhtunkhwa", 31.8327, 70.9024],
    ["di khan", "Dera Ismail Khan", "Khyber Pakhtunkhwa", 31.8327, 70.9024],
    ["north waziristan", "North Waziristan", "Khyber Pakhtunkhwa", 32.9746, 70.1456],
    ["south waziristan", "South Waziristan", "Khyber Pakhtunkhwa", 32.1206, 69.5898],
    ["waziristan", "Waziristan", "Khyber Pakhtunkhwa", 32.3054, 69.7596],
    ["bajaur", "Bajaur", "Khyber Pakhtunkhwa", 34.6833, 71.5000],
    ["kurram", "Kurram", "Khyber Pakhtunkhwa", 33.7411, 70.3444],
    ["khyber", "Khyber", "Khyber Pakhtunkhwa", 34.0259, 71.1154],
    ["lakki marwat", "Lakki Marwat", "Khyber Pakhtunkhwa", 32.6079, 70.9114],
    ["quetta", "Quetta", "Balochistan", 30.1798, 66.9750],
    ["balochistan", "Balochistan", "Balochistan", 28.4907, 65.0958],
    ["mastung", "Mastung", "Balochistan", 29.7997, 66.8455],
    ["gwadar", "Gwadar", "Balochistan", 25.1264, 62.3225],
    ["turbat", "Turbat", "Balochistan", 26.0023, 63.0500],
    ["khuzdar", "Khuzdar", "Balochistan", 27.8119, 66.6108],
    ["lahore", "Lahore", "Punjab", 31.5204, 74.3587],
    ["punjab", "Punjab", "Punjab", 31.1704, 72.7097],
    ["islamabad", "Islamabad", "Islamabad Capital Territory", 33.6844, 73.0479],
    ["rawalpindi", "Rawalpindi", "Punjab", 33.5651, 73.0169],
  ];

  const match = locations.find(([keyword]) => text.includes(keyword));
  if (match) {
    return {
      city: match[1],
      region: match[2],
      latitude: match[3],
      longitude: match[4],
    };
  }

  return {
    city: "Pakistan (unresolved)",
    region: "Unresolved",
    latitude: 30.3753,
    longitude: 69.3451,
  };
}

function inferIncidentType(title) {
  const text = title.toLowerCase();
  if (/(operation|raid|airstrike|arrest|security forces|militants killed)/.test(text)) {
    return "关联反恐行动";
  }
  return "未核验候选";
}

function inferSeverity(title) {
  const text = title.toLowerCase();
  if (/(suicide|bomb|blast|killed|dead|massacre|fatal)/.test(text)) {
    return "高";
  }
  if (/(attack|gunmen|militant|terror)/.test(text)) {
    return "中";
  }
  return "低";
}

function inferActor(title) {
  const text = title.toLowerCase();
  if (text.includes("ttp") || text.includes("tehrik-i-taliban")) {
    return "TTP / Tehrik-i-Taliban Pakistan candidate mention";
  }
  if (text.includes("bla") || text.includes("baloch liberation")) {
    return "Baloch militant group candidate mention";
  }
  if (text.includes("islamic state") || text.includes("isis") || text.includes("is-k")) {
    return "Islamic State candidate mention";
  }
  return "待人工核验";
}

function normalizeText(value) {
  return String(value)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hash(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function getJson(targetUrl) {
  return new Promise((resolve, reject) => {
    https
      .get(targetUrl, (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`GDELT returned ${response.statusCode}: ${body.slice(0, 300)}`));
            return;
          }
          resolve(JSON.parse(body));
        });
      })
      .on("error", reject);
  });
}
