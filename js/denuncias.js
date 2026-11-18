/* Paw Alert · pestañas y denuncias anónimas.
   Las denuncias se envían a Supabase SIN usar tu sesión y SIN datos personales. */
(() => {
  /* ===== CONFIGURACIÓN: pega aquí LOS MISMOS dos datos que pusiste en js/storage.js =====
     La URL termina en .supabase.co (sin /rest/v1/). La clave es la pública (publishable / anon). */
  const SUPABASE_URL = 'https://bjfwmrvrwrtqtcoezveu.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_LX4IQO7yfnEow0p3TCpC0w_wWgpeg15';
  /* ======================================================================================= */

  const $ = id => document.getElementById(id);
  const configured = !SUPABASE_URL.includes('TU-PROYECTO') && !SUPABASE_ANON_KEY.includes('TU-CLAVE');

  /* Aviso emergente */
  let timer;
  const toast = t => { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(timer); timer = setTimeout(() => el.classList.remove('show'), 3200); };

  /* Pestañas */
  const tabs = { lost: ['tab-lost', 'panel-lost'], report: ['tab-report', 'panel-report'] };
  const show = k => {
    for (const [name, [t, p]] of Object.entries(tabs)) {
      const on = name === k;
      $(t).classList.toggle('is-on', on); $(t).setAttribute('aria-selected', String(on)); $(p).hidden = !on;
    }
    try { history.replaceState(null, '', location.pathname + (k === 'report' ? '#denuncia' : '')); } catch (e) {}
  };
  $('tab-lost').addEventListener('click', () => show('lost'));
  $('tab-report').addEventListener('click', () => show('report'));
  window.addEventListener('hashchange', () => show(location.hash === '#denuncia' ? 'report' : 'lost'));
  if (location.hash === '#denuncia') show('report');

  /* Formulario de denuncia */
  const form = $('anon-form'), send = $('anon-send'), msg = $('anon-msg');
  const say = t => { msg.textContent = t; msg.hidden = !t; };
  const reset = () => { form.reset(); say(''); $('anon-thanks').hidden = true; form.hidden = false; };

  $('anon-cancel').addEventListener('click', () => { reset(); show('lost'); });
  $('anon-again').addEventListener('click', reset);

  form.addEventListener('submit', e => {
    e.preventDefault(); say('');
    const d = form.description.value.trim();
    if (!d) return toast('Describe la situación antes de enviar');
    if (d.length < 10) return toast('Agrega un poco más de detalle (mínimo 10 caracteres)');
    if (!configured) return say('Falta configurar Supabase en js/denuncias.js');

    const headers = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
    if (SUPABASE_ANON_KEY.startsWith('eyJ')) headers.Authorization = 'Bearer ' + SUPABASE_ANON_KEY;
    send.disabled = true; send.textContent = 'Enviando…';

    fetch(SUPABASE_URL + '/rest/v1/anonymous_reports', {
      method: 'POST', headers, credentials: 'omit', referrerPolicy: 'no-referrer',
      body: JSON.stringify({ report_type: form.type.value, description: d, location: form.location.value.trim() || null, city: form.city.value.trim() || null })
    }).then(r => {
      if (r.ok) { form.hidden = true; $('anon-thanks').hidden = false; form.reset(); return; }
      say(r.status === 404 ? 'La tabla de denuncias no existe todavía. Ejecuta supabase-denuncias.sql en Supabase.' : 'No se pudo enviar la denuncia. Intenta de nuevo.');
    }).catch(() => say('No se pudo conectar con el servidor. Revisa tu conexión a internet.'))
      .finally(() => { send.disabled = false; send.textContent = 'Enviar denuncia'; });
  });
})();
