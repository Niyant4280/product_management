// =============================================
// sidebar-user.js — Live User Badge Injection
// Reads firebase auth state and injects user card into sidebar footer
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  // Wait for auth to be ready
  firebase.auth().onAuthStateChanged((user) => {
    if (!user) return;

    // Get initials
    let initials = 'U';
    let displayName = user.displayName || '';
    let email = user.email || '';

    if (displayName) {
      initials = displayName.split(' ').map(n => n[0] || '').join('').toUpperCase().slice(0, 2);
    } else if (email) {
      initials = email[0].toUpperCase();
    }

    const shortName = displayName || email.split('@')[0];

    // Inject into every sidebar footer on the page
    const sidebarFooters = document.querySelectorAll('.sidebar-footer');
    sidebarFooters.forEach(footer => {
      // Check if badge already injected
      if (footer.querySelector('.sidebar-user-badge')) return;

      // Remove old plain profile button if it exists
      footer.querySelectorAll('.nav-item').forEach(btn => {
        const icon = btn.querySelector('i[data-lucide="user"]');
        if (icon && btn.innerText.trim().includes('Profile')) {
          btn.remove();
        }
      });

      const badge = document.createElement('div');
      badge.className = 'sidebar-user-badge';
      badge.title = 'Go to Profile';
      badge.setAttribute('role', 'button');
      badge.setAttribute('tabindex', '0');
      badge.onclick = () => window.location.href = 'profile.html';
      badge.onkeydown = (e) => { if (e.key === 'Enter') window.location.href = 'profile.html'; };

      badge.innerHTML = `
        <div class="sidebar-avatar-sm">${initials}</div>
        <div class="sidebar-user-info">
          <span class="sidebar-user-name">${shortName}</span>
          <span class="sidebar-user-email">${email}</span>
        </div>
        <i data-lucide="chevron-right" style="width:14px;height:14px;flex-shrink:0;color:#64748b;"></i>
      `;

      // Insert at top of footer, before logout button
      const logoutBtn = footer.querySelector('#logoutBtn');
      if (logoutBtn) {
        footer.insertBefore(badge, logoutBtn);
      } else {
        footer.insertBefore(badge, footer.firstChild);
      }
    });

    // Re-render icons
    if (window.lucide) lucide.createIcons();
  });
});
