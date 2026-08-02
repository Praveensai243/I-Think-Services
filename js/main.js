/* -------------------------------------------------------------------
   I Think Services LLC - Main JavaScript Logic
   ------------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initHeroConsole();
  initScrollReveal();
  initContactForm();
});

/* -------------------------------------------------------------------
   1. Mobile Navigation Toggle
   ------------------------------------------------------------------- */
function initMobileNav() {
  const toggleBtn = document.querySelector('.mobile-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (!toggleBtn || !navLinks) return;

  toggleBtn.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('is-open');
    toggleBtn.setAttribute('aria-expanded', isOpen);
    
    // Toggle hamburger icon animation or text
    const icon = toggleBtn.querySelector('svg');
    if (icon) {
      icon.style.transform = isOpen ? 'rotate(90deg)' : 'none';
    }
  });

  // Close menu when clicking outside or clicking a link
  document.addEventListener('click', (e) => {
    if (!navLinks.contains(e.target) && !toggleBtn.contains(e.target) && navLinks.classList.contains('is-open')) {
      navLinks.classList.remove('is-open');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

/* -------------------------------------------------------------------
   2. Signature Element: Animated Hero Pipeline Console
   ------------------------------------------------------------------- */
function initHeroConsole() {
  const consoleContainer = document.getElementById('hero-pipeline-console');
  if (!consoleContainer) return;

  // Check for prefers-reduced-motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const progressFill = consoleContainer.querySelector('.console-progress-fill');
  const progressText = consoleContainer.querySelector('.console-progress-percent');
  const taskCards = consoleContainer.querySelectorAll('.task-item-card');

  if (!taskCards.length) return;

  const totalTasks = taskCards.length;
  let currentIndex = 0;
  let isResetting = false;

  if (prefersReducedMotion) {
    // Static state for reduced motion
    taskCards.forEach(card => setCardAutomated(card));
    if (progressFill) progressFill.style.width = '100%';
    if (progressText) progressText.textContent = '100% AUTOMATED';
    return;
  }

  function stepAutomation() {
    if (isResetting) return;

    if (currentIndex < totalTasks) {
      // Flip current card to automated
      setCardAutomated(taskCards[currentIndex]);
      currentIndex++;

      const percent = Math.round((currentIndex / totalTasks) * 100);
      if (progressFill) progressFill.style.width = `${percent}%`;
      if (progressText) progressText.textContent = `${percent}% AUTOMATED`;

      // Next step after delay
      setTimeout(stepAutomation, 2200);
    } else {
      // Reached 100%, hold briefly then reset
      isResetting = true;
      if (progressText) progressText.textContent = '100% AUTOMATED — 0% MANUAL WORK';

      setTimeout(() => {
        // Reset all cards to manual
        taskCards.forEach(card => setCardManual(card));
        currentIndex = 0;
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = 'MONITORING PIPELINE...';
        
        setTimeout(() => {
          isResetting = false;
          stepAutomation();
        }, 1500);
      }, 4000);
    }
  }

  // Start sequence
  setTimeout(stepAutomation, 1000);
}

function setCardAutomated(card) {
  card.classList.remove('state-manual');
  card.classList.add('state-automated');

  const iconBox = card.querySelector('.task-icon-box');
  const badge = card.querySelector('.task-badge');

  if (iconBox) iconBox.innerHTML = '✓';
  if (badge) {
    const autoTime = card.getAttribute('data-auto-time') || '< 1s';
    badge.textContent = `AI Agent: ${autoTime}`;
  }
}

function setCardManual(card) {
  card.classList.remove('state-automated');
  card.classList.add('state-manual');

  const iconBox = card.querySelector('.task-icon-box');
  const badge = card.querySelector('.task-badge');

  if (iconBox) iconBox.innerHTML = '⚡';
  if (badge) {
    const manualTime = card.getAttribute('data-manual-time') || 'Manual';
    badge.textContent = `Manual: ${manualTime}`;
  }
}

/* -------------------------------------------------------------------
   3. Scroll Reveal Animations (Intersection Observer)
   ------------------------------------------------------------------- */
function initScrollReveal() {
  const revealElements = document.querySelectorAll('.reveal-on-scroll');

  if (!revealElements.length) return;

  const observerOptions = {
    threshold: 0.12,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target); // Animate once
      }
    });
  }, observerOptions);

  revealElements.forEach(el => observer.observe(el));
}

/* -------------------------------------------------------------------
   4. Contact Form Handler (Web3Forms AJAX)
   ------------------------------------------------------------------- */
function initContactForm() {
  const contactForm = document.getElementById('contact-form');
  const formStatus = document.getElementById('form-status');

  if (!contactForm) return;

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Send Message';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Sending Request...';
    }

    if (formStatus) {
      formStatus.style.display = 'block';
      formStatus.className = 'mono-tag';
      formStatus.textContent = 'Transmitting inquiry to I Think Services team...';
    }

    const formData = new FormData(contactForm);

    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        if (formStatus) {
          formStatus.style.color = 'var(--accent-teal)';
          formStatus.textContent = 'Thank you! Your message has been received. Our AI & IT team will respond shortly.';
        }
        contactForm.reset();
      } else {
        throw new Error(data.message || 'Form submission failed');
      }
    } catch (error) {
      if (formStatus) {
        formStatus.style.color = 'var(--accent-amber)';
        formStatus.textContent = 'Notice: Direct submission pending. Please reach us at contact@ithinkservices.com.';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    }
  });
}
