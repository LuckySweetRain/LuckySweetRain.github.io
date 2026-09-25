// Navigation is enhanced progressively; anchors and research details work without JavaScript.
const sections = [...document.querySelectorAll('main > section[id]')];
const navigation = [...document.querySelectorAll('nav a[href^="#"]')];

function updateNavigation() {
  const offset = document.querySelector('.site-header').offsetHeight + 40;
  let current = '';
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= offset) current = section.id;
  }
  for (const link of navigation) {
    if (link.hash === `#${current}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}

let scheduled = false;
window.addEventListener('scroll', () => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    updateNavigation();
    scheduled = false;
  });
}, { passive: true });
window.addEventListener('resize', updateNavigation);
updateNavigation();
