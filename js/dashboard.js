/* Panel: saludo, resumen y mascotas guardadas */
const u = PN.requireUser();
if (u) {
  const $ = id => document.getElementById(id);
  const pets = Array.isArray(u.pets) ? u.pets : [];
  const lost = pets.filter(p => p.lost).length;
  const todo = pets.filter(p => p.vaccination === 'Pendientes' || p.condition).length;
  const dashboardAvatar = $('dashboard-avatar');
  const profileAvatar = $('profile-avatar');
  const coverImage = $('dashboard-cover-image');
  const firstPet = pets.find(p => p.photo) || pets[0];
  const initial = (firstPet && firstPet.name || u.name || 'P').trim().charAt(0).toUpperCase() || 'P';

  dashboardAvatar.textContent = initial;
  const profilePhoto = profileAvatar && profileAvatar.querySelector('img');
  if (profilePhoto) {
    coverImage.addEventListener('load', () => {
      coverImage.hidden = coverImage.naturalWidth <= 1;
    }, { once: true });
    coverImage.addEventListener('error', () => {
      coverImage.hidden = true;
    }, { once: true });
    coverImage.src = profilePhoto.src;
    if (coverImage.complete) coverImage.hidden = coverImage.naturalWidth <= 1;

    const image = profilePhoto.cloneNode();
    image.alt = '';
    image.addEventListener('load', () => {
      if (image.naturalWidth > 1) dashboardAvatar.replaceChildren(image);
      else image.remove();
    }, { once: true });
    image.addEventListener('error', () => image.remove(), { once: true });
    if (image.complete) {
      if (image.naturalWidth > 1) dashboardAvatar.replaceChildren(image);
    } else {
      dashboardAvatar.appendChild(image);
    }
  }

  $('hello').textContent = `Hola, ${u.name.split(' ')[0]}`;
  $('owner').textContent = u.email || 'Correo no disponible';
  $('owner-phone').textContent = u.phone || 'Aún no agregado';
  $('owner-city').textContent = u.city || 'Aún no agregada';
  $('n-pets').textContent = pets.length;
  $('n-todo').textContent = todo;
  $('n-alerts').textContent = lost;
  if (lost) { $('alert-card').classList.add('danger'); $('alert-text').textContent = 'Alertas activas: revisa Paw Alert'; }
  $('pet-list').innerHTML = pets.length ? pets.map(p => PN.petCard(p, false)).join('') : '<p class="empty">Aún no tienes mascotas registradas.</p>';

  const photoPetIndex = firstPet ? pets.indexOf(firstPet) : -1;
  const editPhotoButton = $('edit-profile-photo');
  const photoEditor = $('photo-editor');
  const photoEditorForm = photoEditor.querySelector('form');
  const photoEditorTitle = $('photo-editor-title');
  const cropViewport = $('photo-editor-crop');
  const cropPreview = $('photo-editor-preview');
  const cropPlaceholder = $('photo-editor-placeholder');
  const photoFile = $('photo-editor-file');
  const photoZoom = $('photo-editor-zoom');
  const photoError = $('photo-editor-error');
  const photoSave = photoEditor.querySelector('[type="submit"]');
  let objectUrl = '';
  let imageLoaded = false;
  let baseScale = 1;
  let imageScale = 1;
  let renderedWidth = 0;
  let renderedHeight = 0;
  let imageX = 0;
  let imageY = 0;
  let drag = null;
  let loadId = 0;

  const showPhotoError = message => {
    photoError.textContent = message;
    photoError.hidden = false;
  };
  const clearPhotoError = () => {
    photoError.textContent = '';
    photoError.hidden = true;
  };
  const clampPosition = () => {
    const size = cropViewport.clientWidth;
    imageX = Math.min(0, Math.max(size - renderedWidth, imageX));
    imageY = Math.min(0, Math.max(size - renderedHeight, imageY));
  };
  const drawPreview = () => {
    clampPosition();
    cropPreview.style.width = `${renderedWidth}px`;
    cropPreview.style.height = `${renderedHeight}px`;
    cropPreview.style.left = `${imageX}px`;
    cropPreview.style.top = `${imageY}px`;
  };
  const initializeCrop = () => {
    imageLoaded = true;
    cropPreview.hidden = false;
    cropPlaceholder.hidden = true;
    photoZoom.disabled = false;
    photoSave.disabled = false;
    photoZoom.value = '1';
    imageScale = 1;
    const size = cropViewport.clientWidth;
    baseScale = Math.max(size / cropPreview.naturalWidth, size / cropPreview.naturalHeight);
    renderedWidth = cropPreview.naturalWidth * baseScale;
    renderedHeight = cropPreview.naturalHeight * baseScale;
    imageX = (size - renderedWidth) / 2;
    imageY = (size - renderedHeight) / 2;
    drawPreview();
  };
  const loadCropImage = source => {
    const currentLoad = ++loadId;
    let initialized = false;
    imageLoaded = false;
    cropPreview.hidden = true;
    cropPlaceholder.hidden = false;
    photoZoom.disabled = true;
    photoSave.disabled = true;
    cropPreview.onload = () => {
      if (currentLoad === loadId && !initialized) {
        initialized = true;
        initializeCrop();
      }
    };
    cropPreview.onerror = () => {
      if (currentLoad !== loadId) return;
      cropPlaceholder.textContent = 'No se pudo abrir la imagen. Prueba con otro archivo.';
      showPhotoError(cropPlaceholder.textContent);
    };
    cropPreview.src = source;
    if (cropPreview.complete && cropPreview.naturalWidth && !initialized) {
      initialized = true;
      initializeCrop();
    }
  };

  editPhotoButton.hidden = photoPetIndex < 0;
  if (photoPetIndex >= 0) {
    const mainPet = pets[photoPetIndex];
    editPhotoButton.setAttribute('aria-label', `Editar la foto de ${mainPet.name || 'tu mascota'}`);
    editPhotoButton.addEventListener('click', () => {
      photoEditorTitle.textContent = `Ajustar foto de ${mainPet.name || 'tu mascota'}`;
      cropPlaceholder.textContent = 'Selecciona una foto para empezar';
      photoFile.value = '';
      clearPhotoError();
      photoEditor.showModal();
      if (mainPet.photo) loadCropImage(mainPet.photo);
      else {
        imageLoaded = false;
        cropPreview.removeAttribute('src');
        cropPreview.hidden = true;
        cropPlaceholder.hidden = false;
        photoZoom.disabled = true;
        photoSave.disabled = true;
      }
    });
  }

  photoFile.addEventListener('change', () => {
    const file = photoFile.files && photoFile.files[0];
    photoFile.value = '';
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) {
      showPhotoError('Elige un archivo de imagen compatible.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      showPhotoError('La foto debe pesar menos de 12 MB.');
      return;
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    clearPhotoError();
    loadCropImage(objectUrl);
  });

  photoZoom.addEventListener('input', () => {
    if (!imageLoaded) return;
    const size = cropViewport.clientWidth;
    const centerX = (size / 2 - imageX) / renderedWidth;
    const centerY = (size / 2 - imageY) / renderedHeight;
    imageScale = Number(photoZoom.value);
    renderedWidth = cropPreview.naturalWidth * baseScale * imageScale;
    renderedHeight = cropPreview.naturalHeight * baseScale * imageScale;
    imageX = size / 2 - centerX * renderedWidth;
    imageY = size / 2 - centerY * renderedHeight;
    drawPreview();
  });

  cropViewport.addEventListener('pointerdown', event => {
    if (!imageLoaded) return;
    event.preventDefault();
    drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, imageX, imageY };
    cropViewport.setPointerCapture(event.pointerId);
  });
  cropViewport.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    imageX = drag.imageX + event.clientX - drag.startX;
    imageY = drag.imageY + event.clientY - drag.startY;
    drawPreview();
  });
  const endDrag = event => {
    if (drag && drag.pointerId === event.pointerId) drag = null;
  };
  cropViewport.addEventListener('pointerup', endDrag);
  cropViewport.addEventListener('pointercancel', endDrag);
  cropViewport.addEventListener('keydown', event => {
    if (!imageLoaded) return;
    const step = event.shiftKey ? 30 : 10;
    if (event.key === 'ArrowLeft') imageX -= step;
    else if (event.key === 'ArrowRight') imageX += step;
    else if (event.key === 'ArrowUp') imageY -= step;
    else if (event.key === 'ArrowDown') imageY += step;
    else return;
    event.preventDefault();
    drawPreview();
  });

  photoEditor.querySelectorAll('[data-photo-close]').forEach(button => {
    button.addEventListener('click', () => photoEditor.close());
  });
  photoEditor.addEventListener('click', event => {
    if (event.target === photoEditor) photoEditor.close();
  });
  photoEditor.addEventListener('close', () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = '';
    drag = null;
    clearPhotoError();
  });
  photoEditorForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!imageLoaded || photoPetIndex < 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) {
      showPhotoError('No se pudo procesar la foto en este dispositivo.');
      return;
    }

    photoSave.disabled = true;
    photoSave.textContent = 'Guardando…';
    const size = cropViewport.clientWidth;
    const sourceScaleX = cropPreview.naturalWidth / renderedWidth;
    const sourceScaleY = cropPreview.naturalHeight / renderedHeight;
    try {
      context.drawImage(
        cropPreview,
        -imageX * sourceScaleX,
        -imageY * sourceScaleY,
        size * sourceScaleX,
        size * sourceScaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );
      const previousPhoto = pets[photoPetIndex].photo;
      pets[photoPetIndex].photo = canvas.toDataURL('image/jpeg', 0.84);
      if (!PN.save(u)) {
        pets[photoPetIndex].photo = previousPhoto;
        showPhotoError('No se pudo guardar la foto. Revisa tu conexión e inténtalo de nuevo.');
        photoSave.textContent = 'Guardar foto';
        photoSave.disabled = false;
        return;
      }
      location.reload();
    } catch (error) {
      console.error('No se pudo recortar la foto de perfil.', error);
      showPhotoError('No se pudo procesar la foto. Prueba con otra imagen.');
      photoSave.textContent = 'Guardar foto';
      photoSave.disabled = false;
    }
  });
}
