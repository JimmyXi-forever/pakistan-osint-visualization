import { access, readFile } from "node:fs/promises";

const requiredFields = [
  "id",
  "date",
  "region",
  "city",
  "latitude",
  "longitude",
  "title",
  "incidentType",
  "severity",
  "confidence",
  "actor",
  "target",
  "summary",
  "sources",
];

const errors = [];

const manualIncidents = await readDataset("../data/incidents.json");
validateIncidentArray("data/incidents.json", manualIncidents);

const liveUrl = new URL("../data/live-incidents.json", import.meta.url);
if (await exists(liveUrl)) {
  const livePayload = await readDataset("../data/live-incidents.json");
  const liveIncidents = Array.isArray(livePayload) ? livePayload : livePayload.incidents;
  validateIncidentArray("data/live-incidents.json", liveIncidents);

  if (!Array.isArray(livePayload) && !livePayload.metadata?.generatedAt) {
    errors.push("data/live-incidents.json metadata.generatedAt is required.");
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${manualIncidents.length} reviewed incident records.`);

async function readDataset(relativePath) {
  const raw = await readFile(new URL(relativePath, import.meta.url), "utf8");
  return JSON.parse(raw);
}

async function exists(url) {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
}

function validateIncidentArray(datasetName, incidents) {
  const ids = new Set();

  if (!Array.isArray(incidents)) {
    errors.push(`${datasetName} must contain an array or an object with incidents array.`);
    return;
  }

  for (const [index, incident] of incidents.entries()) {
    for (const field of requiredFields) {
      if (!(field in incident)) {
        errors.push(`${datasetName} incident #${index + 1} is missing field: ${field}`);
      }
    }

    if (ids.has(incident.id)) {
      errors.push(`${datasetName} duplicate incident id: ${incident.id}`);
    }
    ids.add(incident.id);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(incident.date)) {
      errors.push(`${datasetName} ${incident.id} has invalid date format: ${incident.date}`);
    }

    if (Number.isNaN(Number(incident.latitude)) || Number.isNaN(Number(incident.longitude))) {
      errors.push(`${datasetName} ${incident.id} must have numeric latitude and longitude.`);
    }

    if (!Array.isArray(incident.sources) || incident.sources.length === 0) {
      errors.push(`${datasetName} ${incident.id} must include at least one source.`);
    }

    if ("media" in incident) {
      if (!Array.isArray(incident.media)) {
        errors.push(`${datasetName} ${incident.id} media must be an array.`);
      } else {
        for (const [mediaIndex, media] of incident.media.entries()) {
          for (const field of ["title", "imageUrl", "caption", "credit", "sourceName", "sourceUrl"]) {
            if (!media[field]) {
              errors.push(`${datasetName} ${incident.id} media #${mediaIndex + 1} is missing field: ${field}`);
            }
          }
        }
      }
    }
  }
}
