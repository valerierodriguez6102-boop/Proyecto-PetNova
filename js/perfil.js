/* Perfil: datos del usuario y gestión de sus mascotas */
if (PN.requireUser()) {
  const list = document.getElementById('pet-list');
  const form = document.getElementById('pet-form');
  const msg = document.getElementById('pet-msg');
  const profileForm = document.getElementById('profile-form');
  const profileMsg = document.getElementById('profile-msg');
  const say = (target, text) => { target.textContent = text; target.hidden = !text; };
  const fillProfile = () => {
    const user = PN.user();
    profileForm.elements.name.value = user.name || '';
    profileForm.elements.email.value = user.email || '';
    profileForm.elements.phone.value = user.phone || '';
    profileForm.elements.city.value = user.city || '';
  };
  const draw = () => {
    const pets = PN.user().pets || [];
    list.innerHTML = pets.length
      ? pets.map(p => PN.petCard(p, true)).join('')
      : '<p class="empty">Aún no tienes mascotas. Usa el formulario para agregar la primera.</p>';
  };

  profileForm.addEventListener('submit', e => {
    e.preventDefault();
    const user = PN.user();
    user.name = profileForm.elements.name.value.trim();
    user.phone = profileForm.elements.phone.value.trim();
    user.city = profileForm.elements.city.value.trim();
    if (!PN.save(user)) return say(profileMsg, 'No se pudieron guardar tus datos. Intenta de nuevo.');
    say(profileMsg, 'Tus datos se guardaron correctamente.');
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const p = await PN.petFrom(new FormData(form)), err = PN.petError(p);
    if (err) return say(msg, err);
    const u = PN.user(); u.pets.push(p);
    if (!PN.save(u)) return say(msg, 'No se pudo guardar la mascota. Prueba con una foto más pequeña.');
    say(msg, ''); form.reset(); draw();
  });
  list.addEventListener('click', e => {
    const b = e.target.closest('[data-del]'); if (!b || !confirm('¿Eliminar esta mascota y sus datos?')) return;
    const u = PN.user(); u.pets = u.pets.filter(p => p.id !== b.dataset.del);
    if (!PN.save(u)) return say(msg, 'No se pudo eliminar la mascota. Intenta de nuevo.');
    say(msg, ''); draw();
  });
  fillProfile(); draw();
}
