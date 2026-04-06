// =============================================
// command-palette.js — Ctrl+K Command Palette
// =============================================

const CommandPalette = (() => {
  const NAV_ITEMS = [
    { label: 'Dashboard',          desc: 'View overview & product inventory',   icon: 'layout-grid',   href: 'dashboard.html' },
    { label: 'Add Product',        desc: 'Create a new product entry',          icon: 'plus-circle',   href: 'add-product.html' },
    { label: 'Create Quote',       desc: 'Generate a new quote for a customer', icon: 'file-plus',     href: 'quote.html' },
    { label: 'View Quotes',        desc: 'Browse and manage all quotes',        icon: 'files',         href: 'view_quotes.html' },
    { label: 'Customers',          desc: 'Manage your client list',             icon: 'users',         href: 'customers.html' },
    { label: 'Product Analytics',  desc: 'Charts and stats for products',       icon: 'bar-chart-2',   href: 'product-analytics.html' },
    { label: 'Quote Analytics',    desc: 'Revenue & quote status breakdown',    icon: 'pie-chart',     href: 'quote-analytics.html' },
    { label: 'My Profile',         desc: 'Manage your account & password',      icon: 'user',          href: 'profile.html' },
    { label: 'Logout',             desc: 'Sign out of your account',           icon: 'log-out',       action: 'logout' },
  ];

  let overlay, input, resultsList, activeIndex = -1;
  let currentItems = [...NAV_ITEMS];
  let isOpen = false;

  const build = () => {
    overlay = document.createElement('div');
    overlay.className = 'cp-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Command palette');
    overlay.innerHTML = `
      <div class="cp-palette" role="listbox">
        <div class="cp-search-wrap">
          <i data-lucide="search"></i>
          <input class="cp-search-input" type="text" placeholder="Type a command or search..." autocomplete="off" spellcheck="false" />
          <span class="cp-shortcut">ESC to close</span>
        </div>
        <div class="cp-results"></div>
        <div class="cp-footer">
          <div class="cp-kbd-hint"><span class="cp-kbd">↑↓</span> Navigate</div>
          <div class="cp-kbd-hint"><span class="cp-kbd">Enter</span> Select</div>
          <div class="cp-kbd-hint"><span class="cp-kbd">Esc</span> Close</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    input = overlay.querySelector('.cp-search-input');
    resultsList = overlay.querySelector('.cp-results');

    if (window.lucide) lucide.createIcons({ nodes: overlay.querySelectorAll('[data-lucide]') });

    // Events
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    input.addEventListener('input', () => { activeIndex = -1; render(input.value); });
    input.addEventListener('keydown', handleKeydown);
  };

  const render = (query = '') => {
    query = query.toLowerCase().trim();

    if (query) {
      currentItems = NAV_ITEMS.filter(item =>
        item.label.toLowerCase().includes(query) ||
        item.desc.toLowerCase().includes(query)
      );
    } else {
      currentItems = [...NAV_ITEMS];
    }

    resultsList.innerHTML = '';

    if (currentItems.length === 0) {
      resultsList.innerHTML = `<div class="cp-empty">No results for "<strong>${query}</strong>"</div>`;
      return;
    }

    if (!query) {
      const label = document.createElement('div');
      label.className = 'cp-group-label';
      label.textContent = 'Navigation';
      resultsList.appendChild(label);
    }

    currentItems.forEach((item, idx) => {
      const el = document.createElement('div');
      el.className = 'cp-item';
      el.setAttribute('role', 'option');
      el.setAttribute('data-idx', idx);
      el.innerHTML = `
        <div class="cp-item-icon"><i data-lucide="${item.icon}"></i></div>
        <div class="cp-item-text">
          <span class="cp-item-label">${item.label}</span>
          <span class="cp-item-desc">${item.desc}</span>
        </div>
      `;
      el.addEventListener('click', () => execute(item));
      el.addEventListener('mouseenter', () => setActive(idx));
      resultsList.appendChild(el);
    });

    if (window.lucide) lucide.createIcons({ nodes: resultsList.querySelectorAll('[data-lucide]') });
  };

  const setActive = (idx) => {
    activeIndex = idx;
    resultsList.querySelectorAll('.cp-item').forEach((el, i) => {
      el.classList.toggle('cp-active', i === idx);
    });
  };

  const handleKeydown = (e) => {
    const items = resultsList.querySelectorAll('.cp-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, items.length - 1));
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && currentItems[activeIndex]) execute(currentItems[activeIndex]);
    } else if (e.key === 'Escape') {
      close();
    }
  };

  const execute = (item) => {
    close();
    if (item.action === 'logout') {
      firebase.auth().signOut().then(() => window.location.href = 'index.html');
    } else if (item.href) {
      setTimeout(() => window.location.href = item.href, 100);
    }
  };

  const open = () => {
    if (!overlay) build();
    isOpen = true;
    overlay.classList.add('cp-open');
    input.value = '';
    activeIndex = -1;
    render('');
    setTimeout(() => input.focus(), 50);
  };

  const close = () => {
    isOpen = false;
    if (overlay) overlay.classList.remove('cp-open');
  };

  const toggle = () => isOpen ? close() : open();

  // Global keyboard listener
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      toggle();
    }
    if (e.key === 'Escape' && isOpen) close();
  });

  return { open, close, toggle };
})();

window.CommandPalette = CommandPalette;
