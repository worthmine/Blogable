let currentLang = 'en';

function loadLang(lang) {
  const file = lang === 'ja' ? 'statics/example_ja.txt' : 'statics/example_en.txt';
  fetch(file)
    .then(r => r.text())
    .then(text => {
      document.getElementById('source').value = text;
      render();
      fetchNewOgps(text).then(u => {
        if (u) render();
        const el = document.getElementById('ogp-status');
        if (el) {
          const m = el.textContent.match(/(\d+)件/);
          el.textContent = m ? `URL labels: ${m[1]} generated` : 'URL labels: status unavailable';
        }
      });
    });
  document.documentElement.lang = lang;
  currentLang = lang;
  const btn = document.getElementById('lang-toggle-btn');
  if (btn) { btn.textContent = lang === 'ja' ? 'English' : '日本語'; btn.setAttribute('aria-label', lang === 'ja' ? 'Switch to English' : 'Switch to Japanese'); }
}

function toggleLang() {
  loadLang(currentLang === 'en' ? 'ja' : 'en');
}

document.getElementById('lang-toggle-btn').addEventListener('click', toggleLang);

document.querySelectorAll('.tab-btn').forEach(btn => {
  const tab = btn.textContent.trim().toLowerCase();
  btn.addEventListener('click', function() { switchTab(tab, this); });
});

loadLang('en');
