/* Paw Alert: gestionar reportes de mascotas perdidas y encontradas */
if (PN.requireUser()) {
  const sel = document.getElementById('pet-select'), form = document.getElementById('alert-form'), box = document.getElementById('alerts');
  const note = document.getElementById('form-note');
  const alertError = document.getElementById('alert-error');
  const alertsError = document.getElementById('alerts-error');
  const foundForm = document.getElementById('found-form');
  const foundNote = document.getElementById('found-note');
  const lostDialog = document.getElementById('lost-dialog');
  const foundDialog = document.getElementById('found-dialog'), foundPreview = document.getElementById('found-pet-preview');
  const foundFormError = document.getElementById('found-form-error');
  let lostReportsCache = [], foundReportsCache = [];
  const fallbackPhoto = species => species === 'Gato' ? 'petnova-assets/pet-moments-gato.jpg' : 'petnova-assets/perros-portada.jpg';
  const sampleLostPets = [
    { name: 'Nube', species: 'Perro', photo: 'petnova-assets/0bec61dad5f0b657afa665d09a73fd9e.jpg', place: 'Parque Central, La Chorrera', when: 'Hoy, 8:00 a. m.', notes: 'Pequeña, pelaje claro y collar amarillo.' },
    { name: 'Michi', species: 'Gato', photo: 'petnova-assets/5c11a58dfac731d2833e48211d9dc9f6.jpg', place: 'Barrio Colón, cerca de la escuela', when: 'Ayer, 6:30 p. m.', notes: 'Blanco y negro, ojos verdes.' },
    { name: 'Bruno', species: 'Perro', photo: 'petnova-assets/617a032c91678c37343209bb6bef2f6d.jpg', place: 'Residencial La Arboleda', when: 'Hoy, 10:15 a. m.', notes: 'Marrón con pecho blanco; responde a su nombre.' }
  ];
  const showFoundNote = message => {
    foundNote.textContent = message;
    foundNote.hidden = false;
  };
  const readFileAsDataUrl = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('archivo'));
    reader.onerror = () => reject(new Error('archivo'));
    reader.readAsDataURL(file);
  });
  const draw = () => {
    const user = PN.user(), pets = user.pets, safe = pets.filter(p => !p.lost);
    form.phone.value = user.phone || '';
    sel.innerHTML = safe.map(p => `<option value="${p.id}">${PN.esc(p.name)}</option>`).join('');
    form.hidden = !safe.length;
    note.hidden = !!safe.length;
    note.textContent = pets.length ? 'Todas tus mascotas ya tienen una alerta activa.' : 'Primero registra una mascota en Perfil.';
    drawLost();
  };
  const drawLost = () => {
    const currentUser = PN.user();
    const lostResult = PN.lostReports(), foundResult = PN.foundReports();
    if (!lostResult.reports || !foundResult.reports) {
      alertsError.textContent = 'No se pudieron cargar las alertas. Ejecuta supabase-pawalert.sql en Supabase y verifica las políticas de acceso.';
      alertsError.hidden = false;
      return;
    }
    alertsError.hidden = true;
    lostReportsCache = lostResult.reports;
    foundReportsCache = foundResult.reports;
    const demoCards = sampleLostPets.map((pet, index) => `<article class="card alert-card">
      <img class="alert-photo" src="${PN.esc(pet.photo)}" alt="Ejemplo de foto de ${PN.esc(pet.name)}">
      <div class="alert-content"><span class="alert-tag example-tag">Ejemplo</span>
      <h3>${PN.esc(pet.name)} · ${PN.esc(pet.species)}</h3>
      <p class="muted">Última vez visto: ${PN.esc(pet.place)} · ${PN.esc(pet.when)}</p>
      <p>${PN.esc(pet.notes)}</p><p>Contacto de ejemplo</p>
      <button class="btn btn-primary" type="button" data-sample-found="${index}">Encontré esta mascota</button>
      </div></article>`).join('');
    if (!lostReportsCache.length) {
      box.innerHTML = demoCards;
      return;
    }
    const realCards = lostReportsCache.map(report => {
      const photo = report.photo || fallbackPhoto(report.species);
      const sightings = foundReportsCache.filter(sighting => sighting.petOwnerId === report.ownerId && sighting.petId === report.petId);
      return `<article class="card alert-card">
        <img class="alert-photo" src="${PN.esc(photo)}" alt="Foto de ${PN.esc(report.petName)}">
        <div class="alert-content">
        <span class="alert-tag">Extraviada</span>
        <h3>${PN.esc(report.petName)} · ${PN.esc(report.species)}</h3>
        <p class="muted">Última vez en: ${PN.esc(report.place)}${report.when ? ' · ' + PN.esc(new Date(report.when).toLocaleString('es-PA')) : ''}</p>
        ${report.notes ? `<p>${PN.esc(report.notes)}</p>` : ''}
        <p>Contacto: ${PN.esc(report.phone)}</p>
        <p>Reportó: ${PN.esc(report.ownerName)}</p>
        ${sightings.map(report => `<div class="sighting">
          <strong>Avistamiento reportado</strong>
          <p>Estado: ${PN.esc(report.state || 'Sin especificar')}</p>
          ${report.speciesFound ? `<p>Especie: ${PN.esc(report.speciesFound)}</p>` : ''}
          ${report.breedDescription ? `<p>Descripción: ${PN.esc(report.breedDescription)}</p>` : ''}
          ${report.marks ? `<p>Señas: ${PN.esc(report.marks)}</p>` : ''}
          <p>Ubicación: ${PN.esc(report.place)}</p>
          ${report.when ? `<p>Avistada: ${PN.esc(new Date(report.when).toLocaleString('es-PA'))}</p>` : ''}
          ${report.notes ? `<p>${PN.esc(report.notes)}</p>` : ''}
          ${report.mediaType && report.mediaType.startsWith('video/')
            ? `<video class="sighting-media" src="${PN.esc(report.media)}" controls></video>`
            : report.media || report.photo ? `<img class="sighting-media" src="${PN.esc(report.media || report.photo)}" alt="Evidencia del avistamiento">` : ''}
          <p>Reportó: ${PN.esc(report.reporterName)} · ${PN.esc(report.phone)}</p>
        </div>`).join('')}
        ${report.ownerId === currentUser.id
          ? `<button class="btn btn-ghost" data-found="${PN.esc(report.petId)}" data-owner-id="${PN.esc(report.ownerId)}">Ya apareció</button>`
          : `<button class="btn btn-primary" data-report-found="${PN.esc(report.petId)}" data-owner-id="${PN.esc(report.ownerId)}">Encontré esta mascota</button>`}
        </div></article>`;
    }).join('');
    box.innerHTML = realCards + demoCards;
  };
  const openFoundDialog = (ownerId, petId, samplePet) => {
    if (samplePet) {
      foundForm.reset();
      foundForm.dataset.sample = 'true';
      foundForm.querySelector('[name="ownerId"]').value = '';
      foundForm.querySelector('[name="petId"]').value = '';
      foundForm.species.value = samplePet.species;
      foundForm.reporterName.value = PN.user().name || '';
      foundForm.phone.value = PN.user().phone || '';
      foundPreview.innerHTML = `<img src="${PN.esc(samplePet.photo)}" alt="Ejemplo de foto de ${PN.esc(samplePet.name)}">
        <div><strong>${PN.esc(samplePet.name)}</strong><span>Ejemplo ilustrativo · este aviso no se enviará</span></div>`;
      foundFormError.hidden = true;
      foundNote.hidden = true;
      foundDialog.showModal();
      return;
    }
    const report = lostReportsCache.find(item => item.ownerId === ownerId && item.petId === petId);
    if (!report) {
      showFoundNote('Esta alerta ya no está activa.');
      return;
    }
    foundForm.reset();
    foundForm.dataset.sample = 'false';
    foundForm.querySelector('[name="ownerId"]').value = report.ownerId;
    foundForm.querySelector('[name="petId"]').value = report.petId;
    foundForm.species.value = report.species || '';
    foundForm.reporterName.value = PN.user().name || '';
    foundForm.phone.value = PN.user().phone || '';
    foundPreview.innerHTML = `<img src="${PN.esc(report.photo || fallbackPhoto(report.species))}" alt="Foto de ${PN.esc(report.petName)}">
      <div><strong>${PN.esc(report.petName)}</strong><span>${PN.esc(report.species)} · Reportado por ${PN.esc(report.ownerName)}</span></div>`;
    foundFormError.hidden = true;
    foundNote.hidden = true;
    foundDialog.showModal();
  };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(form), u = PN.user(), p = u.pets.find(x => x.id === fd.get('pet'));
    if (!p) return;
    let photo = '';
    const photoFile = fd.get('photo');
    if (photoFile && photoFile.size) {
      try {
        photo = await PN.shrink(photoFile, 420);
      } catch (error) {
        alertError.textContent = 'No se pudo procesar la foto. Prueba con otra imagen.';
        alertError.hidden = false;
        return;
      }
    }
    if (!photo && !p.photo) {
      alertError.textContent = 'Agrega una foto de esta mascota antes de activar la alerta.';
      alertError.hidden = false;
      return;
    }
    p.lost = { place: fd.get('place').trim(), when: fd.get('when'), notes: fd.get('notes').trim(), phone: fd.get('phone').trim(), photo, since: Date.now() };
    const reportResult = PN.saveLostReport({
      ownerId: u.id, ownerName: u.name, petId: p.id, petName: p.name, species: p.species,
      photo: p.lost.photo || p.photo, place: p.lost.place, when: p.lost.when,
      notes: p.lost.notes, phone: p.lost.phone, since: p.lost.since
    });
    if (!reportResult.ok) {
      p.lost = null;
      alertError.textContent = reportResult.status === 404
        ? 'No existe la tabla de Paw Alert. Ejecuta supabase-pawalert.sql en Supabase.'
        : 'No se pudo publicar la alerta en la nube. Verifica las políticas de acceso e inténtalo de nuevo.';
      alertError.hidden = false;
      return;
    }
    if (!PN.save(u)) {
      const rollback = PN.deleteLostReport(u.id, p.id);
      p.lost = null;
      alertError.textContent = rollback.ok
        ? 'No se pudo actualizar tu perfil; la alerta se retiró. Inténtalo de nuevo.'
        : 'No se pudo actualizar tu perfil ni retirar la alerta publicada. Contacta al equipo de soporte.';
      alertError.hidden = false;
      return;
    }
    alertError.hidden = true;
    lostDialog.close();
    form.reset();
    draw();
  });
  foundForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (foundForm.dataset.sample === 'true') {
      foundFormError.textContent = 'Este reporte es solo un ejemplo y no tiene una persona responsable que pueda recibir el aviso. Usa una alerta real para enviar tu reporte.';
      foundFormError.hidden = false;
      return;
    }
    const fd = new FormData(foundForm);
    const lostReport = lostReportsCache.find(report => report.ownerId === fd.get('ownerId') && report.petId === fd.get('petId'));
    if (!lostReport) {
      foundFormError.textContent = 'Esta alerta ya no está activa.';
      foundFormError.hidden = false;
      return;
    }
    const evidenceFile = fd.get('evidence');
    let media = '', mediaType = '';
    if (!evidenceFile || !evidenceFile.size) {
      foundFormError.textContent = 'Adjunta una foto o un video reciente de la mascota.';
      foundFormError.hidden = false;
      return;
    }
    if (evidenceFile.type.startsWith('image/')) {
      try {
        media = await PN.shrink(evidenceFile, 420);
        mediaType = 'image/jpeg';
      } catch (error) {
        foundFormError.textContent = 'No se pudo procesar la foto. Prueba con otra imagen.';
        foundFormError.hidden = false;
        return;
      }
    } else if (evidenceFile.type.startsWith('video/')) {
      if (evidenceFile.size > 2 * 1024 * 1024) {
        foundFormError.textContent = 'El video supera el límite de 2 MB. Elige uno más corto o adjunta una foto.';
        foundFormError.hidden = false;
        return;
      }
      try {
        media = await readFileAsDataUrl(evidenceFile);
        mediaType = evidenceFile.type;
      } catch (error) {
        foundFormError.textContent = 'No se pudo leer el video. Prueba con otro archivo.';
        foundFormError.hidden = false;
        return;
      }
    } else {
      foundFormError.textContent = 'El archivo debe ser una imagen o un video.';
      foundFormError.hidden = false;
      return;
    }
    const user = PN.user(), reportResult = PN.saveFoundReport({
      id: PN.uid(), reporterId: user.id,
      petOwnerId: lostReport.ownerId, petId: lostReport.petId,
      petName: lostReport.petName, species: lostReport.species,
      state: fd.get('state'), speciesFound: fd.get('species'),
      breedDescription: fd.get('breedDescription').trim(), marks: fd.get('marks').trim(),
      place: fd.get('place').trim(), when: fd.get('when'), media, mediaType,
      notes: fd.get('notes').trim(), phone: fd.get('phone').trim(),
      reporterName: fd.get('reporterName').trim(), since: Date.now()
    });
    if (!reportResult.ok) {
      foundFormError.textContent = reportResult.status === 404
        ? 'No existe la tabla de avisos de Paw Alert. Ejecuta supabase-pawalert.sql en Supabase.'
        : 'No se pudo guardar el aviso en la nube. Verifica las políticas de acceso e inténtalo de nuevo.';
      foundFormError.hidden = false;
      return;
    }
    foundDialog.close();
    foundForm.reset();
    draw();
    showFoundNote('Aviso enviado. Gracias por ayudar a reunir a esta mascota con su familia.');
  });
  box.addEventListener('click', e => {
    const foundButton = e.target.closest('[data-found]');
    if (foundButton) {
      const ownerId = foundButton.dataset.ownerId, petId = foundButton.dataset.found;
      const u = PN.user(), pet = ownerId === u.id && u.pets.find(item => item.id === petId);
      const previousLost = pet && pet.lost;
      if (pet) {
        pet.lost = null;
        if (!PN.save(u)) {
          pet.lost = previousLost;
          showFoundNote('No se pudo actualizar tu perfil. Inténtalo de nuevo.');
          return;
        }
      }
      const result = PN.deleteLostReport(ownerId, petId);
      if (!result.ok) {
        let restored = true;
        if (pet) {
          pet.lost = previousLost;
          restored = PN.save(u);
        }
        showFoundNote(restored
          ? 'No se pudo cerrar la alerta en la nube. Verifica las políticas de acceso e inténtalo de nuevo.'
          : 'No se pudo cerrar la alerta ni restaurar el perfil. Contacta al equipo de soporte.');
        return;
      }
      draw();
      return;
    }
    const reportButton = e.target.closest('[data-report-found]');
    if (reportButton) openFoundDialog(reportButton.dataset.ownerId, reportButton.dataset.reportFound);
    const sampleButton = e.target.closest('[data-sample-found]');
    if (sampleButton) openFoundDialog(null, null, sampleLostPets[Number(sampleButton.dataset.sampleFound)]);
  });
  document.querySelector('[data-open-lost]').addEventListener('click', () => {
    alertError.hidden = true;
    lostDialog.showModal();
  });
  lostDialog.addEventListener('click', e => {
    if (e.target === lostDialog || e.target.closest('[data-close-lost]')) lostDialog.close();
  });
  foundDialog.addEventListener('click', e => {
    if (e.target === foundDialog || e.target.closest('[data-close-found]')) foundDialog.close();
  });
  draw();
}
