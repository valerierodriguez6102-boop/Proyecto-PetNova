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

  const shrink = (file, max, upscale = false) => new Promise((ok, no) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const ratio = max / Math.max(img.width, img.height), s = upscale ? ratio : Math.min(1, ratio), c = document.createElement('canvas');
        c.width = img.width * s; c.height = img.height * s;
        const context = c.getContext('2d');
        if (!context) throw new Error('canvas');
        if (upscale) context.imageSmoothingQuality = 'high';
        context.drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/jpeg', upscale ? .92 : .75));
      } catch (error) {
        no(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error('imagen')); };
    img.src = url;
  });

  const petFrom = async fd => {
    const g = k => (fd.get(k) || '').toString().trim(), w = parseFloat(g('weight')), f = fd.get('photo');
    let photo = '';
    if (f && f.size) photo = await shrink(f, 1600, true);
    return { id: uid(), name: g('petName'), species: g('species') || 'Otro', age: g('age'), weight: isNaN(w) ? '' : w, photo,
      vaccination: g('vaccination') || 'No estoy seguro', condition: g('condition'), notes: g('notes'), lost: null };
  };
  const petError = p => !p.name ? 'Escribe el nombre de la mascota.' : !p.age ? 'Indica la edad de la mascota.' : '';

  const communityRequest = async (method, path, body, extraHeaders = {}) => {
    if (!configured) return { ok: false, status: 0, error: NOCONF };
    let session = sess();
    if (!session) return { ok: false, status: 401, error: 'Inicia sesión para usar la comunidad.' };
    if (session.exp - Date.now() < 60000 && refresh()) session = sess();

    const send = token => {
      const headers = {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + token,
        ...extraHeaders
      };
      const isBlob = typeof Blob !== 'undefined' && body instanceof Blob;
      if (body !== undefined && body !== null && !isBlob) headers['Content-Type'] = 'application/json';
      return fetch(SUPABASE_URL + path, {
        method,
        headers,
        body: body === undefined || body === null ? undefined : isBlob ? body : JSON.stringify(body)
      });
    };

    try {
      let response = await send(session.access);
      if (response.status === 401 && refresh()) response = await send(sess().access);
      const responseText = response.status === 204 ? '' : await response.text();
      let data = null;
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          data = { message: responseText };
        }
      }
      return {
        ok: response.ok,
        status: response.status,
        data,
        error: response.ok ? '' : msg(data || {}) || `La solicitud falló (${response.status}).`
      };
    } catch (error) {
      console.error('No se pudo completar una operación de la comunidad:', error);
      return { ok: false, status: 0, error: OFFLINE };
    }
  };

  const encodeStoragePath = path => path.split('/').map(encodeURIComponent).join('/');
  const uploadCommunityImage = async file => {
    const session = sess();
    if (!session) return { ok: false, status: 401, error: 'Inicia sesión para adjuntar imágenes.' };
    const path = `${session.uid}/${Date.now()}-${uid()}.jpg`;
    const result = await communityRequest(
      'POST',
      `/storage/v1/object/community-media/${encodeStoragePath(path)}`,
      file,
      { 'Content-Type': 'image/jpeg', 'x-upsert': 'false' }
    );
    return result.ok ? { ...result, path } : result;
  };

  const removeCommunityImage = path => communityRequest(
    'POST',
    '/storage/v1/object/remove/community-media',
    { prefixes: [path] }
  );

  const createCommunityPost = post => {
    const currentUser = user();
    if (!currentUser) return Promise.resolve({ ok: false, status: 401, error: 'Inicia sesión para publicar.' });
    return communityRequest('POST', '/rest/v1/community_posts?select=*', {
      pet_name: post.petName || 'Mi familia Pet Nova',
      content: post.text,
      post_type: post.type,
      image_path: post.imagePath || null,
      poll_options: post.pollOptions || null
    }, { Prefer: 'return=representation' });
  };

  const listCommunityPosts = async () => {
    const result = await communityRequest(
      'GET',
      '/rest/v1/community_posts?select=id,user_id,author_name,pet_name,content,post_type,image_path,poll_options,created_at&order=created_at.desc'
    );
    if (!result.ok) return result;
    if (!Array.isArray(result.data)) {
      return { ok: false, status: 500, error: 'El servidor devolvió un formato de publicaciones no válido.' };
    }

    const rows = result.data;
    const pollIds = rows.filter(row => row.post_type === 'poll').map(row => row.id);
    const pollResults = new Map();
    if (pollIds.length) {
      const votes = await communityRequest(
        'POST',
        '/rest/v1/rpc/get_community_poll_results',
        { p_post_ids: pollIds }
      );
      if (!votes.ok || !Array.isArray(votes.data)) {
        return { ok: false, status: votes.status, error: votes.error || 'No se pudieron cargar los resultados de las encuestas.' };
      }
      votes.data.forEach(vote => {
        if (!pollResults.has(vote.post_id)) pollResults.set(vote.post_id, []);
        pollResults.get(vote.post_id).push(vote);
      });
    }

    let imageErrors = 0;
    const posts = await Promise.all(rows.map(async row => {
      let image = '';
      if (row.image_path) {
        const signed = await communityRequest(
          'POST',
          `/storage/v1/object/sign/community-media/${encodeStoragePath(row.image_path)}`,
          { expiresIn: 3600 }
        );
        if (signed.ok && signed.data && signed.data.signedURL) {
          image = new URL(signed.data.signedURL, SUPABASE_URL).href;
        } else {
          imageErrors += 1;
          console.error('No se pudo generar un enlace temporal para una imagen de la comunidad:', signed.error);
        }
      }

      let poll = null;
      if (row.post_type === 'poll' && Array.isArray(row.poll_options)) {
        const results = pollResults.get(row.id) || [];
        const userVote = results.find(item => item.user_vote_option);
        poll = {
          options: row.poll_options.map(option => {
            const result = results.find(item => item.option_id === option.id);
            return { id: option.id, text: option.text, votes: Number(result && result.vote_count || 0) };
          }),
          votedOptionId: userVote ? userVote.user_vote_option : ''
        };
      }

      return {
        id: row.id,
        userId: row.user_id,
        author: row.author_name || 'Usuario Pet Nova',
        pet: row.pet_name || 'Comunidad Pet Nova',
        text: row.content,
        image,
        imagePath: row.image_path || '',
        poll,
        createdAt: row.created_at
      };
    }));
    return { ok: true, posts, imageErrors };
  };

  const voteCommunityPoll = (postId, optionId) => communityRequest(
    'POST',
    '/rest/v1/rpc/cast_community_poll_vote',
    { p_post_id: postId, p_option_id: optionId }
  );

  const deleteCommunityPost = postId => communityRequest(
    'DELETE',
    `/rest/v1/community_posts?id=eq.${encodeURIComponent(postId)}`
  );

  const listPetMoments = async () => {
    const result = await communityRequest(
      'GET',
      '/rest/v1/pet_moments?select=id,user_id,author_name,caption,image_path,legacy_id,created_at&order=created_at.desc'
    );
    if (!result.ok) return result;
    if (!Array.isArray(result.data)) {
      return { ok: false, status: 500, error: 'El servidor devolvió un formato de momentos no válido.' };
    }

    const rows = result.data;
    const reactionsById = new Map();
    if (rows.length) {
      const reactions = await communityRequest(
        'POST',
        '/rest/v1/rpc/get_pet_moment_reactions',
        { p_moment_ids: rows.map(row => row.id) }
      );
      if (!reactions.ok || !Array.isArray(reactions.data)) {
        return { ok: false, status: reactions.status, error: reactions.error || 'No se pudieron cargar las reacciones.' };
      }
      reactions.data.forEach(reaction => reactionsById.set(reaction.moment_id, reaction));
    }

    const signedImages = await Promise.all(rows.map(row => communityRequest(
      'POST',
      `/storage/v1/object/sign/community-media/${encodeStoragePath(row.image_path)}`,
      { expiresIn: 3600 }
    )));
    const failedImage = signedImages.find(result => !result.ok || !result.data || !result.data.signedURL);
    if (failedImage) {
      console.error('No se pudo generar un enlace temporal para una foto de Pet Moments:', failedImage.error);
      return { ok: false, status: failedImage.status, error: 'No se pudieron cargar las fotos de Pet Moments.' };
    }

    const moments = rows.map((row, index) => {
      const reaction = reactionsById.get(row.id) || {};
      return {
        id: row.id,
        userId: row.user_id,
        authorName: row.author_name || 'Usuario Pet Nova',
        caption: row.caption || '',
        imagePath: row.image_path,
        image: new URL(signedImages[index].data.signedURL, SUPABASE_URL).href,
        legacyId: row.legacy_id || '',
        createdAt: row.created_at,
        likeCount: Number(reaction.like_count || 0),
        commentCount: Number(reaction.comment_count || 0),
        liked: Boolean(reaction.viewer_liked)
      };
    });
    return { ok: true, moments };
  };

  const createPetMoment = moment => communityRequest(
    'POST',
    '/rest/v1/pet_moments?select=*',
    {
      caption: moment.caption,
      image_path: moment.imagePath,
      legacy_id: moment.legacyId || null
    },
    { Prefer: 'return=representation' }
  );

  const deletePetMoment = async (momentId, imagePath) => {
    const result = await communityRequest(
      'DELETE',
      `/rest/v1/pet_moments?id=eq.${encodeURIComponent(momentId)}`
    );
    if (!result.ok) return result;
    const cleanup = await removeCommunityImage(imagePath);
    return cleanup.ok ? result : { ...result, warning: cleanup.error };
  };

  const setPetMomentLike = (momentId, liked) => liked
    ? communityRequest(
      'POST',
      '/rest/v1/pet_moment_likes',
      { moment_id: momentId },
      { Prefer: 'resolution=ignore-duplicates,return=minimal' }
    )
    : communityRequest(
      'DELETE',
      `/rest/v1/pet_moment_likes?moment_id=eq.${encodeURIComponent(momentId)}`
    );

  const listPetMomentComments = async momentId => {
    const result = await communityRequest(
      'GET',
      `/rest/v1/pet_moment_comments?select=id,moment_id,user_id,author_name,content,created_at&moment_id=eq.${encodeURIComponent(momentId)}&order=created_at.desc&limit=50`
    );
    if (result.ok && !Array.isArray(result.data)) {
      return { ok: false, status: 500, error: 'El servidor devolvió un formato de comentarios no válido.' };
    }
    return result;
  };

  const addPetMomentComment = (momentId, content) => communityRequest(
    'POST',
    '/rest/v1/pet_moment_comments?select=id,moment_id,user_id,author_name,content,created_at',
    { moment_id: momentId, content },
    { Prefer: 'return=representation' }
  );

  const deletePetMomentComment = commentId => communityRequest(
    'DELETE',
    `/rest/v1/pet_moment_comments?id=eq.${encodeURIComponent(commentId)}`
  );

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
    shrink, petFrom, petError, register, login, logout, deleteAccount, requireUser, petCard, esc, uid,
    uploadCommunityImage, removeCommunityImage, createCommunityPost, listCommunityPosts,
    voteCommunityPoll, deleteCommunityPost, listPetMoments, createPetMoment, deletePetMoment,
    setPetMomentLike, listPetMomentComments, addPetMomentComment, deletePetMomentComment
  };
})();
