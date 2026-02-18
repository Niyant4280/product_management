document.addEventListener('DOMContentLoaded', () => {
  const user = firebase.auth().currentUser;
  const displayNameInput = document.getElementById('displayName');
  const emailInput = document.getElementById('email');
  const newPasswordInput = document.getElementById('newPassword');
  const currentPasswordInput = document.getElementById('currentPassword');
  const profileForm = document.getElementById('profileForm');
  const profileMessage = document.getElementById('profileMessage');
  const backBtn = document.getElementById('backBtn');

  // Load user info
  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      displayNameInput.value = user.displayName || '';
      emailInput.value = user.email || '';
    } else {
      window.location.href = 'index.html';
    }
  });

  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = firebase.auth().currentUser;
    if (!user) return;
    const newDisplayName = displayNameInput.value.trim();
    const newPassword = newPasswordInput.value.trim();
    const currentPassword = currentPasswordInput.value.trim();
    profileMessage.textContent = '';
    try {
      if (newDisplayName && newDisplayName !== user.displayName) {
        await user.updateProfile({ displayName: newDisplayName });
      }
      if (newPassword) {
        if (!currentPassword) {
          profileMessage.style.color = '#ef4444';
          profileMessage.textContent = 'Please enter your current password to update your password.';
          return;
        }
        // Re-authenticate
        const credential = firebase.auth.EmailAuthProvider.credential(
          user.email,
          currentPassword
        );
        await user.reauthenticateWithCredential(credential);
        await user.updatePassword(newPassword);
      }
      profileMessage.style.color = '#10b981';
      profileMessage.textContent = 'Profile updated successfully!';
      newPasswordInput.value = '';
      currentPasswordInput.value = '';
    } catch (err) {
      profileMessage.style.color = '#ef4444';
      if (err.code === 'auth/wrong-password') {
        profileMessage.textContent = 'Current password is incorrect.';
      } else {
        profileMessage.textContent = 'Error: ' + err.message;
      }
    }
  });

  backBtn.addEventListener('click', () => {
    window.location.href = 'dashboard.html';
  });
});
