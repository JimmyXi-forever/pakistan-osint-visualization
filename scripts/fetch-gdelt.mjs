import { writeFile } from "node:fs/promises";
import https from "node:https";

const query = [
  "Pakistan",
  "(terror OR terrorism OR militant OR suicide attack OR bombing)",
  "sourcelang:english",
].join(" ");

const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
url.searchParams.set("query", query);
url.searchParams.set("mode", "ArtList");
url.searchParams.set("format", "json");
url.searchParams.set("timespan", "1week");
url.searchParams.set("maxrecords", "50");
url.searchParams.set("sort", "HybridRel");

const payload = await getJson(url);
const articles = (payload.articles ?? []).map((article) => ({
  title: article.title,
  url: article.url,
  source: article.domain,
  publishedAt: article.seendate,
  language: article.language,
}));

await writeFile(
  new URL("../data/gdelt-articles.latest.json", import.meta.url),
  `${JSON.stringify({ fetchedAt: new Date().toISOString(), query, articles }, null, 2)}\n`,
);

console.log(`Fetched ${articles.length} candidate articles.`);
console.log("Review data/gdelt-articles.latest.json, then manually promote confirmed cases into data/incidents.json.");

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
