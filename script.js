document.getElementById('loginForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const messageEl = document.getElementById('message');

  if (!email || !password) {
    messageEl.textContent = 'Please fill in all fields.';
    messageEl.style.color = 'red';
    return;
  }

  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      messageEl.textContent = 'Login successful!';
      messageEl.style.color = 'green';
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1000);
    })
    .catch((error) => {
      messageEl.textContent = error.message;
      messageEl.style.color = 'red';
    });
});
