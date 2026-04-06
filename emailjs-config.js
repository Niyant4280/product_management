// =============================================
// emailjs-config.js — EmailJS Configuration
// =============================================
// Template variables your EmailJS template must include:
//   {{to_name}}      — Customer name
//   {{to_email}}     — Customer email  (set as "To Email" in template settings)
//   {{quote_id}}     — Quote reference number
//   {{items}}        — Product list (multi-line text)
//   {{total}}        — Grand total
//   {{created_date}} — Quote creation date
//   {{expires_date}} — Quote expiry date
//   {{company}}      — Company name shown in email
// =============================================

window.EMAILJS_CONFIG = {
  publicKey:   'e2y1X0b2kkSvCj_g7',
  serviceId:   'service_bb6qdpw',
  templateId:  'template_k7tbs3n',
  companyName: 'Product Manager',
};

// Initialize EmailJS
if (typeof emailjs !== 'undefined') {
  emailjs.init(window.EMAILJS_CONFIG.publicKey);
  console.log('[EmailJS] ✅ Initialized with service:', window.EMAILJS_CONFIG.serviceId);
} else {
  console.warn('[EmailJS] Library not loaded yet — ensure the CDN script is above this file.');
}
