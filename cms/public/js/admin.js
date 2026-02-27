// ── MARKDOWN PREVIEW (client-side only, não bloqueia submit) ──
function mdPreview(text) {
  if (!text) return '';
  return text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^(?!<)(.+)$/gm, function(m) { return m.startsWith('<') ? m : '<p>' + m + '</p>'; });
}

function updatePreview() {
  var ta = document.getElementById('e-content');
  var prev = document.getElementById('e-preview');
  if (ta && prev) prev.innerHTML = mdPreview(ta.value);
}

// ── SLUG AUTO ──
function slugifyStr(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function autoSlug(val) {
  var slugEl = document.getElementById('e-slug');
  var previewEl = document.getElementById('slug-preview');
  if (slugEl && !slugEl.dataset.manual) {
    slugEl.value = slugifyStr(val);
  }
  if (previewEl) previewEl.textContent = '/' + (slugEl ? slugEl.value : slugifyStr(val));
}

// ── INSERIR MARKDOWN ──
function insertMd(syntax) {
  var ta = document.getElementById('e-content');
  if (!ta) return;
  var start = ta.selectionStart;
  var end = ta.selectionEnd;
  var selected = ta.value.slice(start, end);
  var replacement = selected ? syntax.replace('texto', selected) : syntax;
  ta.value = ta.value.slice(0, start) + replacement + ta.value.slice(end);
  ta.focus();
  updatePreview();
}

// ── MODAL ──
function openModal(id) {
  var el = document.getElementById(id);
  if (el) el.style.display = 'flex';
}
function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// Fechar modal ao clicar fora
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.style.display = 'none';
  }
});

// ── TOAST (para mensagens flash vindas do servidor) ──
document.addEventListener('DOMContentLoaded', function() {
  // Slug manual
  var slugEl = document.getElementById('e-slug');
  if (slugEl) {
    slugEl.addEventListener('input', function() {
      slugEl.dataset.manual = 'true';
      var previewEl = document.getElementById('slug-preview');
      if (previewEl) previewEl.textContent = '/' + slugEl.value;
    });
  }

  // Preview inicial
  updatePreview();

  // Mostrar flash message como toast se existir
  var flash = document.getElementById('flash-data');
  if (flash) {
    var msg = flash.dataset.msg;
    var type = flash.dataset.type || 'success';
    if (msg) showToast(msg, type);
  }
});

function showToast(msg, type) {
  var el = document.getElementById('toast');
  if (!el) return;
  document.getElementById('toast-icon').textContent = type === 'success' ? '✓' : '✕';
  document.getElementById('toast-msg').textContent = msg;
  el.className = 'show ' + type;
  setTimeout(function() { el.className = ''; }, 3000);
}
