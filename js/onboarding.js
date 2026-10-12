// File: ./js/onboarding.js

import { supabase } from './supabaseClient.js';
import { startSetupGuide } from './setupGuide.js?v=20261012-setup1';
const setupStyles = document.createElement('link');
setupStyles.rel = 'stylesheet';
setupStyles.href = new URL('../setup-guide.css?v=20261012-setup1', import.meta.url).href;
document.head.append(setupStyles);

const onboardingFlows = {
  '/dashboardsponsee.html': [
    {
      selector: '.profile-header',
      message: 'Start with your creator profile: add a clear photo, a useful description, your content categories and platform handles. Sponsors use these details to decide whether you fit their campaign.',
    },
    {
      selector: '.active-listings',
      message: 'Manage offers here. Review the brief, platforms, payment terms and deadline before accepting. Use the offer comments to upload a private video draft for sponsor approval before publishing.',
    },
    {
      selector: '#offer-tabs',
      message: 'Use these tabs to view your offers by status: active, in progress, live, completed, or archived.',
    },
    {
      selector: '#notification-bell',
      message: 'Track your recent activity, comments, and notifications right here.',
      optional: true,
    },
    {
      selector: '#settings-cog-btn',
      message: 'Access your settings, change your profile info, connect platforms, or restart onboarding at any time.',
    },
    // ✅ FINAL SPONSEE STEP: open OAuth Link modal and encourage linking
    {
      selector: '#oauth-link-modal > div',
      message:
        'Next step: connect your social media via OAuth to confirm your accounts. The “Linked Accounts” window is now open — connect supported platforms to enable available statistics. You can finish this later in Settings; some platforms require additional permissions.',
      sponseeOnly: true,
      openOauthModal: true,
      noOverlay: true,
      placeBubbleNearTarget: true,
      finishOnClick: true // end onboarding here (don’t redirect away)
    }
  ],

  '/dashboardsponsor.html': [
    {
      selector: '.profile-header',
      message: 'Start with your brand profile: add your logo, website and a clear description. Then use Finder to discover creators or publish a public opportunity with a clear brief, budget and deadline.',
    },
    {
      selector: '#offer-tabs',
      message: 'Filter your sponsorship offers by stage and quickly manage ongoing campaigns.',
    },
    {
      selector: '.listing-container, .active-listings',
      message: 'Open an offer to review its brief and progress. In Comments, play private video drafts, approve the latest version or request specific changes. Confirm publication only after checking the agreed content links.',
    },
    {
      selector: '.notification-bell-btn',
      message: 'You’ll get notified about new applicants, comments, and updates here.',
      optional: true,
    },
    {
      selector: '#settings-cog-btn',
      message: 'Adjust your account settings, company profile, or restart onboarding at any time from here.',
    }
  ],

  '/finder.html': [
    {
      selector: '.search-toggle-row',
      message: 'Switch between searching for users or offers using these buttons.',
    },
    {
      selector: '#searchForm',
      message: 'Use these filters to find the perfect creators or brands for your campaign.',
    },
    {
      selector: '#offers-container',
      message: 'Here you’ll see a list of public offers. Apply directly from here if you’re a sponsee!',
      optional: true
    },
    {
      selector: '#offerSearchForm',
      message: 'Use these filters to find brand opportunities that match your content and audience.',
    },
    // --- SPONSOR ONLY ---
    {
      selector: '#create-public-offer-btn',
      message: 'As a sponsor, click here to create a public offer. Your deal will be visible to all creators searching for sponsorships!',
      sponsorOnly: true
    },
    // --- END SPONSOR ONLY ---
    {
      selector: '#otherAccountsProfiles',
      message: 'Browse a few random accounts for inspiration or potential partners.',
    },
    {
      selector: '#recent-offers-list',
      message: 'Check out the most recent public offers added to the platform.',
      optional: true
    },
    {
      selector: '#settings-cog-btn',
      message: 'You can always revisit onboarding or tweak help block settings here.',
      optional: true
    }
  ],

  'default': [
    {
      selector: 'body',
      message: 'Welcome to Sponsor Sorter! Explore the menus or visit your dashboard to get started.',
    }
  ]
};

// ✅ Support /Demo/* paths too
onboardingFlows['/Demo/dashboardsponsee.html'] = onboardingFlows['/dashboardsponsee.html'];
onboardingFlows['/Demo/dashboardsponsor.html'] = onboardingFlows['/dashboardsponsor.html'];
onboardingFlows['/Demo/finder.html'] = onboardingFlows['/finder.html'];

// GLOBALS
let onboardingActive = false;
let currentStepIdx = 0;
let userIsSponsor = false;
let userIsSponsee = false;

// --- UTILITIES ---
function pathEndsWith(file) {
  return window.location.pathname.toLowerCase().endsWith('/' + file.toLowerCase());
}

function getPageFlow() {
  const path = window.location.pathname;

  // exact match first
  if (onboardingFlows[path]) return onboardingFlows[path];

  // fallback: match by filename
  const file = (path.split('/').pop() || '').toLowerCase();
  const matchKey = Object.keys(onboardingFlows).find(
    k => k !== 'default' && (k.split('/').pop() || '').toLowerCase() === file
  );
  if (matchKey) return onboardingFlows[matchKey];

  return onboardingFlows['default'];
}

function isDisplayed(el) {
  if (!el) return false;
  const cs = window.getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function getCurrentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

async function hasCompletedOnboarding() {
  const userId = await getCurrentUserId();
  if (!userId) return true;
  const { data } = await supabase
    .from('users_extended_data')
    .select('onboarded')
    .eq('user_id', userId)
    .single();
  return !!data?.onboarded;
}

async function setOnboardingComplete(val = true) {
  const userId = await getCurrentUserId();
  if (userId) {
    await supabase.from('users_extended_data').update({ onboarded: val }).eq('user_id', userId);
  }
}

// --- PRELOAD ACCOUNT TYPE (robust) ---
async function preloadSponsorStatus() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from('users_extended_data')
    .select('userType')
    .eq('user_id', user.id)
    .single();

  const utRaw = (data?.userType || '').toString().toLowerCase().trim();

  // Robust mapping (your DB sometimes uses UI labels)
  userIsSponsor = utRaw === 'sponsor' || utRaw === 'brand' || utRaw === 'business';
  userIsSponsee =
    utRaw.includes('sponsee') ||
    utRaw.includes('creator') ||
    utRaw.includes('influencer') ||
    utRaw.includes('to be sponsored') ||
    (!userIsSponsor && utRaw !== '');

  // If we are literally on the sponsee dashboard, treat as sponsee anyway
  if (pathEndsWith('dashboardsponsee.html')) userIsSponsee = true;
}

// --- DEMO CARD HELPERS ---
function addOnboardingDemoCard(selector) {
  const listings = document.querySelector(selector);
  if (!listings) return;

  listings.querySelectorAll('.onboarding-demo-offer').forEach(n => n.remove());

  const hasRealCards = [...listings.children].some(
    c => c.classList && c.classList.contains('public-offer-card')
  );

  if (!hasRealCards) {
    const demo = document.createElement('div');
    demo.className = 'onboarding-demo-offer public-offer-card';
    demo.style.background = '#222f4f';
    demo.style.color = '#fff';
    demo.style.margin = '32px auto 12px auto';
    demo.style.maxWidth = '560px';
    demo.style.padding = '22px 28px';
    demo.style.borderRadius = '13px';
    demo.style.textAlign = 'center';
    demo.style.boxShadow = '0 2px 20px #0006';
    demo.innerHTML = `
      <div style="font-size:1.15em;font-weight:600;margin-bottom:7px;">
        <span style="color:#5af;">[ONBOARDING DEMO]</span> <br>
        No sponsorship offers yet? <br>
        When you receive or accept offers, they'll appear here!
      </div>
      <div style="margin:10px 0 2px 0;font-size:.98em;">
        <b>Try browsing public offers or updating your profile to attract sponsors.</b>
      </div>
    `;
    listings.appendChild(demo);
  }
}

function addOnboardingPublicOfferCard() {
  const offersContainer = document.getElementById('offers-container');
  if (!offersContainer) return;

  offersContainer.querySelectorAll('.onboarding-demo-public-offer').forEach(n => n.remove());

  const hasRealCards = [...offersContainer.children].some(
    c => c.classList && c.classList.contains('public-offer-card')
  );

  if (!hasRealCards) {
    const demo = document.createElement('div');
    demo.className = 'onboarding-demo-public-offer public-offer-card';
    demo.style.background = '#263646';
    demo.style.color = '#fff';
    demo.style.margin = '32px auto 12px auto';
    demo.style.maxWidth = '560px';
    demo.style.padding = '22px 28px';
    demo.style.borderRadius = '13px';
    demo.style.textAlign = 'center';
    demo.style.boxShadow = '0 2px 20px #0006';
    demo.innerHTML = `
      <div style="font-size:1.1em;font-weight:600;margin-bottom:7px;">
        <span style="color:#8cf;">[ONBOARDING DEMO]</span> <br>
        This is where open public sponsorship offers will appear.
      </div>
      <div style="margin:10px 0 2px 0;font-size:.98em;">
        <b>Once a sponsor posts an offer, you'll be able to apply right here.</b>
      </div>
    `;
    offersContainer.appendChild(demo);
  }
}

// --- FORCE OPEN OAUTH MODAL (this is the real fix) ---
async function openOauthLinkModalForSure() {
  const modal = document.getElementById('oauth-link-modal');
  if (!modal) return false;

  // Try to trigger the real handler in settings.js (populates account list)
  const oauthBtn = document.getElementById('oauth-link-btn');
  if (oauthBtn) {
    try {
      oauthBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } catch (_) {}
  }

  // Give settings.js a moment to render list
  await sleep(60);

  // FORCE OPEN (handles cases where .modal has display:none !important)
  try {
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('visibility', 'visible', 'important');
    modal.style.setProperty('opacity', '1', 'important');
    modal.style.setProperty('pointer-events', 'auto', 'important');
    // Keep centering consistent even if CSS interferes
    modal.style.setProperty('align-items', 'center');
    modal.style.setProperty('justify-content', 'center');
    // Make sure it sits above normal UI
    modal.style.setProperty('z-index', '9999', 'important');
  } catch (_) {
    // fallback (shouldn’t be needed, but safe)
    modal.style.display = 'flex';
  }

  // Confirm it’s visible
  return isDisplayed(modal);
}

function positionBubbleNearTarget(bubble, el) {
  if (!bubble || !el) return;

  const rect = el.getBoundingClientRect();
  const bw = bubble.offsetWidth || 360;
  const bh = bubble.offsetHeight || 180;
  const pad = 14;

  let left = rect.right + pad;
  if (left + bw > window.innerWidth - 10) left = rect.left - bw - pad;
  if (left < 10) left = Math.max(10, Math.round(window.innerWidth / 2 - bw / 2));

  let top = rect.top + rect.height / 2 - bh / 2;
  if (top < 10) top = 10;
  if (top + bh > window.innerHeight - 10) top = window.innerHeight - bh - 10;

  bubble.style.transform = 'none';
  bubble.style.top = `${Math.round(top)}px`;
  bubble.style.left = `${Math.round(left)}px`;
}

// --- UI HELPERS ---
function showStep(step, totalSteps) {
  // Sponsor-only skip
  if (step.sponsorOnly && !userIsSponsor) {
    nextStep();
    return;
  }

  // Sponsee-only skip (ALSO allow if we are literally on sponsee dashboard)
  const onSponseeDashboard = pathEndsWith('dashboardsponsee.html') || pathEndsWith('Demo/dashboardsponsee.html');
  if (step.sponseeOnly && !(userIsSponsee || onSponseeDashboard)) {
    nextStep();
    return;
  }

  // Inject demo cards if needed
  if (step.selector === '.active-listings' || step.selector === '.listing-container') {
    addOnboardingDemoCard(step.selector);
  }
  if (step.selector === '#offers-container' || step.selector === '#offerSearchForm') {
    addOnboardingPublicOfferCard();

    if (pathEndsWith('finder.html')) {
      const offerSearchToggle = document.getElementById('offer-search-toggle');
      const offerSearchBlock = document.getElementById('offer-search-form-block');
      if (offerSearchToggle && offerSearchBlock && offerSearchBlock.style.display === 'none') {
        offerSearchToggle.click();
      }
    }
  }

  setTimeout(async () => {
    // clear previous
    document.getElementById('onboarding-overlay')?.remove();
    document.querySelectorAll('.onboarding-bubble').forEach(b => b.remove());
    document.querySelectorAll('.onboarding-highlight').forEach(el => el.classList.remove('onboarding-highlight'));

    // ✅ If this step opens OAuth modal, do it FIRST
    if (step.openOauthModal) {
      // Try multiple times in case the page is still wiring up modules
      let opened = false;
      for (let i = 0; i < 10; i++) {
        opened = await openOauthLinkModalForSure();
        if (opened) break;
        await sleep(80);
      }
    }

    let el = document.querySelector(step.selector);

    // Optional steps: if nothing exists, skip
    if (step.optional && (!el || el.offsetHeight < 5)) {
      nextStep();
      return;
    }

    // Overlay (skippable for interactive steps)
    let overlay = null;
    if (!step.noOverlay) {
      overlay = document.createElement('div');
      overlay.id = 'onboarding-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = 0;
      overlay.style.left = 0;
      overlay.style.width = '100vw';
      overlay.style.height = '100vh';
      overlay.style.background = 'rgba(10,16,25,0.28)';
      overlay.style.zIndex = 99998;
      overlay.onclick = e => { if (e.target === overlay) skipOnboarding(); };
      document.body.appendChild(overlay);
    }

    if (el) el.classList.add('onboarding-highlight');

    // Bubble
    const bubble = document.createElement('div');
    bubble.className = 'onboarding-bubble';
    bubble.setAttribute('role', 'dialog');
    bubble.setAttribute('aria-label', 'Getting started with Sponsor Sorter');
    bubble.tabIndex = -1;
    bubble.addEventListener('keydown', event => {
      if (event.key === 'Escape') skipOnboarding();
      if (event.key === 'Tab') {
        const buttons = [...bubble.querySelectorAll('button')];
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
      }
    });

    const isLast = (currentStepIdx + 1 === totalSteps);
    const isSponseeDash = pathEndsWith('dashboardsponsee.html');
    const isSponsorDash = pathEndsWith('dashboardsponsor.html');
    const isFinder = pathEndsWith('finder.html');

    const nextBtnLabel = isLast
      ? ((isSponseeDash || isSponsorDash) ? 'Finish' : 'Finish')
      : 'Next';

    const nextBtnColor = isLast ? '#15cb15' : '#222';

    bubble.innerHTML = `
      <div style="padding:18px 22px;background:#181b2c;color:#fff;border-radius:13px;box-shadow:0 4px 24px #2229;max-width:350px;">
        <div style="font-size:1.07em;margin-bottom:8px;">${step.message}</div>
        <div style="margin-top:12px;text-align:right;">
          <button class="onboarding-btn-skip" style="margin-right:8px;background:#d32f2f;color:#fff;padding:7px 16px;border:none;border-radius:6px;cursor:pointer;">Skip tour</button>
          <button class="onboarding-btn-next" style="background:${nextBtnColor};color:#fff;padding:7px 18px;border:none;border-radius:6px;cursor:pointer;font-weight:600;">
            ${nextBtnLabel}
          </button>
        </div>
        <div style="font-size:0.95em;opacity:0.73;margin-top:5px;">Step ${currentStepIdx + 1} of ${totalSteps}</div>
      </div>
    `;

    bubble.style.position = 'fixed';
    bubble.style.zIndex = 99999;
    bubble.style.transition = 'opacity 0.2s';
    bubble.style.top = '50%';
    bubble.style.left = '50%';
    bubble.style.transform = 'translate(-50%, -50%)';

    if (overlay) overlay.appendChild(bubble);
    else document.body.appendChild(bubble);

    bubble.focus({ preventScroll: true });

    // Don’t auto-scroll when the modal is open
    if (el && !step.openOauthModal) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Place bubble beside the modal content (so it doesn’t cover buttons)
    if (step.placeBubbleNearTarget && el) {
      requestAnimationFrame(() => positionBubbleNearTarget(bubble, el));
    }

    bubble.querySelector('.onboarding-btn-skip').onclick = skipOnboarding;

    // ✅ Next logic
    if (isLast && step.finishOnClick) {
      // Finish onboarding here and keep the OAuth modal open
      bubble.querySelector('.onboarding-btn-next').onclick = async () => {
        onboardingActive = false;
        await setOnboardingComplete(true);

        hideOnboardingOverlay(); // removes bubble/highlights only
      };
    } else if (isLast && (isSponseeDash || isSponsorDash)) {
      // Your original behaviour for dashboard finish
      bubble.querySelector('.onboarding-btn-next').onclick = async () => {
        onboardingActive = false;
        await setOnboardingComplete(true);
        hideOnboardingOverlay();
      };
    } else if (isLast && isFinder) {
      bubble.querySelector('.onboarding-btn-next').onclick = async () => {
        onboardingActive = false;
        await setOnboardingComplete(true);

        hideOnboardingOverlay();
      };
    } else {
      bubble.querySelector('.onboarding-btn-next').onclick = nextStep;
    }
  }, 35);
}

function hideOnboardingOverlay() {
  document.querySelectorAll('.onboarding-highlight').forEach(el => el.classList.remove('onboarding-highlight'));
  document.getElementById('onboarding-overlay')?.remove();
  document.querySelectorAll('.onboarding-bubble').forEach(b => b.remove());
}

function nextStep() {
  hideOnboardingOverlay();
  const flow = getPageFlow();
  currentStepIdx++;
  if (currentStepIdx < flow.length) {
    showStep(flow[currentStepIdx], flow.length);
  } else {
    onboardingActive = false;
    hideOnboardingOverlay();
  }
}

async function skipOnboarding() {
  onboardingActive = false;
  await setOnboardingComplete(true);
  hideOnboardingOverlay();
}

// --- INIT ---
async function startOnboarding(force = false) {
  if (onboardingActive) return;
  await preloadSponsorStatus();
  if (!force && await hasCompletedOnboarding()) return;
  onboardingActive = true;
  currentStepIdx = 0;
  showStep(getPageFlow()[0], getPageFlow().length);
}

window.restartOnboarding = () => {
  startSetupGuide(true).catch(() => alert('Could not load setup. Check your connection and try again.'));
};

// --- Global Styles ---
const style = document.createElement('style');
style.innerHTML = `
.onboarding-highlight {
  outline: 3px solid #0096FF !important;
  box-shadow: 0 0 18px 2px rgba(40,5,180,0.23) !important;
  border-radius: 8px !important;
  position: relative !important;
  z-index: 99998 !important;
}
#onboarding-overlay {
  transition: background 0.18s;
}
.onboarding-bubble {
  pointer-events: auto;
  animation: fadeIn 0.22s;
  z-index: 99999 !important;
  box-sizing: border-box;
  width: min(394px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  margin: 0;
}
.onboarding-bubble > div {
  box-sizing: border-box;
  max-width: none !important;
}
.onboarding-bubble button:focus-visible {
  outline: 3px solid #57dafa;
  outline-offset: 3px;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
`;
document.head.appendChild(style);

function initializeSetupGuide() {
  const url = new URL(window.location.href);
  const shouldOnboard = url.searchParams.get('onboarding');
  startSetupGuide(!!shouldOnboard).catch(error => console.warn('Setup guide could not load:', error.message));
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSetupGuide, {once:true});
} else initializeSetupGuide();

// Tooltip (optional utility)
export function showTooltip(selector, text, ms = 3500) {
  const el = document.querySelector(selector);
  if (!el) return;
  const tooltip = document.createElement('div');
  tooltip.className = 'onboarding-tooltip';
  tooltip.innerText = text;
  tooltip.style.position = 'absolute';
  tooltip.style.background = '#222';
  tooltip.style.color = '#fff';
  tooltip.style.padding = '8px 16px';
  tooltip.style.borderRadius = '8px';
  tooltip.style.zIndex = 99999;
  const rect = el.getBoundingClientRect();
  tooltip.style.top = `${rect.bottom + 8 + window.scrollY}px`;
  tooltip.style.left = `${rect.left + 10}px`;
  document.body.appendChild(tooltip);
  setTimeout(() => tooltip.remove(), ms);
}
