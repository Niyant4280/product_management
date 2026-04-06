// =============================================
// utils.js — Shared Utilities (included on all pages)
// =============================================

// Log activity to Firestore activity_log collection
window.logActivity = (action, description) => {
  try {
    const user = firebase.auth().currentUser;
    db.collection("activity_log").add({
      action: action,
      description: description,
      user: user ? (user.displayName || user.email) : 'Unknown',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(err => console.warn("Failed to log activity:", err));
  } catch (e) {
    console.warn("logActivity error:", e);
  }
};

// Get human-readable time since a date
window.timeSince = (date) => {
  const seconds = Math.floor((new Date() - date) / 1000);
  const intervals = [
    { label: 'year',   seconds: 31536000 },
    { label: 'month',  seconds: 2592000  },
    { label: 'day',    seconds: 86400    },
    { label: 'hour',   seconds: 3600     },
    { label: 'minute', seconds: 60       },
  ];
  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) return `${count} ${interval.label}${count > 1 ? 's' : ''}`;
  }
  return 'just now';
};

// Get Lucide icon name for activity actions
window.getActionIcon = (action) => {
  const map = {
    'add_product':    'plus-circle',
    'delete_product': 'trash-2',
    'create_quote':   'file-plus',
    'update_quote':   'file-text',
    'add_customer':   'user-plus',
    'delete_customer':'user-x',
    'update_customer':'user-check',
  };
  return map[action] || 'activity';
};
