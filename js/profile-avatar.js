(() => {
  const avatar = document.getElementById('profile-avatar');
  if (!avatar) return;

  const user = PN.user();
  if (!user) return;

  const pets = user.pets || [];
  const pet = pets.find(item => item.photo) || pets[0];
  const label = pet ? `Perfil de ${pet.name}` : `Perfil de ${user.name || 'usuario'}`;
  avatar.setAttribute('aria-label', label);
  avatar.title = label;

  if (pet && pet.photo) {
    avatar.innerHTML = `<img src="${PN.esc(pet.photo)}" alt="">`;
    return;
  }

  const initial = (pet && pet.name || user.name || 'P').trim().charAt(0).toUpperCase();
  avatar.textContent = initial || 'P';
})();
