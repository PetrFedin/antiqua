// Curated, read-only open-access paintings. Never merge these records with
// Antiqua's sale, auction, ownership, provenance, artist or media authorities.
// All static records were checked against the Art Institute of Chicago API.
// https://api.artic.edu/docs/ — only public-domain paintings may be rendered.

const IIIF_BASE = 'https://www.artic.edu/iiif/2';
const MUSEUM = 'Art Institute of Chicago';
const LICENSE_URL = 'https://creativecommons.org/publicdomain/zero/1.0/';
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Four museum-held paintings with independently verified object IDs and public-domain
// reproductions. Only Seurat has a locally verified museum IIIF image_id.
// The other three deliberately do not invent IIIF identifiers.
const CORE = Object.freeze([
  {id: 27992, imageId: '2d484387-2509-5e8e-2c43-22f9981972eb',
   en: 'A Sunday on La Grande Jatte — 1884', ru: 'Воскресный день на острове Гранд-Жатт',
   artistEn: 'Georges Seurat', artistRu: 'Жорж Сёра',
   date: '1884–1886', medium: 'Oil on canvas', mediumRu: 'Холст, масло',
   dimensions: '207.5 × 308.1 cm', accession: '1926.224', genre: 'figures'},
  {id: 20684, imageId: null,
   en: 'Paris Street; Rainy Day', ru: 'Парижская улица в дождь',
   artistEn: 'Gustave Caillebotte', artistRu: 'Гюстав Кайботт',
   date: '1877', medium: 'Oil on canvas', mediumRu: 'Холст, масло',
   dimensions: '212.2 × 276.2 cm', accession: '1964.336', genre: 'city'},
  {id: 28560, imageId: null,
   en: 'The Bedroom', ru: 'Спальня',
   artistEn: 'Vincent van Gogh', artistRu: 'Винсент Ван Гог',
   date: '1889', medium: 'Oil on canvas', mediumRu: 'Холст, масло',
   dimensions: '73.6 × 92.3 cm', accession: '1926.417', genre: 'interior'},
  {id: 14655, imageId: null,
   en: 'Two Sisters (On the Terrace)', ru: 'Две сестры (на террасе)',
   artistEn: 'Pierre-Auguste Renoir', artistRu: 'Пьер Огюст Ренуар',
   date: '1881', medium: 'Oil on canvas', mediumRu: 'Холст, масло',
   dimensions: '100.5 × 81 cm', accession: '1933.455', genre: 'figures'}
]);

// Mirrors are exact, human-reviewed public-domain reproductions of these works,
// not generated artwork or replacements for the Art Institute's object authority.
// Each page includes a museum accession and licensing history. No hotlink proxy.
const COMMONS = Object.freeze({
  27992: {
    image: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Georges_Seurat_-_Un_dimanche_apr%C3%A8s-midi_%C3%A0_l%27%C3%AEle_de_la_Grande_Jatte.jpg?width=960',
    source: 'https://commons.wikimedia.org/wiki/File:Georges_Seurat_-_Un_dimanche_apr%C3%A8s-midi_%C3%A0_l%27%C3%AEle_de_la_Grande_Jatte.jpg'
  },
  20684: {
    image: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Gustave_Caillebotte_-_Paris_Street%2C_Rainy_Day_-_1964.336_-_Art_Institute_of_Chicago.jpg?width=960',
    source: 'https://commons.wikimedia.org/wiki/File:Gustave_Caillebotte_-_Paris_Street%2C_Rainy_Day_-_1964.336_-_Art_Institute_of_Chicago.jpg'
  },
  28560: {
    image: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Vincent_van_Gogh_-_The_Bedroom_-_1926.417_-_Art_Institute_of_Chicago.jpg?width=960',
    source: 'https://commons.wikimedia.org/wiki/File:Vincent_van_Gogh_-_The_Bedroom_-_1926.417_-_Art_Institute_of_Chicago.jpg'
  },
  14655: {
    image: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Pierre-Auguste_Renoir_-_Two_Sisters_%28On_the_Terrace%29_-_1933.455_-_Art_Institute_of_Chicago.jpg?width=960',
    source: 'https://commons.wikimedia.org/wiki/File:Pierre-Auguste_Renoir_-_Two_Sisters_%28On_the_Terrace%29_-_1933.455_-_Art_Institute_of_Chicago.jpg'
  },
  // Optional artworks are admitted only when the museum API verifies
  // Painting + public domain + IIIF identity; their image mirrors are
  // separately matched to the same museum accession and Commons record.
  16568: {
    image: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Claude_Monet_-_Water_Lilies_-_1933.1157_-_Art_Institute_of_Chicago.jpg?width=960',
    source: 'https://commons.wikimedia.org/wiki/File:Claude_Monet_-_Water_Lilies_-_1933.1157_-_Art_Institute_of_Chicago.jpg'
  },
  16571: {
    image: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Claude_Monet_-_Arrival_of_the_Normandy_Train%2C_Gare_Saint-Lazare_-_Google_Art_Project.jpg?width=960',
    source: 'https://commons.wikimedia.org/wiki/File:Claude_Monet_-_Arrival_of_the_Normandy_Train%2C_Gare_Saint-Lazare_-_Google_Art_Project.jpg'
  },
  111442: {
    image: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Mary_Cassatt_-_The_Child%27s_Bath_-_1910.2_-_Art_Institute_of_Chicago.jpg?width=960',
    source: 'https://commons.wikimedia.org/wiki/File:Mary_Cassatt_-_The_Child%27s_Bath_-_1910.2_-_Art_Institute_of_Chicago.jpg'
  },
  61128: {
    image: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Henri_de_Toulouse-Lautrec_-_At_the_Moulin_Rouge_-_1928.610_-_Art_Institute_of_Chicago.jpg?width=960',
    source: 'https://commons.wikimedia.org/wiki/File:Henri_de_Toulouse-Lautrec_-_At_the_Moulin_Rouge_-_1928.610_-_Art_Institute_of_Chicago.jpg'
  },
  25865: {
    image: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/1937.1039_-_The_Herring_Net.jpg?width=960',
    source: 'https://commons.wikimedia.org/wiki/File:1937.1039_-_The_Herring_Net.jpg'
  }
});

// Other records are never shipped with guessed image IDs or metadata;
// they enter the UI only after live API verification.
const OPTIONAL = Object.freeze([
  {id: 16568, ru: 'Кувшинки', artistRu: 'Клод Моне', genre: 'landscape'},
  {id: 16571, ru: 'Прибытие поезда на вокзал Сен-Лазар', artistRu: 'Клод Моне', genre: 'city'},
  {id: 111442, ru: 'Купание ребёнка', artistRu: 'Мэри Кассат', genre: 'figures'},
  {id: 61128, ru: 'В Мулен Руж', artistRu: 'Анри де Тулуз-Лотрек', genre: 'figures'},
  {id: 25865, ru: 'Сеть для сельди', artistRu: 'Уинслоу Хомер', genre: 'landscape'}
]);

let supplementary = [];
let supplementalPromise = null;
const ru = () => document.documentElement.lang !== 'en';
const copy = (r, e) => ru() ? r : e;
const loc = (item, key = '') => {
  if (key === 'title') return ru() ? item.ru : item.en;
  if (key === 'artist') return ru() ? item.artistRu : item.artistEn;
  if (key === 'medium') return ru() ? item.mediumRu : item.medium;
  return '';
};
const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const sourceFor = item => 'https://www.artic.edu/artworks/' + Number(item.id);
export function museumImageUrl(item, width = 843) {
  if (!ID_PATTERN.test(String(item?.imageId || ''))) return '';
  const w = [400, 843, 1686].includes(Number(width)) ? Number(width) : 843;
  return IIIF_BASE + '/' + item.imageId + '/full/' + w + ',/0/default.jpg';
}
// Wikimedia originals are preferred for verified paintings: Art Institute's IIIF
// gateway may challenge embedded requests. Use the museum IIIF only as a fallback.
export function museumDisplayImageUrl(item, width = 843) {
  return COMMONS[Number(item?.id)]?.image || museumImageUrl(item, width);
}
export function bindMuseumImage(img, item, width = 843) {
  const primary = museumDisplayImageUrl(item, width);
  const museum = museumImageUrl(item, width);
  if (!primary) return;
  img.src = primary;
  img.addEventListener('error', () => {
    if (museum && img.src !== museum && img.dataset.museumMirrorRetried !== 'true') {
      img.dataset.museumMirrorRetried = 'true';
      img.src = museum;
      return;
    }
    imageUnavailable(img);
  });
}
export const featuredMuseumPainting = CORE[0];
export const museumPaintingCount = CORE.length;
const allPaintings = () => [...CORE, ...supplementary];

function paintingCard(item) {
  const article = document.createElement('article');
  article.className = 'museum-artwork-card';
  article.dataset.museumGenre = item.genre;
  article.dataset.museumArtwork = String(item.id);
  article.dataset.museumImageId = item.imageId; // stable evidence even when a remote image fails to load
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'museum-artwork-open';
  open.dataset.museumOpen = String(item.id);
  open.setAttribute('aria-label', loc(item, 'artist') + ' — ' + loc(item, 'title'));
  const media = document.createElement('span');
  media.className = 'museum-artwork-image';
  const img = document.createElement('img');
  img.alt = loc(item, 'artist') + '. ' + loc(item, 'title') + ', ' + item.date;
  img.loading = 'lazy';
  img.decoding = 'async';
  bindMuseumImage(img, item, 400);
  media.append(img);
  const badge = document.createElement('span');
  badge.className = 'museum-artwork-badge';
  badge.textContent = copy('МУЗЕЙ · НЕ ПРОДАЁТСЯ', 'MUSEUM · NOT FOR SALE');
  media.append(badge);
  open.append(media);
  const info = document.createElement('span');
  info.className = 'museum-artwork-info';
  const creator = document.createElement('span');
  creator.className = 'museum-artwork-creator';
  creator.textContent = loc(item, 'artist');
  const title = document.createElement('strong');
  title.textContent = loc(item, 'title');
  const facts = document.createElement('span');
  facts.className = 'museum-artwork-facts';
  facts.textContent = item.date + ' · ' + loc(item, 'medium');
  info.append(creator, title, facts);
  open.append(info);
  article.append(open);
  const foot = document.createElement('div');
  foot.className = 'museum-artwork-source';
  foot.append(document.createTextNode(MUSEUM + ' · CC0'));
  const link = document.createElement('a');
  link.href = sourceFor(item);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = copy('Первоисточник ↗', 'Museum record ↗');
  foot.append(link);
  if (COMMONS[item.id]) {
    const mirror = document.createElement('a');
    mirror.href = COMMONS[item.id].source;
    mirror.target = '_blank';
    mirror.rel = 'noopener noreferrer';
    mirror.textContent = copy('Фото: Wikimedia ↗', 'Image: Wikimedia ↗');
    foot.append(mirror);
  }
  article.append(foot);
  return article;
}

function imageUnavailable(img) {
  const media = img.parentElement;
  if (!media) return;
  img.remove();
  media.classList.add('museum-image-unavailable');
  const note = document.createElement('span');
  note.className = 'museum-image-fallback';
  note.textContent = copy('Изображение временно недоступно — откройте музейный источник',
    'Image unavailable — visit the museum record');
  media.prepend(note);
}

function updateCards(section) {
  const grid = section.querySelector('.museum-open-grid');
  if (!grid) return;
  const genre = section.dataset.museumFilter || 'all';
  const items = allPaintings().filter(item => genre === 'all' || item.genre === genre);
  grid.replaceChildren(...items.map(paintingCard));
  const count = section.querySelector('[data-museum-count]');
  if (count) count.textContent = String(items.length) + copy(' произведений', ' paintings');
}

function applyFilter(section, genre) {
  section.dataset.museumFilter = genre;
  section.querySelectorAll('[data-museum-filter]').forEach(button => {
    const active = button.dataset.museumFilter === genre;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  updateCards(section);
}

async function loadOptionalPaintings() {
  if (supplementalPromise) return supplementalPromise;
  supplementalPromise = (async () => {
    const ids = OPTIONAL.map(x => x.id).join(',');
    const fields = 'id,title,artist_display,date_display,medium_display,dimensions,main_reference_number,artwork_type_title,is_public_domain,image_id';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(
        'https://api.artic.edu/api/v1/artworks?ids=' + ids + '&fields=' + fields,
        {method: 'GET', credentials: 'omit', mode: 'cors', signal: controller.signal}
      );
      if (!response.ok) return [];
      const payload = await response.json();
      const records = Array.isArray(payload?.data) ? payload.data : [];
      supplementary = records.flatMap(record => {
        const hint = OPTIONAL.find(x => x.id === record.id);
        if (!hint || record.is_public_domain !== true ||
            record.artwork_type_title !== 'Painting' ||
            !ID_PATTERN.test(String(record.image_id || ''))) return [];
        const artistEn = String(record.artist_display || '').split(' (')[0].trim();
        return [{
          id: record.id, imageId: record.image_id,
          en: String(record.title || ''), ru: String(record.title || ''),
          artistEn, artistRu: artistEn,
          date: String(record.date_display || '—'),
          medium: String(record.medium_display || 'Painting'),
          mediumRu: String(record.medium_display || 'Живопись'),
          dimensions: String(record.dimensions || '—'),
          accession: String(record.main_reference_number || '—'),
          genre: hint.genre
        }];
      });
      return supplementary;
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  })();
  return supplementalPromise;
}

export function museumGalleryPanel() {
  const section = document.createElement('section');
  section.className = 'page museum-open-access';
  section.id = 'museumOpenAccess';
  section.dataset.museumOpenAccess = '';
  section.dataset.museumFilter = 'all';
  const header = document.createElement('div');
  header.className = 'museum-open-head';
  header.innerHTML =
    '<div><div class="eyebrow">OPEN ACCESS · ' + MUSEUM.toUpperCase() + '</div>' +
    '<h2>' + copy('Великая живопись — в открытом доступе', 'Great paintings, open to explore') + '</h2>' +
    '<p>' + copy(
      'Подлинные музейные изображения для знакомства с ANTIQUA. Сведения получены из открытого каталога музея; это исследовательская подборка, не лоты Antiqua и не предложения о продаже.',
      'Real museum images introducing ANTIQUA. Metadata comes from the museum open catalogue; this is a research selection, not ANTIQUA inventory or an offer for sale.'
    ) + '</p></div>' +
    '<a href="https://www.artic.edu/open-access/open-access-images" target="_blank" rel="noopener noreferrer">' +
    copy('Открытая коллекция музея ↗', 'Museum open access ↗') + '</a>';
  section.append(header);

  const tabs = document.createElement('div');
  tabs.className = 'museum-open-filters';
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', copy('Фильтр музейной подборки', 'Museum collection filter'));
  const filters = [
    ['all', copy('Все картины', 'All paintings')],
    ['landscape', copy('Пейзажи', 'Landscapes')],
    ['city', copy('Город', 'City')],
    ['figures', copy('Люди', 'Figures')],
    ['interior', copy('Интерьеры', 'Interiors')]
  ];
  filters.forEach(([genre, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.museumFilter = genre;
    button.textContent = label;
    button.addEventListener('click', () => applyFilter(section, genre));
    tabs.append(button);
  });
  section.append(tabs);
  const count = document.createElement('div');
  count.className = 'museum-open-count';
  count.dataset.museumCount = '';
  section.append(count);
  const grid = document.createElement('div');
  grid.className = 'museum-open-grid';
  section.append(grid);
  const note = document.createElement('p');
  note.className = 'museum-open-terms';
  note.textContent = copy(
    'Источник изображений: Art Institute of Chicago · Public Domain / CC0. Атрибуция, музейное хранение и права приведены по источнику. Эти картины не принадлежат ANTIQUA, не выставлены на продажу и не подтверждают происхождение других объектов.',
    'Image source: Art Institute of Chicago · Public Domain / CC0. Museum attribution and rights derive from the source. These works are not owned, listed or sold by ANTIQUA and do not establish provenance for other objects.'
  );
  section.append(note);
  applyFilter(section, 'all');

  // A single, bounded optional request. Basic gallery works without network/API.
  loadOptionalPaintings().then(() => {
    if (section.isConnected) updateCards(section);
  });
  return section;
}

function workModal(item) {
  document.querySelector('dialog[data-museum-dialog]')?.remove();
  document.documentElement.classList.remove('museum-modal-open');
  const dialog = document.createElement('dialog');
  dialog.className = 'museum-work-dialog';
  dialog.dataset.museumDialog = '';
  const canvas = document.createElement('div');
  canvas.className = 'museum-work-canvas';
  const image = document.createElement('img');
  image.alt = loc(item, 'artist') + '. ' + loc(item, 'title') + ', ' + item.date;
  image.decoding = 'async';
  bindMuseumImage(image, item, 843);
  canvas.append(image);
  const copyPane = document.createElement('div');
  copyPane.className = 'museum-work-details';
  const close = document.createElement('button');
  close.className = 'museum-work-close';
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', copy('Закрыть', 'Close'));
  close.addEventListener('click', () => dialog.close());
  // Keep the close control outside the scrolling details pane on phones.
  dialog.setAttribute('aria-labelledby', 'museum-work-heading');
  dialog.setAttribute('aria-describedby', 'museum-work-explanation');
  const top = document.createElement('p');
  top.className = 'eyebrow';
  top.textContent = MUSEUM + ' · CC0 / PUBLIC DOMAIN';
  const artist = document.createElement('p');
  artist.className = 'museum-work-author';
  artist.textContent = loc(item, 'artist');
  const heading = document.createElement('h2');
  heading.id = 'museum-work-heading';
  heading.textContent = loc(item, 'title');
  const facts = document.createElement('p');
  facts.textContent = item.date + ' · ' + loc(item, 'medium') + ' · ' + item.dimensions;
  const accession = document.createElement('p');
  accession.className = 'museum-work-accession';
  accession.textContent = copy('Инвентарный № ', 'Accession no. ') + item.accession;
  const explanation = document.createElement('p');
  explanation.className = 'museum-work-disclaimer';
  explanation.id = 'museum-work-explanation';
  explanation.textContent = copy(
    'Музейная работа для изучения. Не является лотом, предложением о продаже или подтверждением экспертизы со стороны ANTIQUA.',
    'Museum reference artwork. Not an auction lot, sale listing, or ANTIQUA authenticity endorsement.'
  );
  const links = document.createElement('div');
  links.className = 'museum-work-links';
  const source = document.createElement('a');
  source.href = sourceFor(item);
  source.target = '_blank';
  source.rel = 'noopener noreferrer';
  source.textContent = copy('Открыть музейную запись ↗', 'Open museum record ↗');
  const full = document.createElement('a');
  full.href = COMMONS[item.id]?.source || museumImageUrl(item, 1686);
  full.target = '_blank';
  full.rel = 'noopener noreferrer';
  full.textContent = COMMONS[item.id]
    ? copy('Открыть изображение в Wikimedia ↗', 'View image at Wikimedia ↗')
    : copy('Изображение в высоком разрешении ↗', 'High-resolution image ↗');
  const license = document.createElement('a');
  license.href = LICENSE_URL;
  license.target = '_blank';
  license.rel = 'noopener noreferrer';
  license.textContent = 'CC0 1.0 ↗';
  links.append(source, full, license);
  copyPane.append(top, artist, heading, facts, accession, explanation, links);
  dialog.append(close, canvas, copyPane);
  document.body.append(dialog);
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('museum-modal-open');
    dialog.remove();
  }, {once: true});
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  document.documentElement.classList.add('museum-modal-open');
}

document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-museum-open]');
  if (!button) return;
  const painting = allPaintings().find(item => String(item.id) === button.dataset.museumOpen);
  if (painting) {
    event.preventDefault();
    workModal(painting);
  }
});
