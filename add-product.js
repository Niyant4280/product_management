document.addEventListener('DOMContentLoaded', () => {
  firebase.auth().onAuthStateChanged(user => {
    if (!user) window.location.href = 'index.html';
  });

  // ============================================
  // FEATURE #12 — SMART DUPLICATE DETECTION
  // ============================================
  let cachedProducts = [];

  const loadProductsForDuplicateCheck = () => {
    db.collection('products').get()
      .then(snap => { cachedProducts = snap.docs.map(d => ({ id: d.id, ...d.data() })); })
      .catch(() => {});
  };

  // Levenshtein distance
  const levenshtein = (a, b) => {
    a = a.toLowerCase(); b = b.toLowerCase();
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i-1] === b[j-1]
          ? dp[i-1][j-1]
          : Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1]) + 1;
      }
    }
    return dp[m][n];
  };

  const similarity = (a, b) => {
    if (!a || !b) return 0;
    const maxLen = Math.max(a.length, b.length);
    return maxLen === 0 ? 1 : 1 - levenshtein(a, b) / maxLen;
  };

  const nameInput       = document.getElementById('name');
  const duplicateWarn   = document.getElementById('duplicateWarning');
  const priceInput      = document.getElementById('price');
  const categoryInput   = document.getElementById('category');
  const stockInput      = document.getElementById('stock');
  const statusSelect    = document.getElementById('status');
  const form            = document.getElementById('addProductForm');
  const msg             = document.getElementById('formMsg');
  const cancelBtn       = document.getElementById('cancelBtn');

  if (nameInput) {
    nameInput.addEventListener('input', () => {
      const val = nameInput.value.trim();
      if (!duplicateWarn || val.length < 3) { if (duplicateWarn) duplicateWarn.innerHTML = ''; return; }

      const matches = cachedProducts
        .filter(p => similarity(val, p.name) > 0.70)
        .sort((a, b) => similarity(val, b.name) - similarity(val, a.name))
        .slice(0, 3);

      if (matches.length > 0) {
        duplicateWarn.innerHTML = `
          <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:0.75rem;margin-top:0.5rem;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:0.4rem;">
              <i data-lucide="alert-triangle" style="width:14px;height:14px;color:#d97706;"></i>
              <strong style="color:#92400e;font-size:0.85rem;">Similar products already in inventory:</strong>
            </div>
            <ul style="margin:0;padding-left:1.25rem;color:#b45309;font-size:0.83rem;line-height:1.8;">
              ${matches.map(p =>
                `<li><strong>${p.name}</strong> · ${p.category} · ₹${p.price} · Stock: ${p.stock}
                  <span style="color:#64748b;font-size:0.75rem;margin-left:6px;">${Math.round(similarity(val,p.name)*100)}% match</span>
                </li>`
              ).join('')}
            </ul>
          </div>
        `;
        lucide.createIcons();
      } else {
        duplicateWarn.innerHTML = '';
      }
    });
  }

  // ============================================
  // FEATURE #11 — BARCODE SCANNER
  // ============================================
  const barcodeModal  = document.getElementById('barcodeModal');
  const barcodeVideo  = document.getElementById('barcodeVideo');
  const closeBarcodeBtn = document.getElementById('closeBarcodeModal');
  const scanBtn       = document.getElementById('scanBarcodeBtn');
  const scanStatus    = document.getElementById('scanStatus');
  let   activeStream  = null;
  let   scanInterval  = null;

  const stopCamera = () => {
    if (scanInterval) clearInterval(scanInterval);
    if (activeStream) activeStream.getTracks().forEach(t => t.stop());
    scanInterval = null; activeStream = null;
  };

  if (scanBtn) {
    scanBtn.addEventListener('click', async () => {
      if (!('BarcodeDetector' in window)) {
        Toast.show('Barcode scanning requires Google Chrome or Microsoft Edge.', 'warning');
        return;
      }
      barcodeModal.style.display = 'flex';
      if (scanStatus) scanStatus.textContent = 'Starting camera...';

      try {
        activeStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } });
        barcodeVideo.srcObject = activeStream;
        await barcodeVideo.play();

        const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e'] });

        if (scanStatus) scanStatus.textContent = '🔍 Scanning — point camera at barcode...';

        scanInterval = setInterval(async () => {
          try {
            const barcodes = await detector.detect(barcodeVideo);
            if (barcodes.length > 0) {
              const value = barcodes[0].rawValue;
              stopCamera();
              barcodeModal.style.display = 'none';
              if (nameInput) nameInput.value = value;
              nameInput.dispatchEvent(new Event('input')); // trigger duplicate check
              Toast.show(`Barcode detected: ${value}`, 'success');
            }
          } catch (e) { /* frame not ready */ }
        }, 300);

      } catch (err) {
        stopCamera();
        barcodeModal.style.display = 'none';
        Toast.show('Camera error: ' + err.message, 'error');
      }
    });
  }

  if (closeBarcodeBtn) { closeBarcodeBtn.addEventListener('click', () => { stopCamera(); barcodeModal.style.display = 'none'; }); }
  if (barcodeModal)    { barcodeModal.addEventListener('click', e => { if (e.target === barcodeModal) { stopCamera(); barcodeModal.style.display = 'none'; } }); }
  document.getElementById('cancelScanBtn')?.addEventListener('click', () => { stopCamera(); barcodeModal.style.display = 'none'; });

  // ============================================
  // STOCK AUTO-STATUS
  // ============================================
  if (stockInput) {
    stockInput.addEventListener('input', () => {
      const stock = parseInt(stockInput.value);
      if (stock === 0) { statusSelect.value = 'Out of Stock'; }
      else if (statusSelect.value === 'Out of Stock') { statusSelect.value = 'Available'; }
    });
  }

  // ============================================
  // LOGOUT / CANCEL
  // ============================================
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    const ok = await Toast.confirm('Logout?', 'Logout');
    if (ok) firebase.auth().signOut().then(() => window.location.href = 'index.html');
  });
  cancelBtn?.addEventListener('click', () => window.location.href = 'dashboard.html');

  // ============================================
  // FORM SUBMIT
  // ============================================
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name     = nameInput.value.trim();
    const price    = parseFloat(priceInput.value);
    const category = categoryInput.value.trim();
    const stock    = parseInt(stockInput.value);
    let   status   = statusSelect.value;
    if (stock === 0) status = 'Out of Stock';

    if (!name || isNaN(price) || price < 0 || !category || isNaN(stock) || stock < 0) {
      Toast.show('Please fill in all fields correctly.', 'warning');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true; submitBtn.innerText = 'Saving...';

    try {
      await db.collection('products').add({ name, price, category, stock, status });
      const user = firebase.auth().currentUser;
      db.collection('activity_log').add({
        action: 'add_product',
        description: `Added product "${name}"`,
        user: user ? (user.displayName || user.email) : 'Unknown',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(console.error);
      Toast.show(`Product "${name}" added!`, 'success');
      setTimeout(() => window.location.href = 'dashboard.html', 1200);
    } catch (err) {
      Toast.show('Error: ' + err.message, 'error');
      submitBtn.disabled = false; submitBtn.innerText = 'Save Product';
    }
  });

  // ============================================
  // INIT
  // ============================================
  lucide.createIcons();
  loadProductsForDuplicateCheck();
});
