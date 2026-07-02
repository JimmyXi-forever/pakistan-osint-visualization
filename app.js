const state = {
  incidents: [],
  dataMeta: null,
  markers: new Map(),
  selectedId: null,
};

const map = L.map("map", {
  zoomControl: true,
  scrollWheelZoom: true,
}).setView([30.3753, 69.3451], 5);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);

const elements = {
  startDate: document.querySelector("#startDate"),
  endDate: document.querySelector("#endDate"),
  regionFilter: document.querySelector("#regionFilter"),
  typeFilter: document.querySelector("#typeFilter"),
  keywordFilter: document.querySelector("#keywordFilter"),
  resetButton: document.querySelector("#resetButton"),
  incidentList: document.querySelector("#incidentList"),
  detail: document.querySelector("#detail"),
  stats: document.querySelector("#stats"),
  dataStatus: document.querySelector("#dataStatus"),
};

const formatDate = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const severityClass = {
  高: "high",
  中: "medium",
  低: "low",
};

async function init() {
  const dataset = await loadIncidentData();
  state.incidents = dataset.incidents;
  state.dataMeta = dataset.metadata;
  populateControls(state.incidents);
  setDefaultDates(state.incidents);
  bindEvents();
  renderDataStatus();
  render();
  refreshMapLayout();
}

async function loadIncidentData() {
  const sources = [
    { url: "./data/live-incidents.json", mode: "online" },
    { url: "./data/incidents.json", mode: "manual" },
  ];

  for (const source of sources) {
    try {
      const response = await fetch(source.url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const payload = await response.json();
      return normalizeIncidentPayload(payload, source.mode);
    } catch (error) {
      console.warn(`Failed to load ${source.url}:`, error);
    }
  }

  throw new Error("未能读取任何事件数据。");
}

function normalizeIncidentPayload(payload, mode) {
  if (Array.isArray(payload)) {
    return {
      incidents: payload,
      metadata: {
        mode,
        generatedAt: null,
        caveat: "当前读取人工核验数据。",
      },
    };
  }

  if (Array.isArray(payload.incidents)) {
    return {
      incidents: payload.incidents,
      metadata: {
        mode,
        ...(payload.metadata ?? {}),
      },
    };
  }

  throw new Error("事件数据格式不正确。");
}

function populateControls(incidents) {
  const regions = [...new Set(incidents.map((item) => item.region))].sort();
  const types = [...new Set(incidents.map((item) => item.incidentType))].sort();

  for (const region of regions) {
    elements.regionFilter.append(new Option(region, region));
  }

  for (const type of types) {
    elements.typeFilter.append(new Option(type, type));
  }

  if (types.includes("恐袭")) {
    elements.typeFilter.value = "恐袭";
  }
}

function setDefaultDates(incidents) {
  const dates = incidents.map((item) => item.date).sort();
  elements.startDate.value = dates[0] ?? "";
  elements.endDate.value = dates.at(-1) ?? "";
}

function bindEvents() {
  document.querySelector("#filters").addEventListener("input", render);
  window.addEventListener("resize", refreshMapLayout);
  elements.resetButton.addEventListener("click", () => {
    elements.regionFilter.value = "all";
    elements.typeFilter.value = [...elements.typeFilter.options].some((option) => option.value === "恐袭")
      ? "恐袭"
      : "all";
    elements.keywordFilter.value = "";
    setDefaultDates(state.incidents);
    state.selectedId = null;
    render();
  });
}

function getFilteredIncidents() {
  const start = elements.startDate.value;
  const end = elements.endDate.value;
  const region = elements.regionFilter.value;
  const type = elements.typeFilter.value;
  const keyword = elements.keywordFilter.value.trim().toLowerCase();

  return state.incidents.filter((incident) => {
    const inDateRange = (!start || incident.date >= start) && (!end || incident.date <= end);
    const inRegion = region === "all" || incident.region === region;
    const inType = type === "all" || incident.incidentType === type;
    const haystack = [
      incident.title,
      incident.city,
      incident.region,
      incident.actor,
      incident.target,
      incident.summary,
    ]
      .join(" ")
      .toLowerCase();

    return inDateRange && inRegion && inType && (!keyword || haystack.includes(keyword));
  });
}

function render() {
  const incidents = getFilteredIncidents();
  renderStats(incidents);
  renderList(incidents);
  renderMarkers(incidents);

  if (!incidents.some((item) => item.id === state.selectedId)) {
    state.selectedId = incidents[0]?.id ?? null;
  }

  const selected = incidents.find((item) => item.id === state.selectedId);
  renderDetail(selected);
  highlightSelected();
  refreshMapLayout();
}

function renderDataStatus() {
  if (!elements.dataStatus) {
    return;
  }

  const meta = state.dataMeta ?? {};
  const generatedAt = meta.generatedAt ? new Date(meta.generatedAt) : null;
  const generatedText = generatedAt && !Number.isNaN(generatedAt.valueOf())
    ? `${generatedAt.toLocaleString("zh-CN")} 更新`
    : "人工数据";
  const candidateText = Number.isFinite(meta.autoCandidateCount)
    ? `自动候选 ${meta.autoCandidateCount} 条`
    : "无自动候选统计";

  elements.dataStatus.textContent = `${generatedText}；${candidateText}。自动候选需人工复核。`;
}

function renderStats(incidents) {
  const regions = new Set(incidents.map((item) => item.region));
  const highSeverity = incidents.filter((item) => item.severity === "高").length;
  const autoCandidates = incidents.filter((item) => item.reviewStatus === "auto-candidate").length;

  const stats = [
    statTemplate(incidents.length, "当前事件"),
    statTemplate(regions.size, "涉及地区"),
    statTemplate(highSeverity, "高风险"),
  ];

  if (autoCandidates > 0) {
    stats.push(statTemplate(autoCandidates, "自动候选"));
  }

  elements.stats.innerHTML = stats.join("");
}

function statTemplate(value, label) {
  return `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`;
}

function renderList(incidents) {
  if (incidents.length === 0) {
    elements.incidentList.innerHTML = '<p class="empty">没有符合筛选条件的事件。</p>';
    return;
  }

  elements.incidentList.innerHTML = incidents
    .map(
      (incident) => `
        <button class="incident-card" data-id="${incident.id}" data-type="${incident.incidentType}">
          <h2>${incident.title}</h2>
          <div class="meta">
            <span>${formatDate.format(new Date(`${incident.date}T00:00:00+05:00`))}</span>
            <span>${incident.city} / ${incident.region}</span>
          </div>
          <div class="meta">
            <span class="tag ${severityClass[incident.severity] ?? ""}">${incident.severity}风险</span>
            <span class="tag">${incident.incidentType}</span>
            ${incident.reviewStatus === "auto-candidate" ? '<span class="tag candidate">待核验</span>' : ""}
          </div>
        </button>
      `,
    )
    .join("");

  elements.incidentList.querySelectorAll(".incident-card").forEach((card) => {
    card.addEventListener("click", () => selectIncident(card.dataset.id));
  });
}

function renderMarkers(incidents) {
  markerLayer.clearLayers();
  state.markers.clear();

  const bounds = [];

  for (const incident of incidents) {
    const marker = L.circleMarker([incident.latitude, incident.longitude], {
      radius: incident.severity === "高" ? 10 : 8,
      color: incident.incidentType === "关联反恐行动" ? "#176f73" : "#8f2323",
      fillColor: incident.incidentType === "关联反恐行动" ? "#1d8d91" : "#d04a3a",
      fillOpacity: 0.82,
      weight: 2,
    })
      .bindPopup(`<strong>${incident.title}</strong><br>${incident.city} / ${incident.region}`)
      .on("click", () => selectIncident(incident.id));

    marker.addTo(markerLayer);
    state.markers.set(incident.id, marker);
    bounds.push([incident.latitude, incident.longitude]);
  }

  if (bounds.length === 1) {
    map.setView(bounds[0], 8);
  } else if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [42, 42] });
  }

  refreshMapLayout();
}

function selectIncident(id) {
  state.selectedId = id;
  const incident = state.incidents.find((item) => item.id === id);
  renderDetail(incident);
  highlightSelected();

  const marker = state.markers.get(id);
  if (incident) {
    focusIncidentOnMap(incident, marker);
  }
}

function refreshMapLayout() {
  requestAnimationFrame(() => {
    map.invalidateSize({ animate: false, pan: false });
    requestAnimationFrame(() => map.invalidateSize({ animate: false, pan: false }));
  });
}

function focusIncidentOnMap(incident, marker) {
  const latLng = marker?.getLatLng() ?? L.latLng(incident.latitude, incident.longitude);
  refreshMapLayout();
  map.flyTo(latLng, Math.max(map.getZoom(), 9), {
    animate: true,
    duration: 0.55,
  });

  window.setTimeout(() => {
    refreshMapLayout();
    if (marker) {
      marker.openPopup();
    }
  }, 620);
}

function highlightSelected() {
  elements.incidentList.querySelectorAll(".incident-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.id === state.selectedId);
  });
}

function renderDetail(incident) {
  if (!incident) {
    elements.detail.innerHTML = '<p class="empty">没有符合筛选条件的事件。</p>';
    return;
  }

  elements.detail.innerHTML = `
    <div>
      <div class="meta">
        <span class="tag ${severityClass[incident.severity] ?? ""}">${incident.severity}风险</span>
        <span class="tag">${incident.incidentType}</span>
        <span class="tag">${incident.confidence}可信度</span>
        ${incident.reviewStatus === "auto-candidate" ? '<span class="tag candidate">自动候选，未人工核验</span>' : ""}
      </div>
      <h2>${incident.title}</h2>
    </div>
    <div class="detail-grid">
      ${detailCell("日期", incident.date)}
      ${detailCell("地点", `${incident.city}, ${incident.region}`)}
      ${detailCell("相关组织", incident.actor)}
      ${detailCell("目标", incident.target)}
    </div>
    <p>${incident.summary}</p>
    ${renderMedia(incident)}
    <div class="sources">
      ${incident.sources.map((source) => `<a href="${source.url}" target="_blank" rel="noreferrer">${source.name}</a>`).join("")}
    </div>
  `;
}

function renderMedia(incident) {
  const media = incident.media ?? [];
  const note = incident.mediaNote ? `<p class="media-note">${incident.mediaNote}</p>` : "";

  if (media.length === 0) {
    return `
      <section class="media-section" aria-label="图片信源">
        <h3>图片信源</h3>
        ${note || '<p class="media-note">暂未发现可核验现场图片。</p>'}
      </section>
    `;
  }

  return `
    <section class="media-section" aria-label="图片信源">
      <h3>图片信源</h3>
      <div class="media-grid">
        ${media
          .map(
            (item) => `
              <figure class="media-card">
                <img src="${item.imageUrl}" alt="${item.caption}" loading="lazy" />
                <figcaption>
                  <strong>${item.title}</strong>
                  <span>${item.caption}</span>
                  <small>${item.credit}</small>
                  <a href="${item.sourceUrl}" target="_blank" rel="noreferrer">${item.sourceName}</a>
                </figcaption>
              </figure>
            `,
          )
          .join("")}
      </div>
      ${note}
    </section>
  `;
}

function detailCell(label, value) {
  return `<div class="detail-cell"><span>${label}</span><strong>${value}</strong></div>`;
}

init().catch((error) => {
  elements.detail.innerHTML = `<p class="empty">数据加载失败：${error.message}</p>`;
});
