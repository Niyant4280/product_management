// =============================================
// toast.js — Toast Notification + Confirm/Prompt Engine
// =============================================

const Toast = (() => {
  let container = null;

  const getContainer = () => {
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  };

  const iconMap = {
    success: 'check-circle',
    error:   'x-circle',
    warning: 'alert-triangle',
    info:    'info',
  };

  const show = (message, type = 'info', duration = 4000) => {
    const c = getContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    toast.innerHTML = `
      <div class="toast-icon">
        <i data-lucide="${iconMap[type] || 'info'}"></i>
      </div>
      <div class="toast-message">${message}</div>
      <button class="toast-close" title="Dismiss">&times;</button>
      <div class="toast-progress"></div>
    `;

    c.appendChild(toast);

    // Render lucide icons inside toast
    if (window.lucide) lucide.createIcons({ nodes: toast.querySelectorAll('[data-lucide]') });

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('toast-visible'));
    });

    // Start progress bar
    const progress = toast.querySelector('.toast-progress');
    progress.style.animationDuration = `${duration}ms`;
    setTimeout(() => progress.classList.add('toast-progress-active'), 50);

    // Auto dismiss
    const timer = setTimeout(() => dismiss(toast), duration);

    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
      clearTimeout(timer);
      dismiss(toast);
    });

    return toast;
  };

  const dismiss = (toast) => {
    if (!toast || toast._dismissing) return;
    toast._dismissing = true;
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-hiding');
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 350);
  };

  // === Custom Confirm Dialog ===
  const confirm = (message, dangerLabel = 'Confirm') => {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-modal">
          <div class="confirm-icon" style="background:#fef3c7; color:#d97706;">
            <i data-lucide="alert-triangle"></i>
          </div>
          <p class="confirm-message">${message}</p>
          <div class="confirm-actions">
            <button class="btn btn-outline confirm-cancel">Cancel</button>
            <button class="btn btn-danger confirm-ok">${dangerLabel}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      if (window.lucide) lucide.createIcons({ nodes: overlay.querySelectorAll('[data-lucide]') });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => overlay.classList.add('confirm-visible'));
      });

      const close = (result) => {
        overlay.classList.remove('confirm-visible');
        setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 250);
        resolve(result);
      };

      overlay.querySelector('.confirm-ok').addEventListener('click', () => close(true));
      overlay.querySelector('.confirm-cancel').addEventListener('click', () => close(false));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
      document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { document.removeEventListener('keydown', esc); close(false); }
      });
    });
  };

  // === Custom Prompt Dialog (for rejection reason etc.) ===
  const prompt = (message, placeholder = '', submitLabel = 'Submit') => {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-modal">
          <div class="confirm-icon" style="background:#e0e7ff; color:#4f46e5;">
            <i data-lucide="message-square"></i>
          </div>
          <p class="confirm-message">${message}</p>
          <textarea class="prompt-input" placeholder="${placeholder}" rows="3"></textarea>
          <div class="confirm-actions">
            <button class="btn btn-outline confirm-cancel">Skip</button>
            <button class="btn btn-primary confirm-ok">${submitLabel}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      if (window.lucide) lucide.createIcons({ nodes: overlay.querySelectorAll('[data-lucide]') });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => overlay.classList.add('confirm-visible'));
      });

      const textarea = overlay.querySelector('.prompt-input');
      textarea.focus();

      const close = (result) => {
        overlay.classList.remove('confirm-visible');
        setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 250);
        resolve(result);
      };

      overlay.querySelector('.confirm-ok').addEventListener('click', () => close(textarea.value.trim() || null));
      overlay.querySelector('.confirm-cancel').addEventListener('click', () => close(null));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
    });
  };

  return { show, confirm, prompt };
})();

window.Toast = Toast;
