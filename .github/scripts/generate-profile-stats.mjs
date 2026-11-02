import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const username = "andremartinsadr";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputPath = resolve(root, "assets/profile-stats.svg");
const token = process.env.GITHUB_TOKEN;
const colors = [
  "#e34f26",
  "#3572a5",
  "#f1e05a",
  "#3178c6",
  "#563d7c",
  "#89e051",
  "#b07219",
  "#4f5d95",
  "#00add8",
];
const knownColors = {
  CSS: "#563d7c",
  HTML: "#e34f26",
  Java: "#b07219",
  JavaScript: "#f1e05a",
  Kotlin: "#a97bff",
  MySQL: "#00758f",
  PHP: "#4f5d95",
  Python: "#3572a5",
  Shell: "#89e051",
  TypeScript: "#3178c6",
};
const metricIcons = [
  '<path d="m8 1.7 1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.5l-3.8 2 .7-4.3-3.1-3 4.3-.6L8 1.7Z"/>',
  '<path d="M2.5 2.5h4a2 2 0 0 1 2 2v9a2 2 0 0 0-2-2h-4z"/><path d="M13.5 2.5h-3a2 2 0 0 0-2 2v9a2 2 0 0 1 2-2h3z"/>',
  '<circle cx="8" cy="5" r="2.5"/><path d="M3 14c.4-2.1 2.2-3.5 5-3.5s4.6 1.4 5 3.5"/>',
  '<circle cx="3" cy="3" r="1.5"/><circle cx="13" cy="3" r="1.5"/><circle cx="8" cy="13" r="1.5"/><path d="M3 4.5v2a2 2 0 0 0 2 2h3m5-4v2a2 2 0 0 1-2 2H8v3"/>',
];

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, (character) => {
    const entities = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[character];
  });
}

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "profile-stats-generator",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status} for ${path}`);
  }

  return response.json();
}

async function getRepositories() {
  const repositories = [];

  for (let page = 1; ; page += 1) {
    const batch = await github(
      `/users/${username}/repos?per_page=100&page=${page}&type=owner&sort=updated`,
    );
    repositories.push(...batch);

    if (batch.length < 100) {
      return repositories;
    }
  }
}

function languageColor(language, index) {
  return knownColors[language] ?? colors[index % colors.length];
}

function renderStats(user, repositories, languages) {
  const stars = repositories.reduce(
    (total, repository) => total + repository.stargazers_count,
    0,
  );
  const forks = repositories.reduce(
    (total, repository) => total + repository.forks_count,
    0,
  );
  const topLanguages = Object.entries(languages)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6);
  const totalBytes = topLanguages.reduce((total, [, bytes]) => total + bytes, 0);
  const barX = 567;
  const barWidth = 294;
  let offset = 0;

  const barSegments = topLanguages
    .map(([language, bytes], index) => {
      const width = (bytes / totalBytes) * barWidth;
      const segment = `<rect x="${barX + offset}" y="76" width="${width}" height="12" fill="${languageColor(language, index)}"><title>${escapeXml(language)}: ${((bytes / totalBytes) * 100).toFixed(1)}%</title></rect>`;
      offset += width;
      return segment;
    })
    .join("");

  const languageLegend = topLanguages
    .map(([language, bytes], index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 568 + column * 148;
      const y = 116 + row * 28;
      const percentage = ((bytes / totalBytes) * 100).toFixed(1);
      return `<circle cx="${x}" cy="${y - 4}" r="4" fill="${languageColor(language, index)}"/><text x="${x + 10}" y="${y}" class="legend">${escapeXml(language)} ${percentage}%</text>`;
    })
    .join("");

  const metrics = [
    ["Total de estrelas", stars],
    ["Repositórios públicos", user.public_repos],
    ["Seguidores", user.followers],
    ["Forks dos repositórios", forks],
  ];
  const metricRows = metrics
    .map(([label, value], index) => {
      const y = 83 + index * 27;
      return `<g transform="translate(40 ${y - 14})" fill="none" stroke="#bf91f3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${metricIcons[index]}</g><text x="61" y="${y}" class="metric">${label}</text><text x="324" y="${y}" class="value">${value}</text>`;
    })
    .join("");

  const updated = new Date().toISOString().slice(0, 10);
  const profileName = escapeXml(user.name || username);
  const hasLanguages = topLanguages.length > 0;
  const techContent = hasLanguages
    ? `<rect x="${barX}" y="76" width="${barWidth}" height="12" rx="6" fill="#292a3a"/><clipPath id="language-bar"><rect x="${barX}" y="76" width="${barWidth}" height="12" rx="6"/></clipPath><g clip-path="url(#language-bar)">${barSegments}</g>${languageLegend}`
    : `<text x="568" y="82" class="legend">Sem dados de linguagens disponíveis.</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="220" viewBox="0 0 900 220" role="img" aria-labelledby="title description">
  <title id="title">Estatísticas do GitHub e tecnologias de ${profileName}</title>
  <desc id="description">Resumo público do perfil GitHub e linguagens identificadas nos repositórios públicos. Atualizado em ${updated}.</desc>
  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .heading { fill: #70a5fd; font-size: 15px; font-weight: 600; }
    .metric { fill: #a9b1d6; font-size: 12px; }
    .value { fill: #73daca; font-size: 12px; font-weight: 700; }
    .legend { fill: #a9b1d6; font-size: 10px; }
    .updated { fill: #787c99; font-size: 9px; }
  </style>
  <rect x="1" y="1" width="898" height="218" rx="8" fill="#15141e" stroke="#a9a9b3" stroke-width="1.5"/>
  <rect x="12" y="12" width="523" height="196" rx="6" fill="#15141e" stroke="#a9a9b3" stroke-width="1"/>
  <rect x="547" y="12" width="341" height="196" rx="6" fill="#15141e" stroke="#a9a9b3" stroke-width="1"/>
  <text x="32" y="42" class="heading">Estatísticas do GitHub de ${profileName}</text>
  ${metricRows}
  <circle cx="461" cy="117" r="44" fill="#1a1b27" stroke="#70a5fd" stroke-width="8"/>
  <text x="461" y="115" text-anchor="middle" fill="#73daca" font-size="20" font-weight="700">${stars}</text>
  <text x="461" y="132" text-anchor="middle" class="legend">estrelas</text>
  <text x="567" y="43" class="heading">Tecnologias</text>
  ${techContent}
  <text x="32" y="194" class="updated">Dados públicos do GitHub · Atualizado em ${updated}</text>
</svg>
`;
}

const [user, repositories] = await Promise.all([
  github(`/users/${username}`),
  getRepositories(),
]);
const languagesByRepository = await Promise.all(
  repositories.map((repository) =>
    github(`/repos/${username}/${repository.name}/languages`),
  ),
);
const languageTotals = {};

for (const languageData of languagesByRepository) {
  for (const [language, bytes] of Object.entries(languageData)) {
    languageTotals[language] = (languageTotals[language] ?? 0) + bytes;
  }
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, renderStats(user, repositories, languageTotals), "utf8");
process.stderr.write(`Generated ${outputPath}\n`);
