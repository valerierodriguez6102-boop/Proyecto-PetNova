/* We Care · artículos informativos y jornadas de vacunación cerca del usuario */
(() => {
  const u = PN.requireUser();
  if (!u) return;

  /* ===== CONFIGURACIÓN (opcional): los MISMOS dos datos que pusiste en js/storage.js =====
     Con ellos, las jornadas se leen de tu tabla de Supabase. Sin ellos, se muestran 3 ejemplos. */
  const SUPABASE_URL = 'https://bjfwmrvrwrtqtcoezveu.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_LX4IQO7yfnEow0p3TCpC0w_wWgpeg15';
  /* ====================================================================================== */
  const configured = !SUPABASE_URL.includes('TU-PROYECTO') && !SUPABASE_ANON_KEY.includes('TU-CLAVE');

  /* ===== ARTÍCULOS ===== */
  const ARTICLES = [
    {
      id: 'alimentos-peligrosos',
      title: 'Alimentos prohibidos o peligrosos para perros y gatos',
      category: 'Alimentación / Prevención',
      filters: ['Perros', 'Gatos', 'Alimentación', 'Prevención'],
      img: 'petnova-assets/wecare-alimentos-peligrosos.png',
      lead: '¿Sabías que algunos alimentos de nuestra mesa son tóxicos para tus mascotas?',
      text: 'Aunque a veces queramos compartir un bocado con ellos, el metabolismo de perros y gatos procesa los alimentos de forma muy diferente al nuestro. Conocer qué elementos debemos evitar en casa es el primer paso para prevenir emergencias graves.',
      points: [
        { title: 'Chocolate, café y cafeína', text: 'Contienen teobromina y cafeína, sustancias que sus cuerpos no pueden metabolizar y que afectan directamente su sistema nervioso y cardíaco.' },
        { title: 'Cebolla y ajo', text: 'Contienen compuestos que pueden destruir sus glóbulos rojos, provocando anemia severa, incluso en pequeñas cantidades o cocinados.' },
        { title: 'Uvas y pasas', text: 'Su ingestión puede desencadenar una insuficiencia renal aguda repentina.' },
        { title: 'Huesos cocidos', text: 'Se astillan con extrema facilidad al morderlos, lo que puede perforar su esófago o intestinos.' }
      ],
      note: 'Revisado bajo guías de toxicología veterinaria (basado en estándares de la WSAVA).',
      source: 'Manuales clínicos de toxicología veterinaria y guías de nutrición animal preventiva.',
      sourceLinkLabel: 'Consultar alimentos que deben evitarse · ASPCA',
      sourceUrl: 'https://www.aspca.org/pet-care/aspca-poison-control/people-foods-avoid-feeding-your-pets'
    },
    {
      id: 'golpe-de-calor',
      title: 'Guía de prevención contra el golpe de calor en climas tropicales',
      category: 'Cuidados / Prevención',
      filters: ['Perros', 'Gatos', 'Cuidados', 'Prevención'],
      img: 'petnova-assets/wecare-golpe-calor.jpg',
      lead: 'Protege a tu compañero de las altas temperaturas.',
      text: 'En regiones con climas cálidos y tropicales como Panamá Oeste, las mascotas son muy vulnerables a sufrir un golpe de calor, ya que no sudan como nosotros y regulan su temperatura principalmente jadeando.',
      points: [
        { title: 'Hidratación constante', text: 'Asegúrate de que siempre tengan agua fresca y limpia disponible en varios puntos de la casa.' },
        { title: 'Cuidado con las horas pico', text: 'Evita sacarlos a pasear sobre el asfalto caliente durante las horas de mayor radiación solar; esto puede quemar sus almohadillas.' },
        { title: 'Espacios ventilados', text: 'Nunca dejes a tu mascota dentro de un vehículo estacionado, ni siquiera por unos minutos, ya que la temperatura interior se dispara en cuestión de segundos.' },
        { title: 'Señales de alerta', text: 'Si notas jadeo excesivo, debilidad, babeo espeso o tambaleo, refréscales con paños húmedos (nunca con agua helada) y acude al veterinario de inmediato.' }
      ],
      note: 'Validado para la protección animal en climas tropicales y húmedos.',
      source: 'Guías de bienestar en climas tropicales y recomendaciones de asociaciones veterinarias de animales de compañía.',
      sourceLinkLabel: 'Consejos para el calor · ASPCA',
      sourceUrl: 'https://www.aspca.org/pet-care/general-pet-care/hot-weather-safety-tips'
    },
    {
      id: 'primera-cartilla-vacunacion',
      title: 'La importancia de la primera cartilla de vacunación en cachorros',
      category: 'Salud / Vacunación',
      filters: ['Perros', 'Gatos', 'Salud', 'Vacunación'],
      img: 'petnova-assets/wecare-cartilla-vacunacion.jpg',
      lead: 'El escudo protector durante sus primeros meses de vida.',
      text: 'La vacunación temprana es el pilar fundamental para prevenir enfermedades infecciosas mortales en perros y gatos cachorros, creando una barrera inmunológica sólida antes de que comiencen a explorar el mundo exterior.',
      points: [
        { title: 'Inmunidad inicial', text: 'Durante las primeras semanas, los cachorros dependen de los anticuerpos de la leche materna, pero esta protección disminuye progresivamente.' },
        { title: 'El ciclo clave', text: 'Entre las 6 y 16 semanas de vida se aplican las vacunas esenciales, como la polivalente y la rabia, siguiendo estrictamente el calendario pautado por el veterinario.' },
        { title: 'Desparasitación previa', text: 'El veterinario puede indicar un plan de desparasitación según el estado del cachorro y su calendario de vacunas; consulta con él antes de cada dosis.' },
        { title: 'Socialización segura', text: 'Recuerda completar el esquema antes de exponerlos a parques o a contacto masivo con otros animales desconocidos.' }
      ],
      note: 'Avalado por protocolos estándar de inmunización pediátrica veterinaria.',
      source: 'Guías de vacunación para perros y gatos de la Asociación Mundial de Veterinarios de Pequeños Animales (WSAVA).',
      sourceLinkLabel: 'Guías de vacunación 2024 en español · WSAVA',
      sourceUrl: 'https://wsava.org/wp-content/uploads/2024/05/ESP.-J-of-Small-Animal-Practice-2024-Squires-2024-guidelines-for-the-vaccination-of-dogs-and-cats-compiled-by-the.pdf'
    }
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
  const guideItem = a => `<article class="guide-item" id="art-${a.id}"><img src="${a.img}" alt="" loading="lazy"><div class="guide-item__content">
    <h3>${esc(a.title)}</h3><p class="guide-item__lead">${esc(a.lead)}</p><p>${esc(a.text)}</p>
    <p class="guide-item__note"><strong>Nota de respaldo:</strong> ${esc(a.note)}</p>
    <ul>${a.points.map(point => `<li><strong>${esc(point.title)}:</strong> ${esc(point.text)}</li>`).join('')}</ul>
    <p class="guide-item__source-note"><strong>Fuente consultada:</strong> ${esc(a.source)}</p>
    <a class="source" href="${esc(a.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(a.sourceLinkLabel)}</a></div></article>`;
  const guideDialog = $('guide-dialog');
  const guideTitle = $('guide-title');
  const guideIntro = $('guide-intro');
  const guideList = $('guide-list');
  const showGuideIndex = () => {
    guideTitle.textContent = 'Artículos de We Care';
    guideIntro.textContent = 'Selecciona un artículo para leerlo completo.';
    guideList.innerHTML = ARTICLES.map(a => `<button class="guide-index__item" type="button" data-article="${a.id}">
      <img src="${a.img}" alt="" loading="lazy">
      <span class="guide-index__body"><span class="guide-index__category">${esc(a.category)}</span>
        <strong>${esc(a.title)}</strong><span class="guide-index__more">Leer artículo →</span></span>
    </button>`).join('');
  };
  const showGuideArticle = article => {
    guideTitle.textContent = article.title;
    guideIntro.textContent = article.category;
    guideList.innerHTML = `<button class="btn btn-outline guide-back" type="button" data-guide-index>← Todos los artículos</button>${guideItem(article)}`;
  };
  const openGuide = id => {
    if (!guideDialog.open) guideDialog.showModal();
    const article = ARTICLES.find(item => item.id === id);
    if (article) showGuideArticle(article);
    else showGuideIndex();
    guideDialog.querySelector('.dialog-body').scrollTop = 0;
  };
  $('open-guide').addEventListener('click', () => openGuide());
  guideList.addEventListener('click', e => {
    if (e.target.closest('[data-guide-index]')) {
      showGuideIndex();
      guideDialog.querySelector('.dialog-body').scrollTop = 0;
      return;
    }
    const button = e.target.closest('[data-article]');
    if (button) openGuide(button.dataset.article);
  });
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
