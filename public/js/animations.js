// Background Particles
const canvas = document.getElementById('particles-canvas');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Particle {
  constructor() {
    this.reset();
  }
  
  reset() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * 2 + 0.5;
    this.speedX = Math.random() * 1 - 0.5;
    this.speedY = Math.random() * 1 - 0.5;
    const colors = ['#00f5ff', '#ff00aa', '#7c3aed', 'rgba(255,255,255,0.3)'];
    this.color = colors[Math.floor(Math.random() * colors.length)];
  }
  
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    
    if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
      this.reset();
    }
  }
  
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    
    // Slight glow
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
  }
}

for (let i = 0; i < 50; i++) {
  particles.push(new Particle());
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    p.update();
    p.draw();
  });
  ctx.shadowBlur = 0; // reset
  requestAnimationFrame(animateParticles);
}

animateParticles();

// Confetti System for Wins
const confettiCanvas = document.getElementById('confetti-canvas');
const cCtx = confettiCanvas.getContext('2d');
let confettis = [];
let confettiActive = false;

function resizeConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeConfetti);
resizeConfetti();

class Confetti {
  constructor() {
    this.x = Math.random() * confettiCanvas.width;
    this.y = Math.random() * confettiCanvas.height - confettiCanvas.height;
    this.size = Math.random() * 10 + 5;
    this.speedY = Math.random() * 3 + 2;
    this.speedX = Math.random() * 2 - 1;
    this.color = `hsl(${Math.random() * 360}, 100%, 60%)`;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = Math.random() * 10 - 5;
  }
  
  update() {
    this.y += this.speedY;
    this.x += this.speedX;
    this.rotation += this.rotationSpeed;
    if (this.y > confettiCanvas.height) {
      this.y = -10;
      this.x = Math.random() * confettiCanvas.width;
    }
  }
  
  draw() {
    cCtx.save();
    cCtx.translate(this.x, this.y);
    cCtx.rotate(this.rotation * Math.PI / 180);
    cCtx.fillStyle = this.color;
    cCtx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
    cCtx.restore();
  }
}

function triggerConfetti() {
  confettis = [];
  for (let i = 0; i < 150; i++) confettis.push(new Confetti());
  confettiActive = true;
  animateConfetti();
  
  setTimeout(() => {
    confettiActive = false;
    cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }, 4000);
}

function animateConfetti() {
  if (!confettiActive) return;
  cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  confettis.forEach(c => {
    c.update();
    c.draw();
  });
  requestAnimationFrame(animateConfetti);
}

// Toast System
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = message;
  
  // Neon glow based on type
  if (type === 'success') toast.style.borderColor = 'var(--green)';
  if (type === 'error') toast.style.borderColor = 'var(--red)';
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

window.animations = {
  triggerConfetti,
  showToast
};
