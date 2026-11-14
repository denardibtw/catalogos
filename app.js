'use strict';
// Portfólio DENARDI.PSD — monta os cards e o leitor a partir de window.CATALOGOS (catalogos.js).
// Você não precisa mexer aqui para adicionar catálogos.

const CONTACT_WHATSAPP = '5516996394919';
const ASSETS = 'catalogos/';
const CATALOGS = Array.isArray(window.CATALOGOS) ? window.CATALOGOS : [];
const byId = new Map(CATALOGS.map(c => [c.id, c]));

const grid = document.getElementById('catalogGrid');
const filtersEl = document.getElementById('filters');
const countEl = document.getElementById('sectionCount');
const modal = document.getElementById('pdfModal');
const pageContent = document.getElementById('modalPageContent');
const previousButton = document.getElementById('prevPage');
const nextButton = document.getElementById('nextPage');
const zoomSelect = document.getElementById('pdfZoom');
const thumbnails = document.getElementById('pdfThumbnails');
const downloadLink = document.getElementById('downloadPdf');
const shareButton = document.getElementById('shareCatalog');
const shareLabel = document.getElementById('shareLabel');

let active = null;
let pageIndex = 0;
let openingElement = null;
let pageFigure = null;

const pad = n => String(n).padStart(2, '0');
const asset = (c, file) => ASSETS + c.id + '/' + file;
const thumbFile = file => file.replace(/^pagina-/, 'miniatura-');
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
const svgArrow = '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';

function whatsappLink(message) {
  return 'https://wa.me/' + CONTACT_WHATSAPP + '?text=' + encodeURIComponent(message);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'style') Object.entries(v).forEach(([p, val]) => node.style.setProperty(p, val));
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

/* ---------- Cards ---------- */
function renderCards() {
  const cards = CATALOGS.map((c, i) => {
    const cover = el('div', { class: 'cover', style: { '--capa': c.cores.capa } }, [
      el('img', { class: 'cover-page cover-page--back', src: asset(c, 'capa-tras.jpg'), alt: '', width: 210, height: 297, loading: 'lazy', decoding: 'async' }),
      el('img', { class: 'cover-page cover-page--front', src: asset(c, 'capa-frente.jpg'), alt: '', width: 210, height: 297, loading: i < 3 ? 'eager' : 'lazy', decoding: 'async' }),
      el('span', { class: 'project-number', 'aria-hidden': 'true', text: pad(i + 1) }),
      el('span', { class: 'project-type', 'aria-hidden': 'true', text: c.formato }),
    ]);
    const body = el('div', { class: 'card-body' }, [
      el('div', { class: 'card-meta' }, [el('span', { text: c.nicho }), el('span', { text: plural(c.paginas.length, 'página', 'páginas') })]),
      el('h3', { text: c.nome }),
      el('p', { text: c.descricao }),
    ]);
    const trigger = el('button', {
      type: 'button', class: 'catalog-trigger', 'data-catalog': c.id,
      'aria-haspopup': 'dialog', 'aria-controls': 'pdfModal',
      'aria-label': c.acao + ' ' + c.nome + ' — ' + c.nicho.toLowerCase(),
      html: c.acao + ' ' + svgArrow,
    });
    trigger.addEventListener('click', () => openCatalog(c.id, 0, trigger));
    return el('article', { class: 'catalog-card', 'data-grupo': c.grupo }, [cover, body, el('div', { class: 'card-bottom' }, [trigger])]);
  });
  grid.replaceChildren(...cards);
}

/* ---------- Filtros ---------- */
function renderFilters() {
  const groups = [];
  CATALOGS.forEach(c => { if (c.grupo && !groups.includes(c.grupo)) groups.push(c.grupo); });
  const options = [['', 'Todos', CATALOGS.length], ...groups.map(g => [g, g, CATALOGS.filter(c => c.grupo === g).length])];
  if (groups.length < 2) { filtersEl.hidden = true; updateCount(CATALOGS.length); return; }
  filtersEl.replaceChildren(...options.map(([value, label, n]) => {
    const b = el('button', { type: 'button', class: 'filter', 'data-filter': value, 'aria-pressed': value === '' ? 'true' : 'false' }, [label + ' ', el('small', { text: n })]);
    b.addEventListener('click', () => applyFilter(value));
    return b;
  }));
  updateCount(CATALOGS.length);
}

function applyFilter(value) {
  let visible = 0;
  grid.querySelectorAll('.catalog-card').forEach(card => {
    const show = !value || card.dataset.grupo === value;
    card.hidden = !show;
    if (show) visible++;
  });
  filtersEl.querySelectorAll('.filter').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === value)));
  updateCount(visible, value);
}

function updateCount(n, group) {
  countEl.innerHTML = '';
  countEl.append(el('span', { text: plural(n, 'projeto', 'projetos') }), group ? group : 'Portfólio');
}

/* ---------- Leitor ---------- */
function openCatalog(id, startPage = 0, trigger = null) {
  const c = byId.get(id);
  if (!c) return;
  active = c;
  pageIndex = Math.min(Math.max(0, startPage), c.paginas.length - 1);
  zoomSelect.value = 'fit';
  openingElement = trigger || document.activeElement;
  modal.style.setProperty('--reader-accent', c.cores.destaque);
  modal.dataset.catalog = c.id;
  document.getElementById('modalCategory').textContent = c.nicho + ' · ' + c.formato;
  document.getElementById('modalTitle').textContent = c.titulo;
  downloadLink.href = asset(c, c.pdf);
  downloadLink.setAttribute('download', c.pdf);
  document.getElementById('modalWhatsappBtn').href = whatsappLink('Olá Henrique! Vi o catálogo "' + c.titulo + '" no seu site e gostaria de fazer um orçamento.');
  renderThumbnails();
  renderModalPage();
  document.body.classList.add('modal-open');
  if (!modal.open) modal.showModal();
  requestAnimationFrame(updateZoom);
}

function closeCatalog() { modal.close(); }

function changePage(delta) { goToPage(pageIndex + delta); }
function goToPage(index) {
  if (!active || index < 0 || index >= active.paginas.length) return;
  pageIndex = index;
  renderModalPage();
  if (document.activeElement === previousButton && previousButton.disabled) nextButton.focus();
  if (document.activeElement === nextButton && nextButton.disabled) previousButton.focus();
}

function renderThumbnails() {
  thumbnails.replaceChildren(...active.paginas.map((p, index) => {
    const button = el('button', { type: 'button', class: 'pdf-thumbnail', 'aria-label': 'Ir para a página ' + (index + 1) }, [
      el('img', { src: asset(active, thumbFile(p.imagem)), alt: '', width: 210, height: 297, loading: 'lazy', decoding: 'async' }),
      el('span', { text: pad(index + 1) }),
    ]);
    button.addEventListener('click', () => goToPage(index));
    return button;
  }));
}

function renderModalPage() {
  const c = active;
  const total = c.paginas.length;
  document.getElementById('pageIndicator').textContent = 'Página ' + (pageIndex + 1) + ' de ' + total;
  previousButton.disabled = pageIndex === 0;
  nextButton.disabled = pageIndex === total - 1;

  pageFigure = el('figure', { class: 'pdf-sheet' }, [
    el('img', { class: 'pdf-page-image', src: asset(c, c.paginas[pageIndex].imagem), alt: c.titulo + ' — página ' + (pageIndex + 1) + ' de ' + total, width: 210, height: 297, decoding: 'async' }),
    el('figcaption', { class: 'sr-only', text: c.paginas[pageIndex].texto || '' }),
  ]);
  pageContent.replaceChildren(pageFigure);
  Array.from(thumbnails.children).forEach((b, i) => i === pageIndex ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  pageContent.scrollTop = 0;
  pageContent.scrollLeft = 0;
  updateZoom();
  // Pré-carrega a próxima página para a troca ser instantânea.
  if (pageIndex + 1 < total) new Image().src = asset(c, c.paginas[pageIndex + 1].imagem);
  setHash(c.id + (pageIndex > 0 ? '/' + (pageIndex + 1) : ''));
}

function updateZoom() {
  if (!modal.open || !pageFigure || pageContent.clientWidth === 0) return;
  const style = getComputedStyle(pageContent);
  const availableWidth = Math.max(80, pageContent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2);
  const availableHeight = Math.max(80, pageContent.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 2);
  let width;
  if (zoomSelect.value === 'fit') width = Math.min(availableWidth, availableHeight * 210 / 297);
  else if (zoomSelect.value === 'width') width = availableWidth;
  else width = (210 / 25.4 * 96) * Number(zoomSelect.value);
  pageFigure.style.width = Math.floor(width) + 'px';
}

/* ---------- Link direto: #kumo ou #kumo/3 ---------- */
function setHash(value) {
  const url = location.pathname + location.search + (value ? '#' + value : '');
  if (location.hash.slice(1) !== value) history.replaceState(null, '', url);
}
function openFromHash() {
  const [id, page] = decodeURIComponent(location.hash.slice(1)).split('/');
  if (!byId.has(id)) return false;
  openCatalog(id, (parseInt(page, 10) || 1) - 1);
  return true;
}

/* ---------- Compartilhar ---------- */
async function shareCurrent() {
  const url = location.origin + location.pathname + '#' + active.id + (pageIndex > 0 ? '/' + (pageIndex + 1) : '');
  const data = { title: active.titulo + ' — DENARDI.PSD', text: 'Veja o catálogo ' + active.titulo + ':', url };
  try {
    if (navigator.share) { await navigator.share(data); return; }
    await navigator.clipboard.writeText(url);
    flashShare('Link copiado');
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    window.prompt('Copie o link:', url);
  }
}
function flashShare(text) {
  shareLabel.textContent = text;
  setTimeout(() => { shareLabel.textContent = 'Compartilhar'; }, 1800);
}

/* ---------- Deslizar para trocar página (zoom = página inteira) ---------- */
let touchStart = null;
pageContent.addEventListener('touchstart', e => {
  touchStart = e.touches.length === 1 && zoomSelect.value === 'fit' ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
}, { passive: true });
pageContent.addEventListener('touchend', e => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) changePage(dx < 0 ? 1 : -1);
}, { passive: true });

/* ---------- Eventos ---------- */
document.querySelectorAll('[data-contact]').forEach(link => {
  link.href = whatsappLink('Olá Henrique! Vi seu portfólio e quero fazer um catálogo em PDF.');
});
zoomSelect.addEventListener('change', () => { updateZoom(); pageContent.scrollTop = 0; pageContent.scrollLeft = 0; });
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(updateZoom).observe(pageContent);
else window.addEventListener('resize', updateZoom);

document.getElementById('closeCatalogButton').addEventListener('click', closeCatalog);
previousButton.addEventListener('click', () => changePage(-1));
nextButton.addEventListener('click', () => changePage(1));
shareButton.addEventListener('click', shareCurrent);
modal.addEventListener('close', () => {
  document.body.classList.remove('modal-open');
  setHash('');
  if (openingElement && openingElement.isConnected) openingElement.focus({ preventScroll: true });
});
modal.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (['SELECT', 'INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); changePage(1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); changePage(-1); }
});
let pointerStartedOutside = false;
const isOutside = e => {
  const r = modal.getBoundingClientRect();
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
};
modal.addEventListener('pointerdown', e => { pointerStartedOutside = isOutside(e); });
modal.addEventListener('click', e => { if (pointerStartedOutside && isOutside(e)) closeCatalog(); pointerStartedOutside = false; });
window.addEventListener('hashchange', () => { if (!openFromHash() && modal.open && !location.hash) closeCatalog(); });

renderCards();
renderFilters();
openFromHash();
