/* Pet Moments · álbumes de la comunidad en 3D, con me gusta y comentarios compartidos */
if (PN.requireUser()) (() => {
  const u = PN.user();

  /* ===== CONFIGURACIÓN: los MISMOS dos datos que pusiste en js/storage.js =====
     Con ellos, los álbumes se comparten con todos los usuarios (Supabase).
     Sin ellos, funcionan solo en este navegador. */
  const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
  const SUPABASE_ANON_KEY = 'TU-CLAVE-ANON-PUBLICA';
  /* ============================================================================ */
  const configured = !SUPABASE_URL.includes('TU-PROYECTO') && !SUPABASE_ANON_KEY.includes('TU-CLAVE');

  /* ---------- Utilidades ---------- */
  const $ = id => document.getElementById(id);
  const esc = PN.esc;
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'i' + Math.random().toString(36).slice(2, 12));
  const me = () => u.name || 'Usuario';
  let toastTimer;
  const toast = t => { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2800); };
  const say = t => { const el = $('moment-msg'); el.textContent = t; el.hidden = !t; };
  const cnt = a => (a && a[0] && a[0].count) || 0;
  const when = t => new Date(t).toLocaleDateString('es-PA', { day: 'numeric', month: 'short' });

  /* ---------- Conexión con Supabase (con renovación de sesión) ---------- */
  const SES = 'petnova:session';
  const sess = () => { try { return JSON.parse(localStorage.getItem(SES)); } catch (e) { return null; } };
  const hdr = (tok, extra) => { const h = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json', ...extra }; if (tok) h.Authorization = 'Bearer ' + tok; return h; };
  let refreshing = null;
  const refresh = () => refreshing || (refreshing = (async () => {
    const s = sess(); if (!s) return false;
    try {
      const r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: hdr(null), body: JSON.stringify({ refresh_token: s.refresh }) });
      if (!r.ok) return false;
      const d = await r.json();
      localStorage.setItem(SES, JSON.stringify({ access: d.access_token, refresh: d.refresh_token, exp: d.expires_at ? d.expires_at * 1000 : Date.now() + (d.expires_in || 3600) * 1000, uid: d.user.id, email: d.user.email, name: (d.user.user_metadata || {}).name || '' }));
      return true;
    } catch (e) { return false; }
  })().finally(() => { refreshing = null; }));
  const call = async (method, path, body, extra) => {
    let s = sess(); if (!configured || !s) return { status: 0, data: null };
    if (s.exp - Date.now() < 60000 && await refresh()) s = sess();
    const go = async t => {
      try {
        const r = await fetch(SUPABASE_URL + path, { method, headers: hdr(t, extra), body: body === undefined ? undefined : JSON.stringify(body) });
        let d = null; try { d = await r.json(); } catch (e) {}
        return { status: r.status, data: d };
      } catch (e) { return { status: 0, data: null }; }
    };
    let r = await go(s.access);
    if (r.status === 401 && await refresh()) r = await go(sess().access);
    return r;
  };
  const ok = r => r.status >= 200 && r.status < 300;
  let remote = false;

  /* ---------- Datos en Supabase: compartidos con todos los usuarios ---------- */
  const RB = {
    async albums() {
      const r = await call('GET', '/rest/v1/moment_albums?select=id,user_id,author,title,cover,created_at,moment_photos(count)&order=created_at.desc&limit=40');
      return r.status === 200 ? r.data.map(a => ({ ...a, count: cnt(a.moment_photos) })) : null;
    },
    async photos(aid) {
      const r = await call('GET', `/rest/v1/moment_photos?select=id,album_id,user_id,author,caption,image,created_at,moment_likes(count),moment_comments(count)&album_id=eq.${aid}&order=created_at.asc&limit=60`);
      if (r.status !== 200) return null;
      let mine = new Set();
      if (r.data.length) { const m = await call('GET', `/rest/v1/moment_likes?select=photo_id&user_id=eq.${u.id}&photo_id=in.(${r.data.map(p => p.id).join(',')})`); if (m.status === 200) mine = new Set(m.data.map(x => x.photo_id)); }
      return r.data.map(p => ({ ...p, likes: cnt(p.moment_likes), ccount: cnt(p.moment_comments), liked: mine.has(p.id) }));
    },
    async createAlbum(title, cover) {
      const r = await call('POST', '/rest/v1/moment_albums', { author: me(), title, cover }, { Prefer: 'return=representation' });
      return r.status === 201 && r.data && r.data[0] ? { ...r.data[0], count: 0 } : null;
    },
    async updateAlbum(id, patch) { return ok(await call('PATCH', `/rest/v1/moment_albums?id=eq.${id}`, patch, { Prefer: 'return=minimal' })); },
    async deleteAlbum(id) { return ok(await call('DELETE', `/rest/v1/moment_albums?id=eq.${id}`)); },
    async addPhoto(aid, caption, image) {
      const r = await call('POST', '/rest/v1/moment_photos', { album_id: aid, author: me(), caption, image }, { Prefer: 'return=representation' });
      return r.status === 201 && r.data && r.data[0] ? { ...r.data[0], likes: 0, ccount: 0, liked: false } : null;
    },
    async deletePhoto(id) { return ok(await call('DELETE', `/rest/v1/moment_photos?id=eq.${id}`)); },
    async like(pid, on) {
      return ok(on ? await call('POST', '/rest/v1/moment_likes', { photo_id: pid }, { Prefer: 'return=minimal' })
                   : await call('DELETE', `/rest/v1/moment_likes?photo_id=eq.${pid}&user_id=eq.${u.id}`));
    },
    async comments(pid) {
      const r = await call('GET', `/rest/v1/moment_comments?select=id,user_id,author,content,created_at&photo_id=eq.${pid}&order=created_at.asc&limit=100`);
      return r.status === 200 ? r.data : null;
    },
    async addComment(pid, content) {
      const r = await call('POST', '/rest/v1/moment_comments', { photo_id: pid, author: me(), content }, { Prefer: 'return=representation' });
      return r.status === 201 && r.data && r.data[0] ? r.data[0] : null;
    }
  };

  /* ---------- Datos locales (solo este navegador) ---------- */
  const LK = 'petnova:moments:v2';
  const ld = () => { try { return JSON.parse(localStorage.getItem(LK)) || { albums: [], photos: [], likes: [], comments: [] }; } catch (e) { return { albums: [], photos: [], likes: [], comments: [] }; } };
  const ls = d => { try { localStorage.setItem(LK, JSON.stringify(d)); return true; } catch (e) { return false; } };
  const LB = {
    async albums() { const d = ld(); return d.albums.map(a => ({ ...a, count: d.photos.filter(p => p.album_id === a.id).length })).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async photos(aid) { const d = ld(); return d.photos.filter(p => p.album_id === aid).sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(p => ({ ...p, likes: d.likes.filter(l => l.photo_id === p.id).length, ccount: d.comments.filter(c => c.photo_id === p.id).length, liked: d.likes.some(l => l.photo_id === p.id && l.user_id === u.id) })); },
    async createAlbum(title, cover) { const d = ld(), a = { id: uid(), user_id: u.id, author: me(), title, cover, created_at: new Date().toISOString() }; d.albums.push(a); return ls(d) ? { ...a, count: 0 } : null; },
    async updateAlbum(id, patch) { const d = ld(), a = d.albums.find(x => x.id === id); if (!a) return false; Object.assign(a, patch); return ls(d); },
    async deleteAlbum(id) { const d = ld(), ids = d.photos.filter(p => p.album_id === id).map(p => p.id); d.albums = d.albums.filter(a => a.id !== id); d.photos = d.photos.filter(p => p.album_id !== id); d.likes = d.likes.filter(l => !ids.includes(l.photo_id)); d.comments = d.comments.filter(c => !ids.includes(c.photo_id)); return ls(d); },
    async addPhoto(aid, caption, image) { const d = ld(), p = { id: uid(), album_id: aid, user_id: u.id, author: me(), caption, image, created_at: new Date().toISOString() }; d.photos.push(p); return ls(d) ? { ...p, likes: 0, ccount: 0, liked: false } : null; },
    async deletePhoto(id) { const d = ld(); d.photos = d.photos.filter(p => p.id !== id); d.likes = d.likes.filter(l => l.photo_id !== id); d.comments = d.comments.filter(c => c.photo_id !== id); return ls(d); },
    async like(pid, on) { const d = ld(); d.likes = d.likes.filter(l => !(l.photo_id === pid && l.user_id === u.id)); if (on) d.likes.push({ photo_id: pid, user_id: u.id }); return ls(d); },
    async comments(pid) { return ld().comments.filter(c => c.photo_id === pid).sort((a, b) => a.created_at.localeCompare(b.created_at)); },
    async addComment(pid, content) { const d = ld(), c = { id: uid(), photo_id: pid, user_id: u.id, author: me(), content, created_at: new Date().toISOString() }; d.comments.push(c); return ls(d) ? c : null; }
  };
  const B = () => (remote ? RB : LB);

  /* ---------- Álbum de ejemplo (solo cuando aún no hay álbumes) ---------- */
  const EX_ALBUM = { id: 'example', example: true, user_id: '', author: 'Pet Nova', title: 'Ejemplos de la comunidad', cover: encodeURI('petnova-assets/perros-portada.jpg'), count: 4, created_at: '' };
  const exPhotos = () => [
    { id: 'ex1', album_id: 'example', user_id: '', author: 'Faby', caption: 'Una pausa al sol con mi gato', image: encodeURI('petnova-assets/gato tomando el sol.jpg'), likes: 14, liked: false, ccount: 2, comments: [{ author: 'Faby', content: '¡Qué tierno se ve! 😍' }, { author: 'Val', content: 'El mejor día sin duda.' }] },
    { id: 'ex2', album_id: 'example', user_id: '', author: 'Val', caption: 'Un rato de juegos en el jardín', image: encodeURI('petnova-assets/06a9c802d457b8550ce79ed099167a71.jpg'), likes: 8, liked: false, ccount: 0, comments: [] },
    { id: 'ex3', album_id: 'example', user_id: '', author: 'Jael', caption: 'Una aventura en la playa', image: encodeURI('petnova-assets/pexels-thoinamcao-10420320.jpg'), likes: 22, liked: false, ccount: 1, comments: [{ author: 'Jael', content: '¡Hermoso paisaje!' }] },
    { id: 'ex4', album_id: 'example', user_id: '', author: 'Pet Nova', caption: 'El día que llegó a iluminar cada rincón de la casa', image: encodeURI('petnova-assets/perros-portada.jpg'), likes: 14, liked: false, ccount: 0, comments: [] }
  ];
  let examplePhotos = null;

  /* ---------- Estado ---------- */
  const PER_PAGE = 4, ROT = [-3, 2.5, -1.5, 3, -2, 1.5, 3, -2.5];
  let albums = [], scope = 'all', cur = 0, spreadPage = 0, view = 'book', query = '', photos = [], loadingPhotos = false, openP = null, dialogMode = 'create', reqId = 0;
  const cache = {};

  const filtered = () => {
    let list = albums.filter(a => (scope === 'all' || a.user_id === u.id) && norm(a.title).includes(norm(query)));
    if (!albums.length && scope === 'all' && !query) list = [EX_ALBUM];
    return list;
  };
  const curAlbum = () => filtered()[cur] || null;
  const mine = a => !!a && !a.example && a.user_id === u.id;
  const likesTotal = () => photos.reduce((n, p) => n + (p.likes || 0), 0);

  /* ---------- Libros laterales en 3D ---------- */
  const placeBook = (el, d) => {
    const a = Math.abs(d), s = Math.sign(d), w = $('cf-stage').clientWidth, small = w < 600;
    const half = Math.min(560, w * 0.8) / 2, base = half + (small ? 24 : 58), gap = small ? 18 : 40;
    if (d === 0) { el.style.opacity = 0; el.style.pointerEvents = 'none'; el.style.transform = 'translate(-50%,-50%) scale(.7)'; return; }
    if (a > 4) { el.style.opacity = 0; el.style.pointerEvents = 'none'; el.style.transform = `translate(-50%,-50%) translateX(${s * (base + 3 * gap)}px) scale(.5)`; return; }
    el.style.pointerEvents = 'auto';
    el.style.opacity = String(Math.max(0.3, 1 - (a - 1) * 0.2));
    el.style.zIndex = String(10 - a);
    el.style.transform = `translate(-50%,-50%) translateX(${s * (base + (a - 1) * gap)}px) translateZ(${-70 * a}px) rotateY(${-s * 58}deg) scale(${1 - a * 0.05})`;
  };

  /* ---------- Libro abierto ---------- */
  const photoHTML = (p, i) => `<button type="button" class="sp" data-photo="${esc(p.id)}" style="--r:${ROT[i % ROT.length]}deg" aria-label="Abrir foto${p.caption ? ': ' + esc(p.caption) : ''}"><img src="${esc(p.image)}" alt=""><span class="likes${p.liked ? ' is-liked' : ''}">♥ ${p.likes || 0}</span></button>`;
  const renderSpread = () => {
    const sp = $('spread'), al = curAlbum();
    if (!al) { sp.hidden = true; return; }
    sp.hidden = false;
    sp.style.animation = 'none'; void sp.offsetWidth; sp.style.animation = '';
    if (loadingPhotos) { sp.innerHTML = '<div class="spread__empty"><strong>Cargando fotos…</strong></div>'; return; }
    if (!photos.length) { sp.innerHTML = `<div class="spread__empty"><strong>Álbum vacío</strong><span>${mine(al) ? 'Agrega la primera foto con el botón +' : 'Todavía no tiene fotos'}</span></div>`; return; }
    const total = Math.max(1, Math.ceil(photos.length / (PER_PAGE * 2)));
    if (spreadPage >= total) spreadPage = total - 1;
    const chunk = photos.slice(spreadPage * PER_PAGE * 2, spreadPage * PER_PAGE * 2 + PER_PAGE * 2);
    const left = chunk.filter((_, i) => i % 2 === 0), right = chunk.filter((_, i) => i % 2 === 1);
    sp.innerHTML = `<div class="leaf leaf--left" data-n="${left.length}">${left.map((p, i) => photoHTML(p, i)).join('')}</div><div class="leaf leaf--right" data-n="${right.length}">${right.map((p, i) => photoHTML(p, i + 3)).join('')}</div>` +
      (total > 1 ? `<div class="spread__pager"><button type="button" data-spread="-1" aria-label="Página anterior">‹</button>${spreadPage + 1} / ${total}<button type="button" data-spread="1" aria-label="Página siguiente">›</button></div>` : '');
  };
  const renderMeta = () => {
    const al = curAlbum();
    $('cf-title').textContent = al ? al.title : (albums.length ? 'Sin resultados' : 'Sin álbumes');
    if (!al) { $('cf-meta').textContent = albums.length ? 'Ningún álbum coincide con tu búsqueda' : 'Crea el primer álbum de la comunidad'; return; }
    const n = loadingPhotos ? al.count : photos.length;
    $('cf-meta').textContent = `por ${al.author}${al.example ? '' : ' · ' + when(al.created_at)} · ${n} ${n === 1 ? 'foto' : 'fotos'}${loadingPhotos ? '' : ' · ♥ ' + likesTotal()}`;
    const edit = mine(al);
    $('act-more').hidden = $('act-delete').hidden = !edit;
    $('act-add').hidden = !edit;
  };
  const loadCurrent = async () => {
    const al = curAlbum(), id = ++reqId;
    if (!al) { photos = []; loadingPhotos = false; renderMeta(); return renderSpread(); }
    if (al.example) { examplePhotos = examplePhotos || exPhotos(); photos = examplePhotos; loadingPhotos = false; }
    else if (cache[al.id]) { photos = cache[al.id]; loadingPhotos = false; }
    else { photos = []; loadingPhotos = true; renderMeta(); renderSpread(); const r = await B().photos(al.id); if (id !== reqId) return; photos = r || []; cache[al.id] = photos; loadingPhotos = false; }
    renderMeta(); renderSpread();
  };

  const renderAll = () => {
    const list = filtered();
    if (cur >= list.length) cur = Math.max(0, list.length - 1);
    $('cf-book-view').hidden = view !== 'book'; $('albums').hidden = view !== 'grid';
    $('view-book').classList.toggle('is-on', view === 'book'); $('view-book').setAttribute('aria-pressed', String(view === 'book'));
    $('view-grid').classList.toggle('is-on', view === 'grid'); $('view-grid').setAttribute('aria-pressed', String(view === 'grid'));
    document.querySelectorAll('[data-scope]').forEach(b => b.classList.toggle('is-on', b.dataset.scope === scope));
    $('cf-books').innerHTML = list.map((a, i) => `<button type="button" class="book" data-i="${i}" aria-label="Álbum ${esc(a.title)}">${a.cover ? `<img src="${esc(a.cover)}" alt="">` : '<span class="book__empty">🐾</span>'}</button>`).join('');
    [...$('cf-books').children].forEach((el, i) => placeBook(el, i - cur));
    $('cf-prev').hidden = $('cf-next').hidden = list.length < 2;
    $('albums').innerHTML = list.length ? list.map((a, i) => `<button type="button" class="album-card" data-open-album="${i}"><span class="album-card__cover">${a.cover ? `<img src="${esc(a.cover)}" alt="">` : '🐾'}</span><strong>${esc(a.title)}</strong><small>por ${esc(a.author)} · ${a.count} fotos</small></button>`).join('')
      : `<p class="empty">${albums.length ? 'Ningún álbum coincide.' : 'Aún no hay álbumes. Crea el primero.'}</p>`;
    fillAlbumSelect();
    loadCurrent();
  };
  const go = n => {
    const len = filtered().length; if (!len) return;
    cur = (n + len) % len; spreadPage = 0;
    [...$('cf-books').children].forEach((el, i) => placeBook(el, i - cur));
    loadCurrent();
  };

  /* ---------- Controles del libro ---------- */
  $('cf-prev').addEventListener('click', () => go(cur - 1));
  $('cf-next').addEventListener('click', () => go(cur + 1));
  $('cf-books').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) go(+b.dataset.i); });
  $('cf-stage').addEventListener('keydown', e => { if (e.key === 'ArrowLeft') go(cur - 1); if (e.key === 'ArrowRight') go(cur + 1); });
  let startX = null;
  $('cf-stage').addEventListener('pointerdown', e => { startX = e.clientX; });
  $('cf-stage').addEventListener('pointerup', e => { if (startX === null) return; const dx = e.clientX - startX; startX = null; if (Math.abs(dx) > 60) go(cur + (dx < 0 ? 1 : -1)); });
  window.addEventListener('resize', () => { if (view === 'book') [...$('cf-books').children].forEach((el, i) => placeBook(el, i - cur)); });
  $('view-book').addEventListener('click', () => { view = 'book'; renderAll(); });
  $('view-grid').addEventListener('click', () => { view = 'grid'; renderAll(); });
  $('toggle-search').addEventListener('click', () => { const s = $('album-search'); s.hidden = !s.hidden; if (!s.hidden) s.focus(); else { query = ''; s.value = ''; cur = 0; renderAll(); } });
  $('album-search').addEventListener('input', e => { query = e.target.value; cur = 0; spreadPage = 0; renderAll(); });
  document.querySelectorAll('[data-scope]').forEach(b => b.addEventListener('click', () => { scope = b.dataset.scope; cur = 0; spreadPage = 0; renderAll(); }));
  $('albums').addEventListener('click', e => { const b = e.target.closest('[data-open-album]'); if (!b) return; cur = +b.dataset.openAlbum; spreadPage = 0; view = 'book'; renderAll(); });

  /* ---------- Ventanas ---------- */
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); }));

  /* ---------- Foto ampliada: me gusta y comentarios ---------- */
  const renderComments = list => {
    $('photo-comments').innerHTML = list.length ? list.map(c => `<div class="comment-row"><b>${esc(c.author)}:</b> ${esc(c.content)}</div>`).join('') : '<div class="comment-row"><small>Sé el primero en comentar...</small></div>';
    $('photo-ccount').textContent = list.length;
  };
  let openComments = [];
  $('spread').addEventListener('click', async e => {
    const pg = e.target.closest('[data-spread]');
    if (pg) { const total = Math.ceil(photos.length / (PER_PAGE * 2)); spreadPage = (spreadPage + +pg.dataset.spread + total) % total; return renderSpread(); }
    const ph = e.target.closest('[data-photo]'); if (!ph) return;
    const p = photos.find(x => x.id === ph.dataset.photo); if (!p) return;
    openP = p; $('photo-big').src = p.image; $('photo-big').alt = p.caption || 'Foto del álbum';
    $('photo-cap').textContent = p.caption ? `“${p.caption}”` : 'Sin descripción'; $('photo-by').textContent = `Compartida por ${p.author}`;
    $('photo-likes').textContent = p.likes || 0; $('photo-like').setAttribute('aria-pressed', String(!!p.liked));
    $('photo-delete').hidden = !(p.user_id === u.id && !curAlbum().example);
    openComments = p.comments || []; renderComments(openComments); $('photo-dialog').showModal();
    if (!p.comments) { const r = await B().comments(p.id); if (openP === p) { openComments = r || []; renderComments(openComments); } }
  });
  $('photo-like').addEventListener('click', async () => {
    const p = openP; if (!p) return;
    p.liked = !p.liked; p.likes = Math.max(0, (p.likes || 0) + (p.liked ? 1 : -1));
    $('photo-likes').textContent = p.likes; $('photo-like').setAttribute('aria-pressed', String(p.liked)); renderMeta(); renderSpread();
    if (!curAlbum().example && !(await B().like(p.id, p.liked))) {
      p.liked = !p.liked; p.likes = Math.max(0, p.likes + (p.liked ? 1 : -1));
      $('photo-likes').textContent = p.likes; renderMeta(); renderSpread(); toast('No se pudo guardar tu me gusta');
    }
  });
  $('comment-form').addEventListener('submit', async e => {
    e.preventDefault(); const p = openP, text = $('comment-input').value.trim(); if (!p || !text) return;
    let c;
    if (curAlbum().example) { c = { author: me(), content: text }; p.comments = p.comments || []; p.comments.push(c); }
    else { c = await B().addComment(p.id, text); if (!c) return toast('No se pudo enviar el comentario'); openComments.push(c); }
    p.ccount = (p.ccount || 0) + 1; $('comment-input').value = ''; renderComments(curAlbum().example ? p.comments : openComments);
  });
  $('photo-delete').addEventListener('click', async () => {
    const p = openP; if (!p || !confirm('¿Eliminar esta foto?')) return;
    if (!(await B().deletePhoto(p.id))) return toast('No se pudo eliminar la foto');
    const al = curAlbum(); photos = photos.filter(x => x.id !== p.id); cache[al.id] = photos; al.count = photos.length;
    openP = null; $('photo-dialog').close(); renderMeta(); renderSpread(); toast('Foto eliminada');
  });

  /* ---------- Álbumes: crear, renombrar, eliminar, compartir ---------- */
  const openAlbumDialog = mode => {
    dialogMode = mode; $('album-msg').hidden = true; $('album-form').reset();
    $('album-dialog-title').textContent = mode === 'create' ? 'Crear álbum' : 'Renombrar álbum';
    $('album-save').textContent = mode === 'create' ? 'Crear álbum' : 'Guardar';
    if (mode === 'rename') $('album-name').value = curAlbum().title;
    $('album-dialog').showModal(); $('album-name').focus();
  };
  $('new-album').addEventListener('click', () => openAlbumDialog('create'));
  $('act-more').addEventListener('click', () => { if (mine(curAlbum())) openAlbumDialog('rename'); });
  $('album-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('album-name').value.trim().slice(0, 60); if (!name) return;
    const btn = $('album-save'); btn.disabled = true;
    if (dialogMode === 'create') {
      const a = await B().createAlbum(name, '');
      btn.disabled = false; if (!a) { $('album-msg').textContent = 'No se pudo crear el álbum. Intenta de nuevo.'; $('album-msg').hidden = false; return; }
      albums.unshift(a); prefAlbum = a.id; scope = 'all'; query = ''; $('album-search').value = ''; cur = 0; toast('Álbum creado');
    } else {
      const a = curAlbum(); const done = await B().updateAlbum(a.id, { title: name }); btn.disabled = false;
      if (!done) { $('album-msg').textContent = 'No se pudo renombrar.'; $('album-msg').hidden = false; return; }
      a.title = name; toast('Álbum renombrado');
    }
    $('album-dialog').close(); view = 'book'; spreadPage = 0; renderAll();
  });
  $('act-delete').addEventListener('click', async () => {
    const a = curAlbum(); if (!mine(a) || !confirm(`¿Eliminar el álbum «${a.title}» y todas sus fotos?`)) return;
    if (!(await B().deleteAlbum(a.id))) return toast('No se pudo eliminar el álbum');
    albums = albums.filter(x => x.id !== a.id); delete cache[a.id]; spreadPage = 0; renderAll(); toast('Álbum eliminado');
  });
  $('act-share').addEventListener('click', () => {
    const a = curAlbum(); if (!a) return;
    const text = `Mira el álbum «${a.title}» de ${a.author} en Pet Nova`, url = location.href.split('#')[0];
    if (navigator.share) navigator.share({ title: a.title, text, url }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(`${text}: ${url}`).then(() => toast('Enlace copiado'), () => toast('No se pudo copiar'));
    else toast('Tu navegador no permite compartir');
  });
  $('act-add').addEventListener('click', () => {
    const a = curAlbum(); if (!mine(a)) return;
    $('moment-album').value = a.id; syncNewAlbum();
    $('moment-form').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('moment-photo').focus();
  });

  /* ---------- Formulario: compartir una foto ---------- */
  let prefAlbum = null;
  const fillAlbumSelect = () => {
    const sel = $('moment-album'), want = prefAlbum || sel.value, own = albums.filter(a => a.user_id === u.id);
    prefAlbum = null;
    sel.innerHTML = own.map(a => `<option value="${esc(a.id)}">${esc(a.title)}</option>`).join('') + '<option value="__new__">➕ Crear álbum nuevo</option>';
    sel.value = [...sel.options].some(o => o.value === want) ? want : (own[0] ? own[0].id : '__new__');
    syncNewAlbum();
  };
  const syncNewAlbum = () => { $('new-album-label').hidden = $('moment-album').value !== '__new__'; };
  $('moment-album').addEventListener('change', syncNewAlbum);
  $('moment-form').addEventListener('submit', async e => {
    e.preventDefault(); say('');
    const f = e.target, file = f.photo.files[0]; if (!file) return say('Elige una foto.');
    const isNew = f.album.value === '__new__', title = f.newAlbum.value.trim().slice(0, 60);
    if (isNew && !title) return say('Escribe un nombre para el álbum nuevo.');
    const btn = $('moment-send'); btn.disabled = true; btn.textContent = 'Compartiendo…';
    const finish = () => { btn.disabled = false; btn.textContent = 'Compartir momento'; };
    let image, thumb;
    try { image = await PN.shrink(file, 640); thumb = await PN.shrink(file, 200); } catch (err) { finish(); return say('No se pudo leer esa imagen.'); }
    let album;
    if (isNew) { album = await B().createAlbum(title, thumb); if (!album) { finish(); return say('No se pudo crear el álbum. Intenta de nuevo.'); } albums.unshift(album); }
    else album = albums.find(a => a.id === f.album.value);
    if (!album) { finish(); return say('Elige un álbum.'); }
    const p = await B().addPhoto(album.id, f.caption.value.trim().slice(0, 120), image);
    if (!p) { finish(); return say('No se pudo compartir la foto. Prueba con una imagen más pequeña.'); }
    if (!album.cover) { album.cover = thumb; await B().updateAlbum(album.id, { cover: thumb }); }
    album.count = (album.count || 0) + 1; delete cache[album.id];
    f.reset(); finish(); prefAlbum = album.id; scope = 'all'; query = ''; $('album-search').value = '';
    cur = Math.max(0, filtered().findIndex(a => a.id === album.id)); spreadPage = 0; view = 'book'; renderAll(); toast('Momento compartido con la comunidad');
  });

  /* ---------- Arranque ---------- */
  (async () => {
    if (configured && sess()) remote = (await call('GET', '/rest/v1/moment_albums?select=id&limit=1')).status === 200;
    const note = $('mode-note');
    if (!configured) { note.textContent = 'Modo local: los álbumes solo se ven en este navegador. Para compartirlos con otros usuarios, pega tu URL y tu clave de Supabase en js/moments.js.'; note.hidden = false; }
    else if (!remote) { note.textContent = 'Los álbumes se guardan solo en este navegador porque faltan las tablas en Supabase. Ejecuta supabase-moments.sql.'; note.hidden = false; }
    albums = (await B().albums()) || [];
    renderAll();
  })();
})();
