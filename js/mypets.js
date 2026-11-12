document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.submodule-tab');
  const sections = document.querySelectorAll('.submodule-content');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      sections.forEach(s => s.style.display = 'none');
      tab.classList.add('active');
      const target = document.getElementById(tab.dataset.target);
      if (target) target.style.display = 'block';
    });
  });
});
