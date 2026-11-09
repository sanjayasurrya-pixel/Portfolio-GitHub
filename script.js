// Intersection Observer for scroll reveals
const revealEls = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -10% 0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  revealEls.forEach(el => {
    observer.observe(el);
  });
} else {
  // Fallback: show everything if IO unsupported / JS partially fails
  revealEls.forEach(el => el.classList.add('visible'));
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (!href || href === '#') return;
    let target = null;
    try {
      target = document.querySelector(href);
    } catch {
      return;
    }
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// Tab Navigation for Portfolio Showcase
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

function switchTab(targetTab) {
  // Update buttons
  tabButtons.forEach(btn => {
    const isActive = btn.dataset.tab === targetTab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    btn.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  // Update panels
  tabPanels.forEach(panel => {
    const isActive = panel.id === `panel-${targetTab}`;
    panel.classList.toggle('active', isActive);
    panel.hidden = !isActive;
    if (isActive) {
      // Re-trigger reveal animations for the newly visible panel
      panel.querySelectorAll('.reveal:not(.visible)').forEach((el, i) => {
        setTimeout(() => el.classList.add('visible'), i * 50);
      });
    }
  });
}

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    switchTab(btn.dataset.tab);
  });

  // Keyboard navigation
  btn.addEventListener('keydown', (e) => {
    let targetIndex = -1;
    const currentIndex = Array.from(tabButtons).indexOf(btn);
    
    if (e.key === 'ArrowRight') {
      targetIndex = (currentIndex + 1) % tabButtons.length;
    } else if (e.key === 'ArrowLeft') {
      targetIndex = (currentIndex - 1 + tabButtons.length) % tabButtons.length;
    } else if (e.key === 'Home') {
      targetIndex = 0;
    } else if (e.key === 'End') {
      targetIndex = tabButtons.length - 1;
    }
    
    if (targetIndex >= 0) {
      e.preventDefault();
      tabButtons[targetIndex].focus();
      switchTab(tabButtons[targetIndex].dataset.tab);
    }
  });
});

// Tilt 3D kartu profil mengikuti kursor — terpisah dari sway/drag (.badge vs .id-card)
(function initCardTilt() {
  const badge = document.querySelector('.badge');
  const card = document.querySelector('.id-card');
  const zone = document.querySelector('.hero');
  if (!badge || !card || !zone) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const MAX_X = 14; // rotateX
  const MAX_Y = 18; // rotateY
  let tx = 0, ty = 0, cx = 0, cy = 0;
  let raf = 0;
  let active = false;

  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  function loop() {
    raf = 0;
    cx += (tx - cx) * 0.14;
    cy += (ty - cy) * 0.14;
    if (Math.abs(tx - cx) < 0.05) cx = tx;
    if (Math.abs(ty - cy) < 0.05) cy = ty;
    card.style.transform = `rotateX(${cx.toFixed(2)}deg) rotateY(${cy.toFixed(2)}deg)`;
    if (active || Math.abs(tx - cx) > 0.01 || Math.abs(ty - cy) > 0.01) {
      raf = requestAnimationFrame(loop);
    } else {
      card.style.transform = '';
      badge.classList.remove('is-tilting');
    }
  }

  function kick() {
    badge.classList.add('is-tilting');
    if (!raf) raf = requestAnimationFrame(loop);
  }

  zone.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen' && e.buttons !== 0) return;
    const r = card.getBoundingClientRect();
    // Posisi kursor relatif ke tengah kartu (-0.5 .. 0.5), dengan jangkauan hero
    const px = (e.clientX - (r.left + r.width / 2)) / Math.max(r.width * 1.6, 1);
    const py = (e.clientY - (r.top + r.height / 2)) / Math.max(r.height * 1.2, 1);
    const nx = Math.max(-0.5, Math.min(0.5, px));
    const ny = Math.max(-0.5, Math.min(0.5, py));
    ty = nx * 2 * MAX_Y;
    tx = ny * 2 * MAX_X * -1;
    // Glare mengikuti titik kursor di atas kartu
    const gx = clamp01((e.clientX - r.left) / (r.width || 1)) * 100;
    const gy = clamp01((e.clientY - r.top) / (r.height || 1)) * 100;
    card.style.setProperty('--gx', `${gx.toFixed(1)}%`);
    card.style.setProperty('--gy', `${gy.toFixed(1)}%`);
    card.style.setProperty('--glare-o', '0.35');
    active = true;
    kick();
  });

  function reset() {
    active = false;
    tx = 0; ty = 0;
    card.style.setProperty('--glare-o', '0');
    badge.classList.remove('is-tilting');
    // Kembali halus via transisi CSS
    card.style.transform = '';
  }

  zone.addEventListener('pointerleave', reset);
  document.addEventListener('mouseleave', reset);
})();

// Badge fisika: goyang pegas + terpental saat drag / kibasan kursor cepat
(function initBadgePhysics() {
  const badge = document.querySelector('.badge');
  const card = document.querySelector('.id-card');
  const lanyard = document.querySelector('.lanyard');
  const zone = document.querySelector('.hero');
  if (!badge || !card || !zone) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  badge.classList.add('has-physics');

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  let angle = 0, vel = 0;      // ayunan (derajat)
  let bounce = 0, vBounce = 0; // pentalan vertikal (px)
  let dragging = false;
  let dragX = 0, dragY = 0;
  let flickX = 0, flickY = 0;  // kecepatan lepas drag
  let startX = 0, startY = 0;
  let t0 = performance.now();

  function frame(now) {
    const t = (now - t0) / 1000;
    if (dragging) {
      // Ikuti jari/kursor saat drag, catat kecepatan untuk lemparan
      const targetA = clamp(dragX * 0.09, -28, 28);
      const prev = angle;
      angle += (targetA - angle) * 0.45;
      const instV = (angle - prev) * 60 / 16.7;
      flickX = flickX * 0.8 + instV * 0.2;
      const targetY = clamp(dragY * 0.25, -14, 46);
      vBounce = (targetY - bounce) * 0.35;
      bounce += vBounce;
      flickY = clamp(dragY * 0.06, -6, 8);
    } else {
      // Pegas teredam menuju sway lembut → efek goyang setelah digerakkan
      const sway = Math.sin(t * 1.15) * 1.5;
      const acc = (sway - angle) * 0.0085 - vel * 0.028;
      vel += acc;
      angle += vel;
      const accY = (0 - bounce) * 0.055 - vBounce * 0.16;
      vBounce += accY;
      bounce += vBounce;
      flickX *= 0.95;
    }
    badge.style.transform = `rotate(${angle.toFixed(2)}deg) translateY(${bounce.toFixed(1)}px)`;
    if (lanyard) {
      const stretch = clamp(1 + bounce * 0.0022 + Math.abs(vel) * 0.003, 0.94, 1.14);
      lanyard.style.transform = `scaleY(${stretch.toFixed(3)})`;
    }
    // Kilau mengikuti ayunan
    const shineX = clamp(-70 + (angle + 28) * (140 / 56), -70, 70);
    card.style.setProperty('--shine-x', `${shineX.toFixed(1)}%`);
    if (!dragging && Math.abs(card.style.getPropertyValue('--shine-o') || 0) > 0) {
      card.style.setProperty('--shine-o', Math.max(0, Math.abs(vel) / 6).toFixed(2));
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // --- Drag / lempar: lepas dengan kecepatan → memantul lalu bergoyang ---
  function onMove(e) {
    if (!dragging) return;
    dragX = e.clientX - startX;
    dragY = e.clientY - startY;
    card.style.setProperty('--shine-x', `${clamp(-70 + (dragX + 110) * (140 / 220), -70, 70).toFixed(1)}%`);
    card.style.setProperty('--shine-o', clamp(Math.abs(dragX) / 140 + 0.3, 0, 1).toFixed(2));
  }
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    badge.classList.remove('is-dragging');
    // Suntik kecepatan terakhir supaya terpental
    vel += clamp(flickX * 0.12, -4.5, 4.5);
    vBounce += clamp(flickY, -5, 6);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
    window.setTimeout(() => card.style.setProperty('--shine-o', '0'), 450);
  }
  card.addEventListener('pointerdown', (e) => {
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    dragX = 0; dragY = 0; flickX = 0; flickY = 0;
    badge.classList.add('is-dragging');
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    e.preventDefault();
  });

  // --- Kibasan kursor cepat di dekat kartu → terpental tanpa perlu drag ---
  let lastX = 0, lastY = 0, lastT = 0, coolUntil = 0;
  zone.addEventListener('pointermove', (e) => {
    if (dragging || e.pointerType === 'touch') return;
    const now = performance.now();
    const dt = Math.max(now - lastT, 1);
    const vx = (e.clientX - lastX) / dt; // px per ms
    const vy = (e.clientY - lastY) / dt;
    lastX = e.clientX; lastY = e.clientY; lastT = now;
    if (now < coolUntil) return;
    const speed = Math.hypot(vx, vy);
    if (speed < 1.6) return; // hanya kursor cepat
    const r = card.getBoundingClientRect();
    const m = 110; // radius pengaruh di sekitar kartu
    const near = e.clientX > r.left - m && e.clientX < r.right + m &&
                 e.clientY > r.top - m && e.clientY < r.bottom + m;
    if (!near) return;
    coolUntil = now + 140;
    // Dorong searah gerakan kursor + pentalan vertikal
    vel += clamp(vx * 1.35, -5.5, 5.5);
    vBounce += clamp(Math.abs(vy) * 2.2 + speed * 0.9, 0, 7) * (vy >= 0 ? 1 : -0.6);
    card.style.setProperty('--shine-o', '0.7');
    window.setTimeout(() => { if (!dragging) card.style.setProperty('--shine-o', '0'); }, 400);
  }, { passive: true });
})();

// Deskripsi per keahlian — satu panel, diganti sesuai tombol yang dipilih
(function initSkills() {
  const buttons = document.querySelectorAll('.skill-item[data-skill]');
  const panel = document.querySelector('.skill-detail');
  const titleEl = document.getElementById('skill-detail-title');
  const levelEl = document.getElementById('skill-detail-level');
  const descEl = document.getElementById('skill-detail-desc');
  const useEl = document.getElementById('skill-detail-use');
  if (!buttons.length || !panel || !titleEl || !descEl) return;

  const INFO = {
    html: { name: 'HTML & CSS', level: 'Terampil', desc: 'Menulis struktur semantik yang rapi dan stylesheet yang mudah dirawat, termasuk layout flexbox/grid dan halaman yang tetap rapi di layar HP.', use: 'Dipakai untuk: halaman login, dashboard rekap, dan seluruh tampilan portfolio ini.' },
    js: { name: 'JavaScript (ES6+)', level: 'Terampil', desc: 'Mengolah DOM, fetch data, dan modul ES6 untuk interaksi seperti tab portfolio, validasi form, dan modal notifikasi.', use: 'Dipakai untuk: tab Projects/Certificates, modal, dan badge interaktif di hero.' },
    ts: { name: 'TypeScript Dasar', level: 'Dasar', desc: 'Memahami tipe dasar, interface, dan type untuk props agar kesalahan operands tertangkap sebelum dijalankan.', use: 'Dipakai untuk: mencoba menulis ulang komponen kecil React dengan aman.' },
    react: { name: 'React.js', level: 'Menengah', desc: 'Membangun UI dari komponen, mengatur state dengan hooks, dan mengambil data API dengan loading dan error yang jelas.', use: 'Dipakai untuk: latihan aplikasi daftar tugas dan halaman dinamis.' },
    node: { name: 'Node.js & Express', level: 'Menengah', desc: 'Menyusun server kecil dengan routing, middleware, dan autentikasi JWT, lalu mengujinya lewat Postman sebelum disambung ke aplikasi.', use: 'Dipakai untuk: Task Management API di daftar proyek.' },
    php: { name: 'PHP & Laravel', level: 'Menengah', desc: 'Terbiasa dari praktik SMK: routing, Blade, Eloquent, dan validasi form untuk aplikasi CRUD yang utuh.', use: 'Dipakai untuk: tugas sekolah dan proyek CRUD berbasis server.' },
    db: { name: 'MySQL / PostgreSQL', level: 'Menengah', desc: 'Merancang tabel berelasi, menulis join dan agregasi, serta memakai ORM seperti Prisma agar query konsisten.', use: 'Dipakai untuk: penyimpanan task, kategori, dan rekap pengujian.' },
    git: { name: 'Git & GitHub', level: 'Terampil', desc: 'Bekerja dengan branch, commit yang jelas, dan pull request untuk kolaborasi tanpa menimpa pekerjaan orang lain.', use: 'Dipakai untuk: menyimpan semua proyek dan riwayat perubahannya.' },
    tailwind: { name: 'Tailwind CSS', level: 'Terampil', desc: 'Menyusun tampilan cepat dengan kelas utilitas dan menjaga konsistensi spacing serta breakpoint tanpa CSS berulang.', use: 'Dipakai untuk: prototyping halaman dan varian layout responsif.' },
    api: { name: 'REST API', level: 'Menengah', desc: 'Merancang endpoint dengan method dan status code yang tepat, plus dokumentasi Swagger agar mudah dipakai aplikasi.', use: 'Dipakai untuk: autentikasi, CRUD task, dan integrasi aplikasi-backend.' },
    vscode: { name: 'VS Code', level: 'Harian', desc: 'Alur kerja sehari-hari: debugging, multi-kursor, snippet, dan ekstensi formatter agar kode konsisten.', use: 'Dipakai untuk: seluruh pengembangan di portfolio ini.' },
    figma: { name: 'Figma (Dasar)', level: 'Dasar', desc: 'Membaca desain, mengukur spacing, dan mengekstrak warna serta aset agar hasil slicing mendekati mockup.', use: 'Dipakai untuk: menerjemahkan mockup sederhana menjadi halaman.' }
  };

  function select(key) {
    const info = INFO[key];
    if (!info) return;
    buttons.forEach((b) => {
      const on = b.dataset.skill === key;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    titleEl.textContent = info.name;
    if (levelEl) levelEl.textContent = info.level;
    descEl.textContent = info.desc;
    if (useEl) {
      useEl.innerHTML = '';
      const label = document.createElement('strong');
      label.textContent = 'Dipakai untuk: ';
      useEl.appendChild(label);
      useEl.appendChild(document.createTextNode(info.use.replace(/^Dipakai untuk:\s*/, '')));
    }
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      panel.classList.remove('is-switching');
      void panel.offsetWidth;
      panel.classList.add('is-switching');
    }
  }

  buttons.forEach((b) => b.addEventListener('click', () => select(b.dataset.skill)));
  select('html');
})();

// Tech stack mengikuti kursor: sorotan + tag magnetis di sekitar pointer
(function initTechStackCursor() {
  const wrap = document.querySelector('.techstack-categories');
  if (!wrap) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(pointer: coarse)').matches) return;
  const tags = Array.from(wrap.querySelectorAll('.techstack-tag'));
  if (!tags.length) return;

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  let raf = 0, cx = 0, cy = 0;

  function render() {
    raf = 0;
    const wr = wrap.getBoundingClientRect();
    wrap.style.setProperty('--mx', `${(cx - wr.left).toFixed(1)}px`);
    wrap.style.setProperty('--my', `${(cy - wr.top).toFixed(1)}px`);
    wrap.style.setProperty('--spot-o', '1');
    tags.forEach((tag) => {
      const r = tag.getBoundingClientRect();
      const tx = r.left + r.width / 2, ty = r.top + r.height / 2;
      const dx = cx - tx, dy = cy - ty;
      const dist = Math.hypot(dx, dy);
      if (dist < 150) {
        const pull = 1 - dist / 150;
        tag.style.setProperty('--tx', `${clamp(dx * 0.09, -7, 7).toFixed(1)}px`);
        tag.style.setProperty('--ty', `${clamp(dy * 0.09, -6, 6).toFixed(1)}px`);
        tag.classList.toggle('is-near', dist < 95 || pull > 0.35);
      } else {
        tag.style.setProperty('--tx', '0px');
        tag.style.setProperty('--ty', '0px');
        tag.classList.remove('is-near');
      }
    });
  }

  wrap.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    cx = e.clientX; cy = e.clientY;
    if (!raf) raf = requestAnimationFrame(render);
  }, { passive: true });

  wrap.addEventListener('pointerleave', () => {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    wrap.style.setProperty('--spot-o', '0');
    tags.forEach((tag) => {
      tag.style.setProperty('--tx', '0px');
      tag.style.setProperty('--ty', '0px');
      tag.classList.remove('is-near');
    });
  });
})();

// Detail proyek inline: tombol mengembang di dalam kartu (bukan popup)
(function initProjectInline() {
  const cards = document.querySelectorAll('.project-card[data-project]');
  if (!cards.length) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const DATA = {
    login: {
      desc: 'Halaman login responsif untuk aplikasi web dengan kartu efek kaca di atas latar dekoratif. Fokusnya pada kejelasan form: label terbaca, status error terlihat, dan alur masuk-daftar tidak membingungkan.',
      features: ['Input username dan password dengan tombol tampil kata sandi', 'Validasi kosong dan pesan error di bawah field', 'Tautan daftar dan lupa kata sandi yang jelas', 'Tata letak responsif dari HP sampai desktop']
    },
    rekap: {
      desc: 'Website informasi wisata Pesona Kelok Mertan yang memperkenalkan keindahan panorama kereta api di Kulon Progo, Yogyakarta. Halaman menyusun cerita perjalanan, daftar destinasi, dan informasi praktis pengunjung sebelum berangkat.',
      features: ['Hero menyajikan konteks perjalanan dan ajakan jelajahi', 'Daftar destinasi dengan cerita singkat di setiap lokasi', 'Informasi praktis wisata dan kontak pengelola', 'Tampilan responsif dari HP sampai desktop']
    },
    modal: {
      desc: 'Website promosi keripik singkong premium dengan desain modern dan elegan untuk memperkenalkan produk kepada pelanggan. Halaman menyampaikan keunggulan produk, cerita pembuat, dan ajakan mencoba.',
      features: ['Hero produk dengan nilai premium dan ajakan coba', 'Ringkasan keunggulan singkong dan bahan produk', 'Cerita pembuat keripik singkong', 'Tampilan responsif dari HP sampai desktop']
    },
    task: {
      desc: 'Proyek visualisasi tata surya berbasis web yang menampilkan planet beserta orbitnya. Pengguna dapat melihat susunan tata surya dan mengenal informasi singkat tiap planet secara interaktif.',
      features: ['Tampilan planet dan orbit tata surya', 'Informasi singkat tiap planet', 'Animasi pergerakan/orbit yang halus', 'Tata letak responsif untuk berbagai ukuran layar']
    }
  };

  function buildExtra(card, d) {
    let extra = card.querySelector('.project-extra');
    if (extra) return extra;
    extra = document.createElement('div');
    extra.className = 'project-extra';
    extra.hidden = true;
    const p = document.createElement('p');
    p.className = 'project-extra-desc';
    p.textContent = d.desc;
    const h = document.createElement('h4');
    h.className = 'project-extra-sub';
    h.textContent = 'Fitur utama';
    const ul = document.createElement('ul');
    ul.className = 'project-extra-features';
    d.features.forEach((f) => {
      const li = document.createElement('li');
      li.textContent = f;
      ul.appendChild(li);
    });
    extra.append(p, h, ul);
    card.appendChild(extra);
    return extra;
  }

  function closeCard(card) {
    card.classList.remove('is-open');
    const extra = card.querySelector('.project-extra');
    if (extra) extra.hidden = true;
    const btn = card.querySelector('[data-open]');
    if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.textContent = 'Lihat detail'; }
  }

  function openCard(card) {
    const d = DATA[card.dataset.project];
    if (!d) return;
    cards.forEach((c) => { if (c !== card) closeCard(c); });
    const extra = buildExtra(card, d);
    card.classList.add('is-open');
    extra.hidden = false;
    const btn = card.querySelector('[data-open]');
    if (btn) { btn.setAttribute('aria-expanded', 'true'); btn.textContent = 'Tutup detail'; }
    if (!reduced) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  cards.forEach((card) => {
    const btn = card.querySelector('[data-open]');
    if (btn) btn.addEventListener('click', () => {
      if (card.classList.contains('is-open')) closeCard(card);
      else openCard(card);
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cards.forEach(closeCard);
  });
})();

// Navigasi: tandai link aktif sesuai section yang terlihat
(function initNavSpy() {
  const links = Array.from(document.querySelectorAll('.bar-link[href^="#"]'));
  if (!links.length) return;
  const pairs = links.map((link) => {
    const id = link.getAttribute('href').slice(1);
    const section = document.getElementById(id);
    return section ? { link, section } : null;
  }).filter(Boolean);
  if (!pairs.length) return;

  function setActive(id) {
    links.forEach((link) => {
      const on = link.getAttribute('href') === '#' + id;
      link.classList.toggle('is-active', on);
      if (on) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  links.forEach((link) => {
    link.addEventListener('click', () => {
      const id = link.getAttribute('href').slice(1);
      if (id) setActive(id);
    });
  });

  if ('IntersectionObserver' in window) {
    const visible = new Map();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
      });
      let bestId = null, bestRatio = 0;
      visible.forEach((ratio, id) => {
        if (ratio > bestRatio) { bestRatio = ratio; bestId = id; }
      });
      if (bestId) setActive(bestId);
    }, { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] });
    pairs.forEach(({ section }) => observer.observe(section));
  }
})();