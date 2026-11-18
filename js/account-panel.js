(() => {
  const avatar = document.getElementById('profile-avatar');
  if (!avatar) return;

  const user = PN.user();
  if (!user) return;

  const escape = PN.esc;
  const drawer = document.createElement('dialog');
  drawer.className = 'account-drawer';
  drawer.id = 'account-drawer';
  drawer.setAttribute('aria-labelledby', 'account-drawer-title');
  drawer.innerHTML = `<div class="account-drawer__content">
    <header class="account-drawer__header">
      <div>
        <span class="account-drawer__eyebrow">CUENTA</span>
        <h2 id="account-drawer-title">${escape(user.name || 'Mi cuenta')}</h2>
        <p>${escape(user.email || '')}</p>
      </div>
      <button class="account-drawer__close" type="button" aria-label="Cerrar panel">×</button>
    </header>
    <nav class="account-drawer__links" aria-label="Opciones de cuenta">
      <a href="perfil.html">Mi perfil <span aria-hidden="true">→</span></a>
      <a href="privacidad.html">Política y privacidad <span aria-hidden="true">→</span></a>
      <button class="account-drawer__logout" type="button">Cerrar sesión</button>
    </nav>
    <div class="account-drawer__danger">
      <button class="account-drawer__delete" type="button">Eliminar cuenta</button>
    </div>
  </div>`;
  document.body.appendChild(drawer);

  const confirmation = document.createElement('dialog');
  confirmation.className = 'account-delete-dialog';
  confirmation.id = 'account-delete-dialog';
  confirmation.setAttribute('aria-labelledby', 'account-delete-title');
  confirmation.innerHTML = `<form class="account-delete-dialog__body">
    <button class="account-drawer__close" type="button" data-cancel-delete aria-label="Cerrar">×</button>
    <h2 id="account-delete-title">Eliminar cuenta</h2>
    <p>Se eliminarán tu cuenta, tus datos de perfil, mascotas, fotos, momentos y reportes de Paw Alert asociados. Esta acción no se puede deshacer.</p>
    <label for="account-delete-confirmation">Escribe <strong>ELIMINAR</strong> para confirmar</label>
    <input id="account-delete-confirmation" name="confirmation" type="text" autocomplete="off" required>
    <p class="account-delete-dialog__error" role="alert" hidden></p>
    <div class="account-delete-dialog__actions">
      <button class="account-delete-dialog__cancel" type="button" data-cancel-delete>Cancelar</button>
      <button class="account-delete-dialog__submit" type="submit" disabled>Eliminar definitivamente</button>
    </div>
  </form>`;
  document.body.appendChild(confirmation);

  const closeButton = drawer.querySelector('.account-drawer__close');
  const deleteForm = confirmation.querySelector('form');
  const confirmationInput = confirmation.querySelector('[name="confirmation"]');
  const submitButton = confirmation.querySelector('[type="submit"]');
  const errorMessage = confirmation.querySelector('[role="alert"]');

  avatar.setAttribute('aria-haspopup', 'dialog');
  avatar.setAttribute('aria-controls', drawer.id);
  avatar.setAttribute('aria-expanded', 'false');
  avatar.addEventListener('click', event => {
    event.preventDefault();
    drawer.showModal();
    avatar.setAttribute('aria-expanded', 'true');
    closeButton.focus();
  });

  drawer.addEventListener('close', () => {
    avatar.setAttribute('aria-expanded', 'false');
    if (!confirmation.open) avatar.focus();
  });
  drawer.addEventListener('click', event => {
    if (event.target === drawer) drawer.close();
  });
  closeButton.addEventListener('click', () => drawer.close());
  drawer.querySelector('.account-drawer__logout').addEventListener('click', () => {
    PN.logout();
    location.replace('login.html');
  });
  drawer.querySelector('.account-drawer__delete').addEventListener('click', () => {
    drawer.close();
    confirmation.showModal();
    confirmationInput.value = '';
    errorMessage.hidden = true;
    submitButton.disabled = true;
    confirmationInput.focus();
  });

  confirmation.querySelectorAll('[data-cancel-delete]').forEach(button => {
    button.addEventListener('click', () => confirmation.close());
  });
  confirmation.addEventListener('click', event => {
    if (event.target === confirmation) confirmation.close();
  });
  confirmation.addEventListener('close', () => avatar.focus());
  confirmationInput.addEventListener('input', () => {
    submitButton.disabled = confirmationInput.value.trim().toUpperCase() !== 'ELIMINAR';
  });
  deleteForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (confirmationInput.value.trim().toUpperCase() !== 'ELIMINAR') return;

    submitButton.disabled = true;
    submitButton.textContent = 'Eliminando…';
    errorMessage.hidden = true;
    const result = await PN.deleteAccount();
    if (!result.ok) {
      errorMessage.textContent = result.error;
      errorMessage.hidden = false;
      submitButton.textContent = 'Eliminar definitivamente';
      submitButton.disabled = false;
      return;
    }

    location.replace('login.html?account=deleted');
  });
})();
