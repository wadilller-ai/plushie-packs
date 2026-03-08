document.body.classList.add('js-enabled');
const stars = document.querySelector('.portalStars');
if (stars) {
  for (let i = 0; i < 80; i++) {
    const dot = document.createElement('span');
    dot.className = 'star';
    dot.style.left = `${Math.random() * 100}%`;
    dot.style.top = `${Math.random() * 100}%`;
    dot.style.animationDelay = `${Math.random() * 6}s`;
    dot.style.opacity = (Math.random() * 0.8 + 0.15).toFixed(2);
    stars.appendChild(dot);
  }
}
const enterCore = document.getElementById('enterCore');
const enterButton = document.getElementById('enterButton');
const authDeck = document.getElementById('authDeck');
const shell = document.getElementById('portalShell');
function revealDeck() {
  if (!authDeck || !shell) return;
  authDeck.classList.add('open');
  authDeck.setAttribute('aria-hidden', 'false');
  shell.classList.add('entered');
}
function cinematicEnter() {
  if (!shell) return;
  shell.classList.add('transitioning');
  window.setTimeout(revealDeck, 220);
}
if (enterCore) enterCore.addEventListener('click', cinematicEnter);
if (enterButton) enterButton.addEventListener('click', cinematicEnter);
