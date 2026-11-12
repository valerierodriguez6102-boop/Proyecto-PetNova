/* Landing: menú móvil y transiciones al desplazarse */
const $ = s => document.querySelector(s);
const menu = $('.menu'), nav = $('#site-nav');
const closeMenu = () => { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); };
menu.addEventListener('click', () => menu.setAttribute('aria-expanded', nav.classList.toggle('open')));
nav.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });

const storyView = $('.pet-stories__viewport');
const storyTrack = $('.pet-stories__track');
const stories = [...storyTrack.children];
const storyDots = $('.pet-stories__dots');
let storyIndex = 0;
const placeStory = () => {
  const story = stories[storyIndex];
  storyTrack.style.transform = `translateX(${storyView.clientWidth / 2 - (story.offsetLeft + story.offsetWidth / 2)}px)`;
  stories.forEach((card, index) => {
    const active = index === storyIndex;
    card.classList.toggle('is-active', active);
    card.setAttribute('aria-hidden', String(!active));
  });
  [...storyDots.children].forEach((dot, index) => {
    const active = index === storyIndex;
    dot.classList.toggle('is-active', active);
    dot.setAttribute('aria-pressed', String(active));
  });
};
const goToStory = index => {
  storyIndex = (index + stories.length) % stories.length;
  placeStory();
};
$('.pet-carousel__arrow--prev').addEventListener('click', () => goToStory(storyIndex - 1));
$('.pet-carousel__arrow--next').addEventListener('click', () => goToStory(storyIndex + 1));
storyDots.addEventListener('click', event => {
  const dot = event.target.closest('button');
  if (dot) goToStory([...storyDots.children].indexOf(dot));
});
storyView.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') goToStory(storyIndex - 1);
  if (event.key === 'ArrowRight') goToStory(storyIndex + 1);
});
window.addEventListener('resize', placeStory);
window.addEventListener('load', placeStory);
placeStory();

const revealGroups = [
  document.querySelectorAll('.hero__text, .hero__frame'),
  document.querySelectorAll('.about'),
  document.querySelectorAll('#por-que > h2'),
  document.querySelectorAll('#por-que .why'),
  document.querySelectorAll('#servicios > h2'),
  document.querySelectorAll('#servicios .service'),
  document.querySelectorAll('.promo'),
  document.querySelectorAll('#resenas > h2, #resenas > .pet-stories__intro, #resenas .pet-story'),
  document.querySelectorAll('#contacto > *'),
  document.querySelectorAll('.footer > *')
];

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const pendingReveals = new Set(revealGroups.flatMap(group => [...group]));
  let revealScheduled = false;

  const revealVisible = () => {
    const revealLine = window.innerHeight;
    pendingReveals.forEach(element => {
      const bounds = element.getBoundingClientRect();
      if (bounds.top <= revealLine && bounds.bottom >= 0) {
        element.classList.add('is-visible');
        pendingReveals.delete(element);
      }
    });
    if (!pendingReveals.size) {
      window.removeEventListener('scroll', scheduleReveals);
      window.removeEventListener('resize', scheduleReveals);
    }
  };
  const scheduleReveals = () => {
    if (revealScheduled) return;
    revealScheduled = true;
    requestAnimationFrame(() => {
      revealScheduled = false;
      revealVisible();
    });
  };

  revealGroups.forEach(group => group.forEach((element, index) => {
    element.classList.add('scroll-reveal');
    element.style.setProperty('--reveal-delay', `${Math.min(index, 3) * 80}ms`);
  }));
  window.addEventListener('scroll', scheduleReveals, { passive: true });
  window.addEventListener('resize', scheduleReveals);
  scheduleReveals();
}
