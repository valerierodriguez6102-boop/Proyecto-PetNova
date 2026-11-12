/* We Care · artículos informativos y jornadas de vacunación cerca del usuario */
(() => {
  const u = PN.requireUser();
  if (!u) return;

  /* ===== CONFIGURACIÓN (opcional): los MISMOS dos datos que pusiste en js/storage.js =====
     Con ellos, las jornadas se leen de tu tabla de Supabase. Sin ellos, se muestran 3 ejemplos. */
  const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
  const SUPABASE_ANON_KEY = 'TU-CLAVE-ANON-PUBLICA';
  /* ====================================================================================== */
  const configured = !SUPABASE_URL.includes('TU-PROYECTO') && !SUPABASE_ANON_KEY.includes('TU-CLAVE');

  /* ===== ARTÍCULOS: resúmenes propios enlazados a fuentes veterinarias ===== */
  const ARTICLES = [
    { id: 'cuidados-perro', title: 'Cuidados generales para perros', category: 'Cuidados', filters: ['Perros', 'Cuidados'], img: 'petnova-assets/07fc70b2ebea6f8e443dffa8ceeda5d6.jpg',
      text: 'La alimentación, el agua limpia, la actividad física y el aseo forman parte del cuidado diario. Las necesidades cambian según la edad, la salud y el tipo de perro; adapta su rutina y consulta a un veterinario cuando tengas dudas.',
      source: 'General Dog Care · ASPCA', sourceUrl: 'https://www.aspca.org/pet-care/dog-care/general-dog-care' },
    { id: 'cuidados-gato', title: 'Cuidados generales para gatos', category: 'Cuidados', filters: ['Gatos', 'Cuidados'], img: 'petnova-assets/5c11a58dfac731d2833e48211d9dc9f6.jpg',
      text: 'Ofrece agua fresca y un alimento completo apropiado para su etapa de vida. El cepillado regular ayuda a mantener el pelaje, y un espacio limpio y tranquilo contribuye a su bienestar. Si notas cambios persistentes en su apetito o energía, consulta con su veterinario.',
      source: 'General Cat Care · ASPCA', sourceUrl: 'https://www.aspca.org/pet-care/cat-care/general-cat-care' },
    { id: 'alimentos-peligrosos', title: 'Alimentos que pueden ser peligrosos', category: 'Alimentación', filters: ['Perros', 'Gatos', 'Alimentación'], img: 'petnova-assets/9edf9b6c85ec664ea6da30d59993faa5.jpg',
      text: 'Chocolate, café, uvas y pasas, cebolla, ajo y productos con xilitol pueden ser peligrosos para las mascotas. Si sospechas que ingirió algo dañino, anota qué comió y cuánto, y contacta de inmediato a un veterinario; no esperes a que aparezcan síntomas.',
      source: 'People Foods to Avoid Feeding Your Pets · ASPCA', sourceUrl: 'https://www.aspca.org/pet-care/aspca-poison-control/people-foods-avoid-feeding-your-pets' },
    { id: 'vacunacion', title: 'Vacunación de perros y gatos', category: 'Prevención', filters: ['Perros', 'Gatos', 'Prevención'], img: 'petnova-assets/617a032c91678c37343209bb6bef2f6d.jpg',
      text: 'Las recomendaciones de vacunación dependen de la región y de los riesgos de cada animal. Revisa su carné con un veterinario para establecer qué vacunas necesita y cuándo aplicar los refuerzos. WSAVA ofrece sus guías globales de 2024 también en español.',
      source: 'Guías de vacunación 2024 · WSAVA (PDF en español)', sourceUrl: 'https://wsava.org/wp-content/uploads/2024/05/ESP.-J-of-Small-Animal-Practice-2024-Squires-2024-guidelines-for-the-vaccination-of-dogs-and-cats-compiled-by-the.pdf' },
    { id: 'entrenamiento-positivo', title: 'Entrenamiento basado en recompensas', category: 'Comportamiento', filters: ['Perros', 'Comportamiento'], img: 'petnova-assets/0bec61dad5f0b657afa665d09a73fd9e.jpg',
      text: 'La Sociedad Veterinaria Estadounidense de Comportamiento Animal recomienda métodos basados en recompensas para el entrenamiento canino y la modificación de conducta. Si el comportamiento te preocupa, pide orientación a tu veterinario y a un profesional calificado.',
      source: 'Position Statements · AVSAB', sourceUrl: 'https://avsab.org/resources/position-statements/' }
  ];

  /* ===== Utilidades ===== */
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('es-PA', { day: 'numeric', month: 'long', year: 'numeric' });
  const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
  const km = (a, b) => {
    const r = x => x * Math.PI / 180, dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };
  const ICON_PIN = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';

  /* ===== Ventanas (diálogos) ===== */
  const closeOnBackdrop = d => d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
  closeOnBackdrop($('guide-dialog')); closeOnBackdrop($('vday-dialog'));

  /* ===== Artículos: filtros + lecturas destacadas ===== */
  const tile = a => `<button class="article-card" type="button" data-article="${a.id}">
    <img src="${a.img}" alt="" loading="lazy">
    <span class="article-card__label">${esc(a.category)}</span>
    <strong>${esc(a.title)}</strong>
    <span class="article-card__more">Ver resumen <span aria-hidden="true">→</span></span>
  </button>`;
  const renderArticles = filter => {
    const articles = ARTICLES.filter(article => filter === 'Todos' || article.filters.includes(filter));
    const extra = articles.slice(3);
    $('collage').innerHTML = articles.slice(0, 3).map(tile).join('') || '<p class="empty">No hay artículos para este filtro.</p>';
    $('lecturas').hidden = !extra.length;
    if (!extra.length) {
      $('stories-layout').innerHTML = '';
      return;
    }
    const [feature, ...moreStories] = extra;
    $('stories-layout').classList.toggle('is-single', !moreStories.length);
    $('stories-layout').innerHTML = `<button class="story-feature" type="button" data-article="${feature.id}">
      <img src="${feature.img}" alt="" loading="lazy">
      <span class="story-feature__body"><span class="story-meta">${esc(feature.category)} · We Care</span>
        <h3>${esc(feature.title)}</h3><p>${esc(feature.text)}</p>
        <span class="story-feature__more">Ver resumen <span aria-hidden="true">→</span></span>
      </span>
    </button>${moreStories.length ? `<div class="story-list">${moreStories.map(article => `<button class="story-item" type="button" data-article="${article.id}">
      <img src="${article.img}" alt="" loading="lazy">
      <span class="story-item__body"><span class="story-meta">${esc(article.category)} · We Care</span>
        <h3>${esc(article.title)}</h3><p>${esc(article.text)}</p>
      </span>
    </button>`).join('')}</div>` : ''}`;
  };
  renderArticles('Todos');
  $('guide-list').innerHTML = ARTICLES.map(a => `<article class="guide-item" id="art-${a.id}"><img src="${a.img}" alt="" loading="lazy"><div>
    <h3>${esc(a.title)}</h3><p>${esc(a.text)}</p><a class="source" href="${esc(a.sourceUrl)}" target="_blank" rel="noopener noreferrer">Abrir fuente original · ${esc(a.source)}</a></div></article>`).join('');
  const openGuide = id => {
    $('guide-dialog').showModal();
    const el = id && $('art-' + id);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }));
    else $('guide-dialog').querySelector('.dialog-body').scrollTop = 0;
  };
  $('open-guide').addEventListener('click', () => openGuide());
  $('article-filters').addEventListener('click', e => {
    const button = e.target.closest('[data-filter]');
    if (!button) return;
    $('article-filters').querySelectorAll('[data-filter]').forEach(filterButton => {
      const selected = filterButton === button;
      filterButton.classList.toggle('is-active', selected);
      filterButton.setAttribute('aria-pressed', String(selected));
    });
    renderArticles(button.dataset.filter);
  });
  $('collage').addEventListener('click', e => { const t = e.target.closest('[data-article]'); if (t) openGuide(t.dataset.article); });
  $('stories-layout').addEventListener('click', e => { const t = e.target.closest('[data-article]'); if (t) openGuide(t.dataset.article); });

  /* ===== Jornadas de vacunación ===== */
  let events = [], pos = null;
  const EVENT_IMAGES = [
    'petnova-assets/617a032c91678c37343209bb6bef2f6d.jpg',
    'petnova-assets/0bec61dad5f0b657afa665d09a73fd9e.jpg',
    'petnova-assets/5c11a58dfac731d2833e48211d9dc9f6.jpg'
  ];
  const note = t => { $('loc-note').textContent = t; };

  const examples = () => [
    { id: 'ej1', name: 'Jornada de Vacunación San Miguelito', event_date: addDays(14), place: 'Parque Los Andes', city: 'San Miguelito', lat: 9.0333, lng: -79.5, details: '', is_example: true },
    { id: 'ej2', name: 'Jornada de Vacunación La Chorrera', event_date: addDays(21), place: 'Plaza Central', city: 'La Chorrera', lat: 8.88, lng: -79.7833, details: '', is_example: true },
    { id: 'ej3', name: 'Jornada de Vacunación Arraiján', event_date: addDays(28), place: 'Cancha Municipal', city: 'Arraiján', lat: 8.95, lng: -79.65, details: '', is_example: true }
  ];

  const render = () => {
    if (!events.length) { $('vdays').innerHTML = '<p class="empty">No hay jornadas programadas por ahora. Vuelve pronto.</p>'; return; }
    const list = events.map(e => ({ ...e, dist: pos && e.lat != null && e.lng != null ? km(pos, { lat: e.lat, lng: e.lng }) : null, mine: !!u.city && norm(e.city) === norm(u.city) }))
      .sort((a, b) => pos ? (a.dist ?? 1e9) - (b.dist ?? 1e9) || a.event_date.localeCompare(b.event_date)
                          : (b.mine - a.mine) || a.event_date.localeCompare(b.event_date));
    $('vdays').innerHTML = list.map((e, index) => `<article class="vday">
      <div class="vday__image"><img src="${esc(e.image || e.photo || EVENT_IMAGES[index % EVENT_IMAGES.length])}" alt="" loading="lazy"><span class="vday__date">${esc(fmtDate(e.event_date))}</span></div>
      <div class="vday__body">
      <div class="vday__tags">${e.is_example ? '<span class="pill">Ejemplo</span>' : ''}${e.mine ? '<span class="pill pill--city">En tu ciudad</span>' : ''}${e.dist != null ? `<span class="pill pill--near">A ${e.dist < 10 ? e.dist.toFixed(1) : Math.round(e.dist)} km</span>` : ''}</div>
      <h3>${esc(e.name)}</h3>
      <p class="vday__line">${ICON_PIN}${esc(e.place)}, ${esc(e.city)}</p>
      <button class="btn btn-primary" type="button" data-vday="${esc(e.id)}">Ver detalles</button></div></article>`).join('');
  };

  $('vdays').addEventListener('click', e => {
    const b = e.target.closest('[data-vday]'); if (!b) return;
    const v = events.find(x => String(x.id) === b.dataset.vday); if (!v) return;
    $('vday-title').textContent = v.name;
    $('vday-facts').innerHTML = `<dt>Fecha</dt><dd>${esc(fmtDate(v.event_date))}</dd><dt>Lugar</dt><dd>${esc(v.place)}</dd><dt>Ciudad</dt><dd>${esc(v.city)}</dd>`;
    $('vday-details').textContent = v.details || 'Consulta el horario y los requisitos con el organizador de la jornada.';
    $('vday-map').href = 'https://www.openstreetmap.org/search?query=' + encodeURIComponent(v.place + ', ' + v.city);
    $('vday-dialog').showModal();
  });

  $('use-location').addEventListener('click', () => {
    if (!navigator.geolocation) return note('Tu navegador no permite usar la ubicación.');
    note('Buscando tu ubicación…');
    navigator.geolocation.getCurrentPosition(p => {
      pos = { lat: p.coords.latitude, lng: p.coords.longitude };
      note('Ordenadas de la más cercana a la más lejana. Tu ubicación solo se usa en tu navegador y no se guarda.');
      render();
    }, () => note('No pudimos obtener tu ubicación' + (u.city ? '. Te mostramos primero las jornadas de ' + u.city + '.' : '.')), { timeout: 10000, maximumAge: 600000 });
  });

  note(u.city ? 'Mostramos primero las jornadas de ' + u.city + '. Pulsa "Usar mi ubicación" para ordenarlas por cercanía.' : 'Pulsa "Usar mi ubicación" para ordenarlas por cercanía.');
  $('vdays').innerHTML = '<p class="empty">Cargando jornadas…</p>';

  const load = () => {
    if (!configured) return Promise.resolve(null);
    const h = { apikey: SUPABASE_ANON_KEY };
    if (SUPABASE_ANON_KEY.startsWith('eyJ')) h.Authorization = 'Bearer ' + SUPABASE_ANON_KEY;
    return fetch(SUPABASE_URL + '/rest/v1/vaccination_days?select=*&event_date=gte.' + new Date().toLocaleDateString('en-CA') + '&order=event_date.asc', { headers: h })
      .then(r => r.ok ? r.json() : null).catch(() => null);
  };
  load().then(rows => { events = Array.isArray(rows) ? rows : examples(); render(); });
})();
