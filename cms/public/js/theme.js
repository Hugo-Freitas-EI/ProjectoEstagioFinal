document.addEventListener('DOMContentLoaded', function () {
  var btn  = document.getElementById('theme-toggle');
  var icon = document.getElementById('theme-icon');
  if (!btn) return;

  function getEffective() {
    var saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function updateIcon() {
    if (!icon) return;
    icon.className = getEffective() === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
  }

  btn.addEventListener('click', function () {
    var next = getEffective() === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    document.documentElement.style.colorScheme = next;
    updateIcon();
  });

  updateIcon();
});
