/* Pet Moments: subir fotos (reducidas) y mostrarlas */
if (PN.requireUser()) {
  const form = document.getElementById('moment-form'), grid = document.getElementById('gallery'), msg = document.getElementById('moment-msg');
  const say = t => { msg.textContent = t; msg.hidden = !t; };
  const draw = () => {
    const m = PN.user().moments || [];
    const examples = [
      { img: 'petnova-assets/pet-moments-gato.jpg', caption: 'Un momento especial con mi gato' },
      { img: 'petnova-assets/pet-moments-juego.jpg', caption: 'Tiempo de juego juntos' },
      { img: 'petnova-assets/pet-moments-playa.jpg', caption: 'Una aventura en la playa' }
    ];
    const moments = m.length ? m : examples;
    grid.innerHTML = moments.map((x, i) => `<figure class="shot${i % 5 === 1 ? ' tall' : ''}"><img src="${x.img}" alt="${PN.esc(x.caption || 'Momento de mi mascota')}">
      <figcaption>${PN.esc(x.caption || 'Sin descripción')}${m.length ? `<button class="del" data-del="${x.id}" aria-label="Eliminar foto">×</button>` : ''}</figcaption></figure>`).join('');
  };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(form), file = fd.get('photo');
    if (!file || !file.size) return say('Elige una foto.');
    try {
      const img = await PN.shrink(file, 700), u = PN.user();
      u.moments = u.moments || []; u.moments.unshift({ id: PN.uid(), img, caption: fd.get('caption').trim() });
      if (!PN.save(u)) return say('No hay espacio para guardar más fotos. Elimina alguna.');
      say(''); form.reset(); draw();
    } catch (err) { say('No se pudo leer esa imagen.'); }
  });
  grid.addEventListener('click', e => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    const u = PN.user(); u.moments = u.moments.filter(x => x.id !== b.dataset.del); PN.save(u); draw();
  });
  draw();
}
