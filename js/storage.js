/* Capa de datos de Pet Nova conectada a Supabase (cuentas + base de datos en la nube).
   Mantiene la MISMA interfaz PN que las versiones anteriores, así que las demás páginas no cambian.
   Usa peticiones síncronas para no tener que reescribir el resto del código. */
const PN = (() => {
  /* ===== CONFIGURACIÓN: pega aquí los dos datos de tu proyecto de Supabase =====
     Supabase → Project Settings → API (o "API Keys").
     Usa la clave PÚBLICA (anon / publishable). NUNCA pegues la service_role ni la secret. */
  const SUPABASE_URL = 'https://bjfwmrvrwrtqtcoezveu.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_LX4IQO7yfnEow0p3TCpC0w_wWgpeg15';
  /* ============================================================================= */

  const configured = !SUPABASE_URL.includes('TU-PROYECTO') && !SUPABASE_ANON_KEY.includes('TU-CLAVE');
  const SES = 'petnova:session', PEND = 'petnova:pending', REST = '/rest/v1/profiles';
  const LOST_REST = '/rest/v1/paw_alerts', FOUND_REST = '/rest/v1/paw_found_reports';
  const NOCONF = 'Falta configurar Supabase: pega tu URL y tu clave pública en js/storage.js';
  const OFFLINE = 'No se pudo conectar con el servidor. Revisa tu conexión a internet.';
  const rd = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const wr = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const msg = d => d.msg || d.error_description || d.message || d.error || '';

  /* Petición HTTP síncrona a Supabase */
  const http = (method, path, body, token, extra = {}) => {
    const x = new XMLHttpRequest();
    try {
      x.open(method, SUPABASE_URL + path, false);
      x.setRequestHeader('apikey', SUPABASE_ANON_KEY);
      if (token) x.setRequestHeader('Authorization', 'Bearer ' + token);
      x.setRequestHeader('Content-Type', 'application/json');
      for (const k in extra) x.setRequestHeader(k, extra[k]);
      x.send(body === undefined ? null : JSON.stringify(body));
    } catch (e) { return { status: 0, data: { message: OFFLINE } }; }
    let data = null; try { data = JSON.parse(x.responseText); } catch (e) {}
    return { status: x.status, data: data || {} };
  };

  /* Sesión (tokens) y renovación automática */
  const sess = () => rd(SES);
  const setSess = r => wr(SES, { access: r.access_token, refresh: r.refresh_token,
    exp: r.expires_at ? r.expires_at * 1000 : Date.now() + (r.expires_in || 3600) * 1000,
    uid: r.user.id, email: r.user.email, name: (r.user.user_metadata || {}).name || '' });
  const refresh = () => {
    const s = sess(); if (!s) return false;
    const r = http('POST', '/auth/v1/token?grant_type=refresh_token', { refresh_token: s.refresh });
    if (r.status === 200 && r.data.access_token) { setSess(r.data); return true; }
    if (r.status >= 400 && r.status < 500) wr(SES, null);
    return false;
  };
  const authed = (method, path, body, extra) => {
    let s = sess(); if (!s) return { status: 401, data: {} };
    if (s.exp - Date.now() < 60000 && refresh()) s = sess();
    let r = http(method, path, body, s && s.access, extra);
    if (r.status === 401 && refresh()) r = http(method, path, body, sess().access, extra);
    return r;
  };
  const authMsg = d => {
    const c = String(d.error_code || d.code || ''), m = msg(d);
    if (c === 'user_already_exists' || /already/i.test(m)) return 'Ya existe una cuenta con ese correo. Inicia sesión.';
    if (c === 'weak_password') return 'La contraseña es muy débil. Usa al menos 8 caracteres.';
    if (c === 'invalid_credentials' || /invalid login/i.test(m)) return 'Correo o contraseña incorrectos.';
    if (c === 'email_not_confirmed') return 'Confirma tu correo antes de iniciar sesión.';
    if (/rate_limit/.test(c) || c === '429') return 'Demasiados intentos. Espera unos minutos.';
    if (c === 'validation_failed' || /email.*valid/i.test(m)) return 'El correo no es válido.';
    return m || 'No se pudo completar la solicitud.';
  };

  /* Perfil del usuario (tabla public.profiles) */
  const toUser = (p, s) => ({ id: p.id, name: p.name || '', email: p.email || s.email || '', phone: p.phone || '', city: p.city || '', pets: p.pets || [], moments: p.moments || [] });
  const createProfile = s => {
    const pend = rd(PEND), mine = pend && pend.email === s.email ? pend : null;
    const row = { id: s.uid, email: s.email, name: (mine && mine.name) || s.name || '', phone: mine ? mine.phone : '', city: mine ? mine.city : '', pets: mine && mine.pet ? [mine.pet] : [], moments: [] };
    const r = authed('POST', REST, row, { Prefer: 'return=representation' });
    if (r.status === 201 && Array.isArray(r.data) && r.data[0]) { wr(PEND, null); return r.data[0]; }
    return null;
  };

  let me;
  const user = () => {
    if (me !== undefined) return me;
    const s = sess(); if (!s || !configured) return (me = null);
    const r = authed('GET', REST + '?id=eq.' + s.uid + '&select=*');
    if (r.status === 200 && Array.isArray(r.data)) {
      const row = r.data[0] || createProfile(sess());
      return (me = row ? toUser(row, sess()) : null);
    }
    if (r.status === 401 || r.status === 403) wr(SES, null);
    return (me = null);
  };
  const save = u => {
    const s = sess(); if (!s) return false;
    const r = authed('PATCH', REST + '?id=eq.' + s.uid, { name: u.name, phone: u.phone, city: u.city, pets: u.pets, moments: u.moments, updated_at: new Date().toISOString() }, { Prefer: 'return=representation' });
    if (r.status === 200 && Array.isArray(r.data) && r.data[0]) { me = toUser(r.data[0], s); return true; }
    me = undefined; return false;
  };
  const lostReports = () => {
    const r = authed('GET', LOST_REST + '?select=*&order=created_at.desc');
    if (r.status !== 200 || !Array.isArray(r.data)) return { reports: null, status: r.status };
    return { reports: r.data.map(row => ({
      ownerId: row.owner_id, ownerName: row.owner_name, petId: row.pet_id, petName: row.pet_name,
      species: row.species, photo: row.photo, place: row.place, when: row.last_seen_at,
      notes: row.notes, phone: row.contact_phone, since: row.since
    })), status: r.status };
  };
  const saveLostReport = report => {
    const r = authed('POST', LOST_REST + '?on_conflict=owner_id,pet_id', {
      owner_id: report.ownerId, owner_name: report.ownerName, pet_id: report.petId,
      pet_name: report.petName, species: report.species, photo: report.photo,
      place: report.place, last_seen_at: report.when || null, notes: report.notes,
      contact_phone: report.phone, since: report.since
    }, { Prefer: 'resolution=merge-duplicates,return=representation' });
    return { ok: r.status === 200 || r.status === 201, status: r.status };
  };
  const deleteLostReport = (ownerId, petId) => {
    const r = authed('DELETE', LOST_REST + '?owner_id=eq.' + encodeURIComponent(ownerId) + '&pet_id=eq.' + encodeURIComponent(petId));
    return { ok: r.status === 200 || r.status === 204, status: r.status };
  };
  const foundReports = () => {
    const r = authed('GET', FOUND_REST + '?select=*&order=created_at.asc');
    if (r.status !== 200 || !Array.isArray(r.data)) return { reports: null, status: r.status };
    return { reports: r.data.map(row => ({
      id: row.id, reporterId: row.reporter_id, petOwnerId: row.owner_id, petId: row.pet_id,
      petName: row.pet_name, species: row.species, state: row.state, speciesFound: row.species_found,
      breedDescription: row.breed_description, marks: row.marks, place: row.place,
      when: row.observed_at, media: row.media, mediaType: row.media_type, notes: row.notes,
      phone: row.reporter_phone, reporterName: row.reporter_name, since: row.since
    })), status: r.status };
  };
  const saveFoundReport = report => {
    const r = authed('POST', FOUND_REST, {
      id: report.id, reporter_id: report.reporterId, owner_id: report.petOwnerId,
      pet_id: report.petId, pet_name: report.petName, species: report.species,
      state: report.state, species_found: report.speciesFound,
      breed_description: report.breedDescription, marks: report.marks, place: report.place,
      observed_at: report.when || null, media: report.media, media_type: report.mediaType,
      notes: report.notes, reporter_phone: report.phone, reporter_name: report.reporterName,
      since: report.since
    });
    return { ok: r.status === 201, status: r.status };
  };

  const register = (o, pet) => {
    if (!configured) return { error: NOCONF };
    const email = o.email.trim().toLowerCase();
    const r = http('POST', '/auth/v1/signup', { email, password: o.password, data: { name: o.name.trim() } });
    if (r.status !== 200 && r.status !== 201) return { error: authMsg(r.data) };
    wr(PEND, { email, name: o.name.trim(), phone: o.phone.trim(), city: o.city.trim(), pet });
    if (!r.data.access_token) return { error: 'Te enviamos un correo para confirmar tu cuenta. Confírmalo y luego inicia sesión.' };
    setSess(r.data); me = undefined;
    const u = user();
    return u ? { user: u } : { error: 'La cuenta se creó, pero no se pudo guardar tu perfil. Intenta iniciar sesión.' };
  };
  const login = (email, password) => {
    if (!configured) return { error: NOCONF };
    const r = http('POST', '/auth/v1/token?grant_type=password', { email: email.trim().toLowerCase(), password });
    if (r.status !== 200 || !r.data.access_token) return { error: authMsg(r.data) };
    setSess(r.data); me = undefined;
    const u = user();
    return u ? { user: u } : { error: 'No se pudo cargar tu perfil. Intenta de nuevo.' };
  };
  const logout = () => { const s = sess(); if (s) http('POST', '/auth/v1/logout', undefined, s.access); wr(SES, null); me = null; };
  const deleteAccount = async () => {
    const s = sess();
    if (!s) return { ok: false, error: 'Tu sesión ya no está activa. Inicia sesión de nuevo.' };

    let response;
    try {
      response = await fetch(SUPABASE_URL + '/functions/v1/delete-account', {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + s.access }
      });
    } catch (error) {
      console.error('No se pudo contactar la función de eliminación de cuentas.', error);
      return { ok: false, error: OFFLINE };
    }

    let data = {};
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) {
      if (response.status === 404) return { ok: false, error: 'La eliminación todavía no está activada en Supabase.' };
      return { ok: false, error: data.error || 'No se pudo completar la eliminación. Inténtalo de nuevo.' };
    }

    wr(SES, null);
    wr(PEND, null);
    me = null;
    return { ok: true };
  };
  const requireUser = () => { const u = user(); if (!u) location.replace('login.html'); return u; };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10);

  const shrink = (file, max) => new Promise((ok, no) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', .75)); };
    img.onerror = () => no(new Error('imagen')); img.src = url;
  });

  const petFrom = async fd => {
    const g = k => (fd.get(k) || '').toString().trim(), w = parseFloat(g('weight')), f = fd.get('photo');
    let photo = ''; try { if (f && f.size) photo = await shrink(f, 420); } catch (e) {}
    return { id: uid(), name: g('petName'), species: g('species') || 'Otro', age: g('age'), weight: isNaN(w) ? '' : w, photo,
      vaccination: g('vaccination') || 'No estoy seguro', condition: g('condition'), notes: g('notes'), lost: null };
  };
  const petError = p => !p.name ? 'Escribe el nombre de la mascota.' : !p.age ? 'Indica la edad de la mascota.' : '';

  const EMOJI = { Perro: '🐶', Gato: '🐱', Ave: '🐦', Otro: '🐾' };
  const petCard = (p, full) => {
    const tag = p.lost ? '<span class="tag bad">Extraviada</span>' : p.vaccination === 'Al día' ? '<span class="tag good">Vacunas al día</span>'
      : `<span class="tag">Vacunas: ${esc(p.vaccination.toLowerCase())}</span>`;
    const det = full ? `<dl class="details"><dt>Condición especial</dt><dd>${esc(p.condition || 'Ninguna')}</dd><dt>Notas médicas</dt><dd>${esc(p.notes || 'Sin notas')}</dd></dl>
      <button class="btn btn-ghost" data-del="${p.id}">Eliminar</button>` : '';
    return `<article class="card pet"><div class="avatar">${p.photo ? `<img src="${p.photo}" alt="Foto de ${esc(p.name)}">` : EMOJI[p.species] || '🐾'}</div><h3>${esc(p.name)}</h3>
      <p class="muted">${esc(p.species)} · ${esc(p.age)}${p.weight !== '' ? ' · ' + p.weight + ' kg' : ''}</p>${tag}${det}</article>`;
  };
  document.addEventListener('click', e => { if (e.target.closest('[data-logout]')) logout(); });
  return {
    user, save, lostReports, saveLostReport, deleteLostReport, foundReports, saveFoundReport,
    shrink, petFrom, petError, register, login, logout, deleteAccount, requireUser, petCard, esc, uid
  };
})();
