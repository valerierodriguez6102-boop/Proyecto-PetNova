/* Inicio de sesión y registro en 3 pasos */
const $ = id => document.getElementById(id);
const say = (id, t) => { $(id).textContent = t; $(id).hidden = !t; };
const reg = $('register-form'), steps = [...reg.querySelectorAll('[data-step]')], dots = [...reg.querySelectorAll('[data-dot]')];
let step = 1;

const go = n => {
  step = n; say('register-msg', '');
  steps.forEach(s => s.hidden = +s.dataset.step !== n);
  dots.forEach(d => { const k = +d.dataset.dot; d.classList.toggle('current', k === n); d.classList.toggle('done', k < n); });
};
const tab = which => {
  const r = which === 'register';
  $('login-form').hidden = r; reg.hidden = !r;
  $('tab-login').classList.toggle('is-on', !r); $('tab-register').classList.toggle('is-on', r);
  $('tab-login').setAttribute('aria-selected', !r); $('tab-register').setAttribute('aria-selected', r);
};
const next = () => {
  const bad = [...steps[step - 1].querySelectorAll('input,select,textarea')].find(f => !f.checkValidity());
  if (bad) return bad.reportValidity();
  go(step + 1);
};

$('tab-login').onclick = () => tab('login');
$('tab-register').onclick = () => tab('register');
reg.querySelectorAll('[data-next]').forEach(b => b.onclick = next);
reg.querySelectorAll('[data-back]').forEach(b => b.onclick = () => go(step - 1));
document.querySelectorAll('[data-password-toggle]').forEach(button => {
  button.addEventListener('click', () => {
    const input = button.parentElement.querySelector('input');
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.setAttribute('aria-pressed', visible);
    button.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });
});
$('photo').addEventListener('change', e => {
  const f = e.target.files[0], box = $('preview');
  box.innerHTML = f ? `<img src="${URL.createObjectURL(f)}" alt="Vista previa">` : '🐾';
});

$('login-form').addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(e.target), r = PN.login(fd.get('email'), fd.get('password'));
  if (r.error) return say('login-msg', r.error);
  location.href = 'dashboard.html';
});

reg.addEventListener('submit', async e => {
  e.preventDefault();
  if (step < 3) return next();
  const fd = new FormData(reg), pet = await PN.petFrom(fd), err = PN.petError(pet);
  if (err) return say('register-msg', err);
  const r = PN.register({ name: fd.get('ownerName'), email: fd.get('email'), phone: fd.get('phone'), city: fd.get('city'), password: fd.get('password') }, pet);
  if (r.error) return say('register-msg', r.error);
  location.href = 'dashboard.html';
});

go(1);
if (location.hash === '#registro') tab('register');
if (new URLSearchParams(location.search).get('account') === 'deleted') {
  say('login-msg', 'Tu cuenta y los datos asociados se eliminaron correctamente.');
}
