document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.submodule-tab');
  const sections = document.querySelectorAll('.submodule-content');
  const plannerCalendarGrid = document.getElementById('planner-calendar-grid');
  const plannerMiniGrid = document.getElementById('planner-mini-grid');
  const plannerMonthTitle = document.getElementById('planner-month-title');
  const plannerMiniTitle = document.getElementById('planner-mini-title');
  const plannerUpcomingList = document.getElementById('planner-upcoming-list');
  const plannerUpcomingCount = document.getElementById('planner-upcoming-count');
  const plannerSelectedTitle = document.getElementById('planner-selected-title');
  const plannerSelectedEvents = document.getElementById('planner-selected-events');
  const plannerDialog = document.getElementById('planner-dialog');
  const plannerForm = document.getElementById('planner-form');
  const plannerFormMessage = document.getElementById('planner-form-message');
  const plannerMessage = document.getElementById('planner-message');
  const plannerTitleInput = document.getElementById('reminder-title');
  const plannerDateInput = document.getElementById('reminder-date');
  const plannerTimeInput = document.getElementById('reminder-time');
  const plannerCategoryInput = document.getElementById('reminder-category');
  const plannerImportanceInput = document.getElementById('reminder-importance');
  const plannerColorInput = document.getElementById('reminder-color');
  const plannerSaveButton = plannerForm.querySelector('[type="submit"]');
  const plannerStorageKey = 'petnova:planner:events';
  const plannerCategories = {
    Vaccines: 'Vacuna',
    Appointments: 'Cita veterinaria',
    Reminders: 'Cuidado general'
  };
  const plannerImportances = { high: 'Alta', medium: 'Media', low: 'Baja' };
  const plannerImportanceColors = { high: '#ee747a', medium: '#0cbddc', low: '#9278d8' };
  const plannerNotificationGraceMs = 12 * 60 * 60 * 1000;
  const localDateKey = date => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
  const dateFromKey = value => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  const validDateKey = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = dateFromKey(value);
    return Number.isFinite(date.getTime()) && localDateKey(date) === value;
  };
  const validTimeKey = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  const validPlannerColor = value => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
  const plannerDateFormatter = new Intl.DateTimeFormat('es-PA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const plannerShortDateFormatter = new Intl.DateTimeFormat('es-PA', {
    day: 'numeric',
    month: 'short'
  });
  const plannerTodayKey = localDateKey(new Date());
  const plannerState = {
    month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    selectedDate: new Date()
  };
  let plannerCanPersist = true;
  let plannerEvents = [];
  const setPlannerMessage = (element, message) => {
    element.textContent = message;
    element.hidden = !message;
  };
  const validPlannerEvent = event => event &&
    typeof event.id === 'string' &&
    typeof event.title === 'string' &&
    event.title.trim() &&
    validDateKey(event.date) &&
    Object.prototype.hasOwnProperty.call(plannerCategories, event.category) &&
    (event.time == null || validTimeKey(event.time)) &&
    (event.importance == null || Object.prototype.hasOwnProperty.call(plannerImportances, event.importance)) &&
    (event.color == null || validPlannerColor(event.color)) &&
    (event.notificationSent == null || typeof event.notificationSent === 'boolean');
  const normalizePlannerEvent = event => {
    const hasSavedTime = validTimeKey(event.time);
    const importance = Object.prototype.hasOwnProperty.call(plannerImportances, event.importance)
      ? event.importance
      : 'medium';
    return {
      ...event,
      time: hasSavedTime ? event.time : '09:00',
      importance,
      color: validPlannerColor(event.color) ? event.color : plannerImportanceColors[importance],
      notificationSent: typeof event.notificationSent === 'boolean' ? event.notificationSent : !hasSavedTime
    };
  };

  try {
    const savedEvents = JSON.parse(localStorage.getItem(plannerStorageKey) || '[]');
    if (!Array.isArray(savedEvents) || !savedEvents.every(validPlannerEvent)) {
      throw new Error('El formato guardado de la agenda no es válido.');
    }
    plannerEvents = savedEvents.map(normalizePlannerEvent);
  } catch (error) {
    plannerCanPersist = false;
    setPlannerMessage(plannerMessage, 'No se pudieron cargar los recordatorios guardados. No se modificarán los datos existentes.');
    console.error('No se pudieron leer los recordatorios de Paw Planner:', error);
  }

  const storePlannerEvents = events => {
    if (!plannerCanPersist) {
      setPlannerMessage(plannerMessage, 'No se pueden guardar recordatorios porque la agenda guardada no se pudo cargar.');
      return false;
    }
    try {
      localStorage.setItem(plannerStorageKey, JSON.stringify(events));
      return true;
    } catch (error) {
      setPlannerMessage(plannerMessage, 'No se pudo guardar el recordatorio. Revisa el almacenamiento disponible.');
      console.error('No se pudo guardar la agenda de Paw Planner:', error);
      return false;
    }
  };

  const plannerNotificationFailures = new Set();
  const checkPlannerNotifications = () => {
    const now = Date.now();
    let changed = false;
    const checkedEvents = plannerEvents.map(event => {
      if (event.notificationSent) return event;
      const scheduledAt = new Date(`${event.date}T${event.time}:00`).getTime();
      if (!Number.isFinite(scheduledAt) || scheduledAt > now) return event;
      if (now - scheduledAt > plannerNotificationGraceMs) {
        changed = true;
        return { ...event, notificationSent: true };
      }
      if (!('Notification' in window) || Notification.permission !== 'granted') return event;
      if (plannerNotificationFailures.has(event.id)) return event;
      try {
        const notification = new Notification(event.title, {
          body: `${plannerCategories[event.category]} · Importancia ${plannerImportances[event.importance]}`,
          tag: `petnova-reminder-${event.id}`,
          icon: 'petnova-assets/logo-pet-nova.png'
        });
        notification.onclick = () => window.focus();
        changed = true;
        return { ...event, notificationSent: true };
      } catch (error) {
        if (!plannerNotificationFailures.has(event.id)) {
          plannerNotificationFailures.add(event.id);
          console.error('No se pudo mostrar una notificación de Paw Planner:', error);
          setPlannerMessage(plannerMessage, 'No se pudo mostrar una notificación. Revisa los permisos del navegador.');
        }
        return event;
      }
    });
    if (changed) {
      plannerEvents = checkedEvents;
      storePlannerEvents(checkedEvents);
    }
  };

  const requestPlannerNotificationPermission = async () => {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission !== 'default') return Notification.permission;
    try {
      return await Notification.requestPermission();
    } catch (error) {
      console.error('No se pudo solicitar permiso para las notificaciones:', error);
      return 'error';
    }
  };

  const getPlannerEventsForDate = dateKey => plannerEvents
    .filter(event => event.date === dateKey)
    .sort((a, b) => a.title.localeCompare(b.title, 'es'));
  const getSortedPlannerEvents = () => plannerEvents.slice().sort((a, b) =>
    a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.title.localeCompare(b.title, 'es')
  );
  const createPlannerDayButton = (date, isMini) => {
    const dateKey = localDateKey(date);
    const dayEvents = getPlannerEventsForDate(dateKey);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = isMini ? 'planner-mini-day' : 'planner-day';
    if (date.getMonth() !== plannerState.month.getMonth()) {
      button.classList.add(isMini ? 'planner-mini-day--outside' : 'planner-day--outside');
    }
    if (dateKey === plannerTodayKey) {
      button.classList.add(isMini ? 'planner-mini-day--today' : 'planner-day--today');
    }
    if (dateKey === localDateKey(plannerState.selectedDate)) {
      button.classList.add(isMini ? 'planner-mini-day--selected' : 'planner-day--selected');
    }
    if (dayEvents.length) {
      button.classList.add(isMini ? 'planner-mini-day--has-events' : 'planner-day--has-events');
    }
    button.setAttribute('aria-label', `${plannerDateFormatter.format(date)}${dayEvents.length ? `, ${dayEvents.length} recordatorios` : ''}`);
    button.setAttribute('aria-pressed', String(dateKey === localDateKey(plannerState.selectedDate)));
    if (!isMini) {
      const number = document.createElement('span');
      number.className = 'planner-day__number';
      number.textContent = String(date.getDate());
      const events = document.createElement('span');
      events.className = 'planner-day__events';
      dayEvents.slice(0, 2).forEach(event => {
        const pill = document.createElement('span');
        pill.className = 'planner-event-pill';
        pill.dataset.category = event.category;
        pill.dataset.importance = event.importance;
        pill.style.setProperty('--planner-event-color', event.color);
        pill.textContent = event.title;
        events.appendChild(pill);
      });
      if (dayEvents.length > 2) {
        const more = document.createElement('span');
        more.className = 'planner-event-more';
        more.textContent = `+${dayEvents.length - 2} más`;
        events.appendChild(more);
      }
      button.append(number, events);
    } else {
      button.textContent = String(date.getDate());
    }
    button.addEventListener('click', () => {
      plannerState.selectedDate = date;
      plannerState.month = new Date(date.getFullYear(), date.getMonth(), 1);
      renderPlanner();
    });
    return button;
  };

  const renderPlannerCalendar = (grid, isMini) => {
    grid.replaceChildren();
    const firstOfMonth = new Date(
      plannerState.month.getFullYear(),
      plannerState.month.getMonth(),
      1
    );
    const firstVisibleDate = new Date(
      firstOfMonth.getFullYear(),
      firstOfMonth.getMonth(),
      1 - firstOfMonth.getDay()
    );
    for (let index = 0; index < 42; index += 1) {
      const date = new Date(
        firstVisibleDate.getFullYear(),
        firstVisibleDate.getMonth(),
        firstVisibleDate.getDate() + index
      );
      grid.appendChild(createPlannerDayButton(date, isMini));
    }
  };

  const renderPlannerUpcoming = () => {
    plannerUpcomingList.replaceChildren();
    const upcoming = getSortedPlannerEvents().filter(event => event.date >= plannerTodayKey);
    plannerUpcomingCount.textContent = String(upcoming.length);
    if (!upcoming.length) {
      const empty = document.createElement('p');
      empty.className = 'planner-empty';
      empty.textContent = 'Aún no tienes próximos recordatorios. Crea uno para organizar su cuidado.';
      plannerUpcomingList.appendChild(empty);
      return;
    }
    upcoming.slice(0, 5).forEach(event => {
      const item = document.createElement('div');
      item.className = 'planner-upcoming-item';
      item.dataset.category = event.category;
      item.dataset.importance = event.importance;
      item.style.setProperty('--planner-event-color', event.color);
      const details = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = event.title;
      const metadata = document.createElement('small');
      metadata.textContent = `${plannerShortDateFormatter.format(dateFromKey(event.date))} · ${event.time} · ${plannerCategories[event.category]} · ${plannerImportances[event.importance]}`;
      details.append(title, metadata);
      item.appendChild(details);
      plannerUpcomingList.appendChild(item);
    });
  };

  const renderPlannerSelectedEvents = () => {
    const selectedKey = localDateKey(plannerState.selectedDate);
    plannerSelectedTitle.textContent = `Recordatorios · ${plannerDateFormatter.format(plannerState.selectedDate)}`;
    plannerSelectedEvents.replaceChildren();
    const selectedEvents = getPlannerEventsForDate(selectedKey);
    if (!selectedEvents.length) {
      const empty = document.createElement('p');
      empty.className = 'planner-empty';
      empty.textContent = 'No hay recordatorios para esta fecha.';
      plannerSelectedEvents.appendChild(empty);
      return;
    }
    selectedEvents.forEach(event => {
      const item = document.createElement('div');
      item.className = 'planner-selected-event';
      item.dataset.category = event.category;
      item.dataset.importance = event.importance;
      item.style.setProperty('--planner-event-color', event.color);
      const details = document.createElement('span');
      details.className = 'planner-selected-event__details';
      const marker = document.createElement('span');
      marker.className = 'planner-selected-event__marker';
      marker.setAttribute('aria-hidden', 'true');
      const title = document.createElement('strong');
      title.textContent = event.title;
      const category = document.createElement('small');
      category.textContent = `${event.time} · ${plannerCategories[event.category]} · ${plannerImportances[event.importance]}`;
      details.append(marker, title, category);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'planner-delete-event';
      remove.dataset.plannerDelete = event.id;
      remove.setAttribute('aria-label', `Eliminar ${event.title}`);
      remove.textContent = 'Eliminar';
      item.append(details, remove);
      plannerSelectedEvents.appendChild(item);
    });
  };

  function renderPlanner() {
    const monthTitle = new Intl.DateTimeFormat('es-PA', {
      month: 'long',
      year: 'numeric'
    }).format(plannerState.month);
    const formattedMonthTitle = monthTitle.charAt(0).toLocaleUpperCase('es') + monthTitle.slice(1);
    plannerMonthTitle.textContent = formattedMonthTitle;
    plannerMiniTitle.textContent = formattedMonthTitle;
    renderPlannerCalendar(plannerCalendarGrid, false);
    renderPlannerCalendar(plannerMiniGrid, true);
    renderPlannerUpcoming();
    renderPlannerSelectedEvents();
  }

  const shiftPlannerMonth = amount => {
    const selectedDay = plannerState.selectedDate.getDate();
    const nextMonth = new Date(
      plannerState.month.getFullYear(),
      plannerState.month.getMonth() + amount,
      1
    );
    const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    plannerState.month = nextMonth;
    plannerState.selectedDate = new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth(),
      Math.min(selectedDay, lastDay)
    );
    renderPlanner();
  };

  const openPlannerDialog = () => {
    plannerForm.reset();
    plannerDateInput.min = localDateKey(new Date());
    plannerDateInput.value = localDateKey(plannerState.selectedDate);
    plannerTimeInput.value = '09:00';
    plannerImportanceInput.value = 'medium';
    plannerColorInput.value = plannerImportanceColors.medium;
    setPlannerMessage(plannerFormMessage, '');
    plannerDialog.showModal();
    plannerTitleInput.focus();
  };

  plannerImportanceInput.addEventListener('change', () => {
    plannerColorInput.value = plannerImportanceColors[plannerImportanceInput.value] || plannerImportanceColors.medium;
  });

  document.querySelectorAll('[data-planner-nav]').forEach(button => {
    button.addEventListener('click', () => shiftPlannerMonth(Number(button.dataset.plannerNav)));
  });
  document.getElementById('planner-today').addEventListener('click', () => {
    const today = new Date();
    plannerState.selectedDate = today;
    plannerState.month = new Date(today.getFullYear(), today.getMonth(), 1);
    renderPlanner();
  });
  document.getElementById('planner-create').addEventListener('click', openPlannerDialog);
  document.getElementById('planner-add-selected').addEventListener('click', openPlannerDialog);
  document.getElementById('planner-close').addEventListener('click', () => plannerDialog.close());
  document.getElementById('planner-cancel').addEventListener('click', () => plannerDialog.close());

  plannerSelectedEvents.addEventListener('click', event => {
    const removeButton = event.target.closest('[data-planner-delete]');
    if (!removeButton) return;
    const updatedEvents = plannerEvents.filter(item => item.id !== removeButton.dataset.plannerDelete);
    if (!storePlannerEvents(updatedEvents)) return;
    plannerEvents = updatedEvents;
    setPlannerMessage(plannerMessage, 'Se eliminó el recordatorio.');
    renderPlanner();
  });

  plannerForm.addEventListener('submit', async event => {
    event.preventDefault();
    const title = plannerTitleInput.value.trim();
    const date = plannerDateInput.value;
    const time = plannerTimeInput.value;
    const category = plannerCategoryInput.value;
    const importance = plannerImportanceInput.value;
    const color = plannerColorInput.value;
    if (!title || !validDateKey(date) || !validTimeKey(time) ||
        !Object.prototype.hasOwnProperty.call(plannerCategories, category) ||
        !Object.prototype.hasOwnProperty.call(plannerImportances, importance) ||
        !validPlannerColor(color)) {
      setPlannerMessage(plannerFormMessage, 'Revisa el nombre, la fecha, la hora, la importancia y el color del recordatorio.');
      return;
    }
    if (new Date(`${date}T${time}:00`).getTime() <= Date.now()) {
      setPlannerMessage(plannerFormMessage, 'Elige una fecha y hora futuras para recibir la notificación.');
      return;
    }
    if (!plannerCanPersist) {
      setPlannerMessage(plannerFormMessage, 'No se puede guardar porque la agenda existente no se pudo cargar.');
      return;
    }
    plannerSaveButton.disabled = true;
    const notificationPermission = await requestPlannerNotificationPermission();
    plannerSaveButton.disabled = false;
    const plannerEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      date,
      time,
      category,
      importance,
      color,
      notificationSent: false
    };
    const updatedEvents = [...plannerEvents, plannerEvent];
    if (!storePlannerEvents(updatedEvents)) {
      setPlannerMessage(plannerFormMessage, 'No se pudo guardar el recordatorio.');
      return;
    }
    plannerEvents = updatedEvents;
    plannerState.selectedDate = dateFromKey(date);
    plannerState.month = new Date(plannerState.selectedDate.getFullYear(), plannerState.selectedDate.getMonth(), 1);
    plannerForm.reset();
    plannerDialog.close();
    renderPlanner();
    if (notificationPermission === 'granted') {
      setPlannerMessage(plannerMessage, `Recordatorio guardado. Te avisaremos el ${plannerDateFormatter.format(dateFromKey(date))} a las ${time}.`);
    } else if (notificationPermission === 'unsupported') {
      setPlannerMessage(plannerMessage, 'Recordatorio guardado, pero este navegador no permite notificaciones.');
    } else if (notificationPermission === 'denied') {
      setPlannerMessage(plannerMessage, 'Recordatorio guardado, pero las notificaciones están bloqueadas. Actívalas en los permisos del navegador.');
    } else {
      setPlannerMessage(plannerMessage, 'Recordatorio guardado, pero no se pudo obtener permiso para notificar.');
    }
    checkPlannerNotifications();
  });
  renderPlanner();
  checkPlannerNotifications();
  window.setInterval(checkPlannerNotifications, 15000);

  const placesGrid = document.getElementById('places-grid');
  const placesStatus = document.getElementById('places-status');
  const mapContainer = document.getElementById('map-container');
  const mapShell = document.querySelector('.map-shell');
  const filterButtons = document.querySelectorAll('.chip[data-filter]');
  const viewButtons = document.querySelectorAll('[data-view]');
  const placeSeeds = [
    {
      id: 'way/384035672',
      osmId: 'W384035672',
      name: 'Clínica Vet Help',
      category: 'vet',
      address: 'Avenida San Martín de Porres, Naranjal, La Chorrera, Panamá Oeste',
      lat: 8.8876660,
      lon: -79.7787941,
      image: 'petnova-assets/clinic.webp'
    },
    {
      id: 'way/385183962',
      osmId: 'W385183962',
      name: 'Hospital Veterinario Dr. Medina',
      category: 'vet',
      address: 'Carretera Panamericana, La Herradura, La Chorrera, Panamá Oeste',
      lat: 8.8551645,
      lon: -79.8098925,
      image: 'petnova-assets/dr.medina.webp'
    },
    {
      id: 'way/385345189',
      osmId: 'W385345189',
      name: 'Acro-Veterinario Chunc',
      category: 'vet',
      address: 'Avenida Libertador, Residencial Los Laureles, La Chorrera, Panamá Oeste',
      lat: 8.8764836,
      lon: -79.7873102
    },
    {
      id: 'way/385466254',
      osmId: 'W385466254',
      name: 'Melo',
      category: 'store',
      address: 'Avenida Libertador, Residencial Los Laureles, La Chorrera, Panamá Oeste',
      lat: 8.8885233,
      lon: -79.7715748
    },
    {
      id: 'way/383842799',
      osmId: 'W383842799',
      name: 'Parque Central',
      category: 'park',
      address: 'La Chorrera, Panamá Oeste',
      lat: 8.8826560,
      lon: -79.7799978
    },
    {
      id: 'way/383894984',
      osmId: 'W383894984',
      name: 'Parque Feuillet',
      category: 'park',
      address: 'La Chorrera, Panamá Oeste',
      lat: 8.8803539,
      lon: -79.7810541,
      image: 'petnova-assets/parque feullet.jpg'
    },
    {
      id: 'way/554964988',
      osmId: 'W554964988',
      name: 'Parque Libertador de La Chorrera',
      category: 'park',
      address: 'La Chorrera, Panamá Oeste',
      lat: 8.8752320,
      lon: -79.7888075,
      image: 'petnova-assets/parque libertador.jpg'
    }
  ];
  const state = { filter: 'all', view: 'map' };
  let places = placeSeeds.map(place => ({
    ...place,
    phone: '',
    email: '',
    website: '',
    image: place.image || '',
    osmUrl: `https://www.openstreetmap.org/${place.id}`
  }));
  let placesMap = null;
  let markersLayer = null;
  let placeMarkerIcon = null;
  let placesLoaded = false;
  let placesLoading = false;

  const setStatus = (message, isError) => {
    placesStatus.textContent = message;
    placesStatus.classList.toggle('is-error', Boolean(isError));
  };

  const categoryLabel = (category) => ({
    park: 'Parque',
    vet: 'Veterinaria',
    store: 'Tienda para mascotas'
  })[category] || 'Lugar pet-friendly';

  const getImageUrl = (tags) => {
    if (tags.image) {
      try {
        const url = new URL(tags.image, window.location.href);
        if (url.protocol === 'http:') url.protocol = 'https:';
        if (url.protocol === 'https:') return url.href;
      } catch (error) {
        console.warn('Se ignoró una URL de imagen inválida de OpenStreetMap:', error);
      }
    }

    const commonsFile = tags.wikimedia_commons;
    if (commonsFile && /^File:/i.test(commonsFile)) {
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(commonsFile.replace(/^File:/i, ''))}?width=900`;
    }
    return '';
  };

  const normalizeWebsite = (value) => {
    if (!value) return '';
    try {
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch (error) {
      console.warn('Se ignoró una URL web inválida de OpenStreetMap:', error);
      return '';
    }
  };

  const makeExternalLink = (label, href, className) => {
    const link = document.createElement('a');
    link.className = className || '';
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label;
    return link;
  };

  const makeCard = (place) => {
    const card = document.createElement('article');
    card.className = 'property-card';
    card.dataset.category = place.category;
    card.tabIndex = 0;
    card.setAttribute('aria-label', `${place.name}, ${categoryLabel(place.category)}`);

    const imageFrame = document.createElement('div');
    imageFrame.className = 'property-card__image';
    if (place.image) {
      const image = document.createElement('img');
      image.src = place.image;
      image.alt = `Foto de ${place.name}`;
      image.loading = 'lazy';
      image.addEventListener('error', () => {
        image.remove();
        imageFrame.classList.add('no-photo');
        imageFrame.textContent = 'Foto no disponible en OpenStreetMap';
      }, { once: true });
      imageFrame.appendChild(image);
    } else {
      imageFrame.classList.add('no-photo');
      imageFrame.textContent = 'Este lugar no tiene una foto publicada';
    }

    const body = document.createElement('div');
    body.className = 'property-card__body';
    const header = document.createElement('div');
    header.className = 'property-card__meta';
    const title = document.createElement('h4');
    title.className = 'property-name';
    title.textContent = place.name;
    const category = document.createElement('span');
    category.className = 'place-category';
    category.textContent = categoryLabel(place.category);
    header.append(title, category);

    const details = document.createElement('div');
    details.className = 'place-details';
    const address = document.createElement('p');
    address.textContent = place.address || 'Dirección postal no publicada';
    const coordinates = document.createElement('p');
    coordinates.textContent = `Coordenadas: ${place.lat.toFixed(5)}, ${place.lon.toFixed(5)}`;
    details.append(address, coordinates);
    if (!place.phone && !place.email && !place.website) {
      const noContact = document.createElement('p');
      noContact.textContent = 'Contacto no publicado en OpenStreetMap';
      details.appendChild(noContact);
    }

    const actions = document.createElement('div');
    actions.className = 'place-actions';
    if (place.phone) {
      const phone = document.createElement('a');
      phone.href = `tel:${place.phone.replace(/[^\d+]/g, '')}`;
      phone.textContent = `Llamar: ${place.phone}`;
      actions.appendChild(phone);
    }
    if (place.email) {
      const email = document.createElement('a');
      email.href = `mailto:${place.email}`;
      email.textContent = 'Correo electrónico';
      actions.appendChild(email);
    }
    if (place.website) actions.appendChild(makeExternalLink('Sitio web', place.website));
    actions.appendChild(makeExternalLink(
      'Cómo llegar',
      `https://www.google.com/maps/dir/?api=1&destination=${place.lat}%2C${place.lon}`
    ));
    actions.appendChild(makeExternalLink('Ver en OpenStreetMap', place.osmUrl));

    body.append(header, details, actions);
    card.append(imageFrame, body);

    const focusPlace = () => {
      if (!placesMap) return;
      placesMap.flyTo([place.lat, place.lon], 16, { duration: 0.8 });
      const marker = markersLayer && markersLayer.getLayers().find(item => item.options.placeId === place.id);
      if (marker) marker.openPopup();
    };
    card.addEventListener('click', (event) => {
      if (!event.target.closest('a')) focusPlace();
    });
    card.addEventListener('keydown', (event) => {
      if (event.target === card && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        focusPlace();
      }
    });
    return card;
  };

  const makePopup = (place) => {
    const popup = document.createElement('div');
    popup.className = 'map-popup';
    const title = document.createElement('strong');
    title.textContent = place.name;
    const category = document.createElement('span');
    category.textContent = categoryLabel(place.category);
    const coordinates = document.createElement('span');
    coordinates.textContent = `${place.lat.toFixed(5)}, ${place.lon.toFixed(5)}`;
    const link = makeExternalLink('Cómo llegar', `https://www.google.com/maps/dir/?api=1&destination=${place.lat}%2C${place.lon}`);
    popup.append(title, category, coordinates, link);
    return popup;
  };

  const renderPlaces = () => {
    const filteredPlaces = state.filter === 'all'
      ? places
      : places.filter(place => place.category === state.filter);

    placesGrid.replaceChildren();
    if (!filteredPlaces.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = places.length
        ? 'No hay lugares en esta categoría en los datos de OpenStreetMap.'
        : 'No se encontraron lugares con nombre para esta zona.';
      placesGrid.appendChild(empty);
    } else {
      filteredPlaces.forEach(place => placesGrid.appendChild(makeCard(place)));
    }

    if (markersLayer) {
      markersLayer.clearLayers();
      filteredPlaces.forEach(place => {
        const marker = L.marker([place.lat, place.lon], {
          icon: placeMarkerIcon,
          placeId: place.id
        });
        marker.bindPopup(makePopup(place));
        markersLayer.addLayer(marker);
      });
      if (filteredPlaces.length) {
        const bounds = L.latLngBounds(filteredPlaces.map(place => [place.lat, place.lon]));
        placesMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
      }
    }
    setStatus(
      `${filteredPlaces.length} lugares mostrados · Datos de OpenStreetMap`,
      false
    );
  };

  const loadPlaces = async () => {
    if (placesLoaded || placesLoading) return;
    placesLoading = true;
    setStatus('Actualizando ubicación y datos disponibles en OpenStreetMap…', false);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const osmIds = placeSeeds.map(place => place.osmId).join(',');
      const url = `https://nominatim.openstreetmap.org/lookup?format=jsonv2&addressdetails=1&extratags=1&namedetails=1&osm_ids=${osmIds}`;
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`OpenStreetMap respondió con ${response.status}`);
      const results = await response.json();
      const records = new Map(results.map(record => [
        `${record.osm_type}/${record.osm_id}`,
        record
      ]));

      places = placeSeeds.map(seed => {
        const record = records.get(seed.id);
        const tags = record && record.extratags ? record.extratags : {};
        const displayName = record && record.display_name
          ? record.display_name.split(',').slice(1).join(',').trim()
          : '';
        return {
          ...seed,
          name: record && record.name ? record.name : seed.name,
          lat: record && Number.isFinite(Number(record.lat)) ? Number(record.lat) : seed.lat,
          lon: record && Number.isFinite(Number(record.lon)) ? Number(record.lon) : seed.lon,
          address: displayName || seed.address,
          phone: tags['contact:phone'] || tags.phone || '',
          email: tags['contact:email'] || tags.email || '',
          website: normalizeWebsite(tags['contact:website'] || tags.website || ''),
          image: seed.image || getImageUrl(tags),
          osmUrl: `https://www.openstreetmap.org/${seed.id}`
        };
      });
      placesLoaded = true;
      renderPlaces();
    } catch (error) {
      places = places.map(place => ({ ...place }));
      renderPlaces();
      setStatus('No se pudieron actualizar los detalles. Mostrando ubicaciones registradas en OpenStreetMap.', true);
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'places-retry';
      retry.textContent = 'Reintentar';
      retry.addEventListener('click', loadPlaces, { once: true });
      placesStatus.append(' ', retry);
      console.error('Error al actualizar los detalles de lugares desde OpenStreetMap:', error);
    } finally {
      window.clearTimeout(timeout);
      placesLoading = false;
    }
  };

  const initializeMap = () => {
    if (placesMap) {
      placesMap.invalidateSize();
      return true;
    }
    if (!window.L || !mapContainer) {
      setStatus('No se pudo iniciar el mapa. Comprueba tu conexión e inténtalo de nuevo.', true);
      return false;
    }

    placesMap = L.map(mapContainer, { scrollWheelZoom: true }).setView([8.880, -79.783], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      maxZoom: 19
    }).addTo(placesMap);
    markersLayer = L.layerGroup().addTo(placesMap);
    placeMarkerIcon = L.divIcon({
      className: 'petnova-map-marker-icon',
      html: '<span class="petnova-map-marker" aria-hidden="true"><span class="petnova-map-marker__point"></span><span class="petnova-map-marker__face"><i class="fas fa-paw"></i></span></span>',
      iconSize: [44, 50],
      iconAnchor: [22, 49],
      popupAnchor: [0, -46]
    });
    return true;
  };

  const updateView = () => {
    mapShell.classList.toggle('map-first', state.view === 'map');
    viewButtons.forEach(button => {
      const active = button.dataset.view === state.view;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (placesMap) {
      window.setTimeout(() => placesMap.invalidateSize(), 0);
    }
  };

  const activateSubmodule = target => {
    const activeTab = Array.from(tabs).find(tab => tab.dataset.target === target);
    if (!activeTab) return;
    tabs.forEach(tab => tab.classList.toggle('active', tab === activeTab));
    sections.forEach(section => {
      section.style.display = section.id === target ? 'block' : 'none';
    });
    if (target === 'mapview' && initializeMap()) {
      window.setTimeout(() => {
        placesMap.invalidateSize();
        loadPlaces();
      }, 0);
    }
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => activateSubmodule(tab.dataset.target));
  });
  const requestedSubmodule = location.hash.slice(1);
  activateSubmodule(requestedSubmodule || 'planner');
  window.addEventListener('hashchange', () => activateSubmodule(location.hash.slice(1)));

  const communityFeed = document.getElementById('community-feed');
  const communityForm = document.getElementById('community-form');
  const communityInput = document.getElementById('post-input');
  const communityMessage = document.getElementById('community-msg');
  const communityPostType = document.getElementById('community-post-type');
  const communityInputLabel = document.getElementById('post-input-label');
  const communityPollFields = document.getElementById('community-poll-fields');
  const communityPollOptionInputs = [
    document.getElementById('poll-option-one'),
    document.getElementById('poll-option-two')
  ];
  const communityImageInput = document.getElementById('post-image');
  const communitySubmitButton = communityForm.querySelector('[type="submit"]');
  const communityStorageKey = 'petnova:community:posts';
  const communityExamples = [
    {
      id: 'community-post-luna',
      author: 'Ana y Luna',
      pet: 'Un paseo de mañana',
      title: 'Empezar el día con una caminata',
      text: 'Hoy salimos temprano a caminar y Luna volvió feliz después de olfatearlo todo. ¿Qué lugares tranquilos recomiendan para pasear?',
      image: 'petnova-assets/06a9c802d457b8550ce79ed099167a71.jpg'
    },
    {
      id: 'community-post-coco',
      author: 'Luis y Coco',
      pet: 'Un día junto al mar',
      title: 'A Coco le encanta la playa',
      text: 'Llevamos agua fresca y descansamos a la sombra durante el paseo. ¿Cuál es ese pequeño detalle que nunca falta en sus salidas?',
      image: 'petnova-assets/pexels-thoinamcao-10420320.jpg'
    },
    {
      id: 'community-post-michi',
      author: 'Sofía y Michi',
      pet: 'Juegos en casa',
      title: 'Una pausa tranquila al sol',
      text: 'Michi encontró un lugar soleado para descansar después de explorar el jardín. ¿Cuál es el rincón favorito de sus gatos?',
      image: 'petnova-assets/gato tomando el sol.jpg'
    }
  ];

  const showCommunityMessage = (message) => {
    communityMessage.textContent = message;
    communityMessage.hidden = !message;
  };
  const communityBackendError = error =>
    /community_posts|community_poll_votes|community-media|bucket not found|schema cache/i.test(error || '')
      ? 'Falta aplicar la migración de comunidad en Supabase; aplícala y vuelve a intentarlo.'
      : error || 'Revisa tu conexión y los permisos de tu cuenta.';

  const readLocalCommunityPosts = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(communityStorageKey) || '[]');
      const validPoll = poll => !poll || (
        Array.isArray(poll.options) &&
        poll.options.length >= 2 &&
        poll.options.length <= 5 &&
        poll.options.every(option =>
          option &&
          typeof option.id === 'string' &&
          typeof option.text === 'string' &&
          Number.isInteger(option.votes) &&
          option.votes >= 0
        ) &&
        (poll.votedOptionId == null || typeof poll.votedOptionId === 'string')
      );
      if (!Array.isArray(saved) || !saved.every(post =>
        post &&
        typeof post.author === 'string' &&
        typeof post.text === 'string' &&
        typeof post.createdAt === 'string' &&
        (post.image == null || typeof post.image === 'string') &&
        validPoll(post.poll)
      )) {
        throw new Error('El formato guardado de las publicaciones no es válido.');
      }
      return saved.slice(-20).map(post => ({ ...post, localId: PN.uid() }));
    } catch (error) {
      console.error('No se pudieron leer las publicaciones guardadas en este navegador:', error);
      showCommunityMessage('No se pudieron cargar algunas publicaciones guardadas en este navegador. No se modificarán esos datos.');
      return [];
    }
  };

  let localCommunityPosts = readLocalCommunityPosts();
  let myCommunityPosts = [];
  let communityUserId = '';
  let communityLoadPromise = null;
  const communityBusyPostIds = new Set();

  const storeLocalCommunityPosts = posts => {
    try {
      localStorage.setItem(communityStorageKey, JSON.stringify(posts.map(({ localId, ...post }) => post)));
      return true;
    } catch (error) {
      console.error('No se pudieron actualizar las publicaciones guardadas en este navegador:', error);
      showCommunityMessage('No se pudo actualizar una publicación local. Los datos originales se conservaron.');
      return false;
    }
  };

  const castLocalCommunityVote = (localId, optionId) => {
    const post = localCommunityPosts.find(item => item.localId === localId);
    if (!post || !post.poll || post.poll.votedOptionId) return;
    if (!post.poll.options.some(option => option.id === optionId)) return;
    const updatedPosts = localCommunityPosts.map(item => item.localId !== localId ? item : ({
      ...item,
      poll: {
        ...item.poll,
        votedOptionId: optionId,
        options: item.poll.options.map(option => ({
          ...option,
          votes: option.votes + (option.id === optionId ? 1 : 0)
        }))
      }
    }));
    if (!storeLocalCommunityPosts(updatedPosts)) return;
    localCommunityPosts = updatedPosts;
    renderCommunity();
    showCommunityMessage('Tu voto quedó guardado solo en este dispositivo.');
  };

  const loadCommunityPosts = async () => {
    if (communityLoadPromise) return communityLoadPromise;
    communityLoadPromise = (async () => {
      try {
        const result = await PN.listCommunityPosts();
        if (!result.ok) {
          showCommunityMessage(`No se pudieron cargar las publicaciones compartidas. ${communityBackendError(result.error)}`);
          return false;
        }
        myCommunityPosts = result.posts;
        const user = PN.user();
        communityUserId = user && user.id || '';
        renderCommunity();
        showCommunityMessage(result.imageErrors
          ? 'Algunas imágenes compartidas no están disponibles. El resto de las publicaciones sí se cargó.'
          : '');
        return true;
      } catch (error) {
        console.error('No se pudieron cargar las publicaciones compartidas:', error);
        showCommunityMessage('Ocurrió un error al cargar la comunidad compartida. Inténtalo de nuevo.');
        return false;
      } finally {
        communityLoadPromise = null;
      }
    })();
    return communityLoadPromise;
  };

  const castCommunityVote = async (postId, optionId) => {
    const post = myCommunityPosts.find(item => item.id === postId);
    if (!post || !post.poll || post.poll.votedOptionId) return;
    if (!post.poll.options.some(option => option.id === optionId)) return;
    if (communityBusyPostIds.has(postId)) return;
    communityBusyPostIds.add(postId);
    try {
      const result = await PN.voteCommunityPoll(postId, optionId);
      if (!result.ok) {
        showCommunityMessage(`No se pudo registrar tu voto. ${communityBackendError(result.error)}`);
        return;
      }
      const loaded = await loadCommunityPosts();
      showCommunityMessage(loaded
        ? 'Tu voto quedó registrado.'
        : 'Tu voto quedó registrado, pero no se pudieron actualizar los resultados.');
    } finally {
      communityBusyPostIds.delete(postId);
    }
  };

  const deleteCommunityPost = async post => {
    if (!post || post.userId !== communityUserId || communityBusyPostIds.has(post.id)) return;
    if (!window.confirm('¿Quieres borrar esta publicación de la comunidad?')) return;
    communityBusyPostIds.add(post.id);
    try {
      const result = await PN.deleteCommunityPost(post.id);
      if (!result.ok) {
        showCommunityMessage(`No se pudo borrar la publicación. ${communityBackendError(result.error)}`);
        return;
      }
      myCommunityPosts = myCommunityPosts.filter(item => item.id !== post.id);
      if (post.imagePath) {
        const imageResult = await PN.removeCommunityImage(post.imagePath);
        if (!imageResult.ok) {
          console.error('No se pudo borrar la imagen de la publicación eliminada:', imageResult.error);
          showCommunityMessage('La publicación se borró, pero no se pudo eliminar su imagen del almacenamiento.');
        } else {
          showCommunityMessage('La publicación se borró.');
        }
      } else {
        showCommunityMessage('La publicación se borró.');
      }
      renderCommunity();
    } finally {
      communityBusyPostIds.delete(post.id);
    }
  };

  const shareLocalCommunityPost = async (post, button) => {
    if (communityBusyPostIds.has(post.localId)) return;
    communityBusyPostIds.add(post.localId);
    button.disabled = true;
    let imagePath = '';
    try {
      if (post.image) {
        const imageResponse = await fetch(post.image);
        if (!imageResponse.ok) throw new Error('No se pudo leer la imagen guardada.');
        const sourceBlob = await imageResponse.blob();
        const optimizedImage = await PN.shrink(sourceBlob, 1000);
        const imageBlob = await (await fetch(optimizedImage)).blob();
        const upload = await PN.uploadCommunityImage(imageBlob);
        if (!upload.ok) {
          showCommunityMessage(`No se pudo compartir la imagen. ${communityBackendError(upload.error)}`);
          return;
        }
        imagePath = upload.path;
      }

      const pollOptions = post.poll
        ? post.poll.options.map(option => ({ id: PN.uid(), text: option.text }))
        : null;
      const result = await PN.createCommunityPost({
        text: post.text,
        petName: post.pet,
        type: post.poll ? 'poll' : 'post',
        imagePath,
        pollOptions
      });
      if (!result.ok) {
        if (imagePath) {
          const cleanup = await PN.removeCommunityImage(imagePath);
          if (!cleanup.ok) console.error('No se pudo limpiar una imagen cuya publicación falló:', cleanup.error);
        }
        showCommunityMessage(`No se pudo compartir la publicación. ${communityBackendError(result.error)}`);
        return;
      }

      const remainingPosts = localCommunityPosts.filter(item => item.localId !== post.localId);
      if (!storeLocalCommunityPosts(remainingPosts)) {
        localCommunityPosts = remainingPosts;
        renderCommunity();
        showCommunityMessage('La publicación sí se compartió, pero no se pudo quitar la copia local guardada.');
      } else {
        localCommunityPosts = remainingPosts;
        const loaded = await loadCommunityPosts();
        showCommunityMessage(loaded
          ? 'La publicación ya está compartida con usuarios que iniciaron sesión.'
          : 'La publicación se compartió, pero no se pudo actualizar la lista.');
      }
    } catch (error) {
      console.error('No se pudo compartir una publicación local:', error);
      if (imagePath) {
        const cleanup = await PN.removeCommunityImage(imagePath);
        if (!cleanup.ok) console.error('No se pudo limpiar la imagen después de un error al compartir:', cleanup.error);
      }
      showCommunityMessage('Ocurrió un error al compartir la publicación. La copia local se conservó.');
    } finally {
      communityBusyPostIds.delete(post.localId);
      button.disabled = false;
    }
  };

  const makeCommunityPost = (post, isExample, isLocal = false) => {
    const article = document.createElement('article');
    article.className = 'community-post';
    if (isExample) {
      article.id = post.id;
    }
    if (!post.image) {
      article.classList.add('community-post--text-only');
    }

    if (post.image) {
      const media = document.createElement('div');
      media.className = 'community-post__media';
      const image = document.createElement('img');
      image.src = post.image;
      image.alt = `Momento compartido por ${post.author}`;
      image.loading = 'lazy';
      image.addEventListener('error', () => {
        media.remove();
        article.classList.add('community-post--text-only');
      }, { once: true });
      media.appendChild(image);
      article.appendChild(media);
    }

    const body = document.createElement('div');
    body.className = 'community-post__body';
    const topline = document.createElement('div');
    topline.className = 'community-post__topline';

    const author = document.createElement('div');
    author.className = 'community-author';
    const avatar = document.createElement('span');
    avatar.className = 'community-author__avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = post.author.charAt(0).toLocaleUpperCase('es');
    const authorDetails = document.createElement('span');
    authorDetails.className = 'community-author__details';
    const authorName = document.createElement('strong');
    authorName.textContent = post.author;
    const petName = document.createElement('span');
    petName.textContent = post.pet || 'Comunidad Pet Nova';
    authorDetails.append(authorName, petName);
    author.append(avatar, authorDetails);

    const badge = document.createElement('span');
    badge.className = 'community-post__badge';
    badge.textContent = isExample
      ? 'Ejemplo'
      : isLocal
        ? 'Pendiente de compartir'
        : post.userId === communityUserId
          ? 'Tu publicación'
          : 'Comunidad';
    topline.append(author, badge);

    const title = document.createElement('h4');
    title.textContent = post.poll ? 'Encuesta' : post.title || 'Lo que quiero compartir';
    const text = document.createElement('p');
    text.className = 'community-post__text';
    text.textContent = post.text;
    body.append(topline, title, text);
    if (post.poll) {
      const poll = document.createElement('div');
      poll.className = 'community-poll';
      poll.setAttribute('aria-label', 'Opciones de votación');
      const prompt = document.createElement('p');
      prompt.className = 'community-poll__prompt';
      prompt.textContent = 'Vota por una opción';
      poll.appendChild(prompt);
      post.poll.options.forEach(option => {
        const vote = document.createElement('button');
        vote.type = 'button';
        vote.className = 'community-poll__option';
        vote.disabled = Boolean(post.poll.votedOptionId);
        vote.setAttribute('aria-pressed', String(post.poll.votedOptionId === option.id));
        vote.addEventListener('click', () => {
          if (isLocal) castLocalCommunityVote(post.localId, option.id);
          else if (!isExample) castCommunityVote(post.id, option.id);
        });
        const label = document.createElement('span');
        label.textContent = option.text;
        const count = document.createElement('span');
        count.className = 'community-poll__votes';
        count.textContent = `${option.votes} ${option.votes === 1 ? 'voto' : 'votos'}`;
        vote.append(label, count);
        poll.appendChild(vote);
      });
      const pollNote = document.createElement('span');
      pollNote.className = 'community-poll__note';
      pollNote.textContent = post.poll.votedOptionId
        ? isLocal
          ? 'Voto guardado solo en este dispositivo'
          : 'Ya votaste'
        : isLocal
          ? 'Encuesta local · solo en este dispositivo'
          : 'Puedes votar una vez';
      poll.appendChild(pollNote);
      body.appendChild(poll);
    }
    if (isLocal) {
      const shareButton = document.createElement('button');
      shareButton.type = 'button';
      shareButton.className = 'community-post__action';
      shareButton.textContent = 'Compartir con la comunidad';
      shareButton.addEventListener('click', () => shareLocalCommunityPost(post, shareButton));
      body.appendChild(shareButton);
    } else if (!isExample && post.userId === communityUserId) {
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'community-post__action community-post__action--delete';
      deleteButton.textContent = 'Borrar publicación';
      deleteButton.addEventListener('click', () => deleteCommunityPost(post));
      body.appendChild(deleteButton);
    }
    const note = document.createElement('span');
    note.className = 'community-post__tagline';
    note.textContent = isExample
      ? 'Contenido de demostración · No es una publicación real'
      : isLocal
        ? 'Guardada en este navegador · Compártela cuando quieras'
        : 'Visible para usuarios con sesión iniciada';
    body.appendChild(note);
    article.appendChild(body);
    return article;
  };

  const renderCommunity = () => {
    communityFeed.replaceChildren();
    localCommunityPosts.slice().reverse().forEach(post => {
      communityFeed.appendChild(makeCommunityPost(post, false, true));
    });
    myCommunityPosts.forEach(post => {
      communityFeed.appendChild(makeCommunityPost(post, false));
    });
    communityExamples.forEach(post => {
      communityFeed.appendChild(makeCommunityPost(post, true));
    });
  };

  const updateCommunityComposer = () => {
    const isPoll = communityPostType.value === 'poll';
    communityPollFields.hidden = !isPoll;
    communityPollOptionInputs.forEach(input => {
      input.disabled = !isPoll;
      input.required = isPoll;
    });
    communityInputLabel.textContent = isPoll ? 'Pregunta de la encuesta' : '¿Qué te gustaría compartir?';
    communityInput.placeholder = isPoll
      ? 'Escribe una pregunta clara para la comunidad…'
      : 'Comparte una historia, recomendación o momento especial…';
    communitySubmitButton.textContent = isPoll ? 'Crear encuesta' : 'Publicar';
  };

  communityPostType.addEventListener('change', updateCommunityComposer);
  updateCommunityComposer();

  communityForm.addEventListener('submit', async event => {
    event.preventDefault();
    const text = communityInput.value.trim();
    if (!text) {
      showCommunityMessage(communityPostType.value === 'poll'
        ? 'Escribe una pregunta antes de crear la encuesta.'
        : 'Escribe algo antes de publicar.');
      communityInput.focus();
      return;
    }

    const isPoll = communityPostType.value === 'poll';
    const options = communityPollOptionInputs.map(input => input.value.trim()).filter(Boolean);
    if (isPoll && (options.length < 2 || new Set(options.map(option => option.toLocaleLowerCase('es'))).size !== options.length)) {
      showCommunityMessage('Escribe dos opciones diferentes para la encuesta.');
      return;
    }

    const imageFile = communityImageInput.files[0];
    if (imageFile && (!/^image\/(jpeg|png|webp|gif)$/i.test(imageFile.type) || imageFile.size > 5 * 1024 * 1024)) {
      showCommunityMessage('Elige una imagen JPG, PNG, WEBP o GIF de hasta 5 MB.');
      return;
    }

    communitySubmitButton.disabled = true;
    let imagePath = '';
    try {
      let image = '';
      if (imageFile) {
        try {
          image = await PN.shrink(imageFile, 1000);
        } catch (error) {
          console.error('No se pudo procesar la imagen de la publicación:', error);
          showCommunityMessage('No se pudo procesar la imagen. Prueba con otro archivo.');
          return;
        }
      }

      if (image) {
        const imageBlob = await (await fetch(image)).blob();
        const upload = await PN.uploadCommunityImage(imageBlob);
        if (!upload.ok) {
          showCommunityMessage(`No se pudo adjuntar la imagen. ${communityBackendError(upload.error)}`);
          return;
        }
        imagePath = upload.path;
      }
      const result = await PN.createCommunityPost({
        text,
        petName: 'Mi familia Pet Nova',
        type: isPoll ? 'poll' : 'post',
        imagePath,
        pollOptions: isPoll ? options.map(option => ({ id: PN.uid(), text: option })) : null
      });
      if (!result.ok) {
        if (imagePath) {
          const cleanup = await PN.removeCommunityImage(imagePath);
          if (!cleanup.ok) console.error('No se pudo limpiar una imagen cuya publicación falló:', cleanup.error);
        }
        showCommunityMessage(`No se pudo publicar. ${communityBackendError(result.error)}`);
        return;
      }
      communityForm.reset();
      updateCommunityComposer();
      const loaded = await loadCommunityPosts();
      showCommunityMessage(loaded
        ? isPoll
          ? 'Tu encuesta ya está compartida con usuarios que iniciaron sesión.'
          : 'Tu publicación ya está compartida con usuarios que iniciaron sesión.'
        : 'La publicación se guardó en la comunidad, pero no se pudo actualizar la lista.');
    } catch (error) {
      console.error('No se pudo publicar en la comunidad:', error);
      if (imagePath) {
        const cleanup = await PN.removeCommunityImage(imagePath);
        if (!cleanup.ok) console.error('No se pudo limpiar la imagen después de un error al publicar:', cleanup.error);
      }
      showCommunityMessage('Ocurrió un error al publicar. Tu texto sigue en el formulario para que puedas intentarlo de nuevo.');
    } finally {
      communitySubmitButton.disabled = false;
    }
  });
  renderCommunity();
  tabs.forEach(tab => {
    if (tab.dataset.target === 'community') tab.addEventListener('click', loadCommunityPosts);
  });
  window.addEventListener('hashchange', () => {
    if (location.hash.slice(1) === 'community') loadCommunityPosts();
  });
  if (requestedSubmodule === 'community') loadCommunityPosts();

  filterButtons.forEach(button => {
    button.setAttribute('aria-pressed', String(button.classList.contains('active')));
    button.addEventListener('click', () => {
      state.filter = button.dataset.filter;
      filterButtons.forEach(item => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      if (placesLoaded) renderPlaces();
    });
  });

  viewButtons.forEach(button => {
    button.addEventListener('click', () => {
      state.view = button.dataset.view;
      updateView();
    });
  });
  updateView();
});
