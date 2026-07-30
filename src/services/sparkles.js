export function spawnSparkles(sourceEl, big = false) {
  const rect = sourceEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const count = big ? 28 : 14;
  const colors = ['#f5d98a','#e8bf5a','#c9982a','#fff8dc','#ffe066','#f0c96a'];
  const shapes = ['●','◆','✦','★','·'];

  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'sparkle-particle';
    p.textContent = shapes[Math.floor(Math.random() * shapes.length)];

    const angle = (Math.PI * 2 * i / count) + (Math.random() - 0.5) * 0.8;
    const dist = big ? 60 + Math.random() * 90 : 30 + Math.random() * 50;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const size = big ? 10 + Math.random() * 10 : 7 + Math.random() * 7;
    const dur = big ? 600 + Math.random() * 500 : 450 + Math.random() * 350;
    const delay = Math.random() * (big ? 120 : 60);

    p.style.cssText = `
      left: ${cx}px;
      top: ${cy}px;
      font-size: ${size}px;
      color: ${colors[Math.floor(Math.random() * colors.length)]};
      --dx: ${dx}px;
      --dy: ${dy}px;
      animation: sparklefly ${dur}ms ease-out ${delay}ms forwards;
    `;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), dur + delay + 50);
  }

  if (big) {
    const shimmer = document.createElement('div');
    shimmer.className = 'win-shimmer';
    document.body.appendChild(shimmer);
    setTimeout(() => shimmer.remove(), 600);
  }
}
