// ./js/formSubmit.js
import { supabase } from './supabaseClient.js';

let refCode = null;

// Capture ?ref=... from URL for referrals
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  refCode = urlParams.get('ref');
});

const SUPABASE_ANON_KEY = '024636ea4f7d172f905c02347888f84e405b115a0255326a0b185bf767d2baf0';
const FAMBOT_SIGNUP_ENDPOINT = 'https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/FamBotSignup';

// Stripe checkout Edge Function + keys
const STRIPE_BACKEND = 'https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/stripe-checkout';
const STRIPE_PK = 'pk_live_51RSqPjGpIACU7TxK4XxMXjNPKpkEvhmfya1DgnxtZEcMeCe8wgzrhT9v6BxqbWXhl7s30nl23DRR9CclIQuvwAQX00zkJcVmOV';
const STRIPE_SUBSCRIPTION_PRICE_ID = 'price_1SbWeEGpIACU7TxK1H3mXQfR';

// Utility: loud error logging
function logError(label, err) {
  console.error(`[Signup][${label}]`, err);
  const msg = err?.message || err || 'Unknown error';
  alert(`[Signup][${label}] ${msg}`);
}

// Utility: ensure Stripe.js present if not already loaded by script tag
async function loadStripeJS() {
  if (window.Stripe) return;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Stripe.js'));
    document.head.appendChild(script);
  });
}

// Utility: build a deterministic-ish temporary ID for logo path before user exists
function getPendingUserId(email) {
  return `${btoa(email)}-${Date.now()}`;
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registrationForm');
  const submitButton = document.getElementById('submitBtn');
  const btnText = submitButton?.querySelector('.btn-text');
  const spinner = submitButton?.querySelector('.spinner');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // TOS guard – must be checked for ANY signup
    const tosCheckbox = document.getElementById('agreeTOS');
    if (!tosCheckbox || !tosCheckbox.checked) {
      alert('You must agree to the Terms of Service to sign up.');
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      if (btnText) btnText.textContent = 'Signing up...';
      if (spinner) spinner.style.display = 'inline-block';
    }

    try {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      const password = data.password;
      const confirm_password = data.confirm_password;

      if (password !== confirm_password) {
        logError('Password', 'Passwords do not match.');
        if (submitButton) {
          submitButton.disabled = false;
          if (btnText) btnText.textContent = 'Sign Up';
          if (spinner) spinner.style.display = 'none';
        }
        return;
      }

      // ===== FamBot moderation before proceeding =====
      let famResult;
      try {
        const famBotContent = {
          username: data.username,
          about_yourself: data['about-yourself'],
          title: data.title,
          company_name: data.company_name,
          contenttype: data.contenttype
        };
        const combinedContent = Object.values(famBotContent)
          .filter(Boolean)
          .join(' ');

        const famResponse = await fetch(FAMBOT_SIGNUP_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            user_id: null,
            content: combinedContent
          })
        });

        famResult = await famResponse.json();

        if (!famResponse.ok) {
          throw new Error(`[FamBot] ${famResult.error || famResponse.statusText}`);
        }

        if (famResult.flagged) {
          showFamBotModal(famResult);
          throw new Error('FamBot blocked this signup.');
        }
      } catch (err) {
        logError('FamBot', err);
        throw err;
      }

      // Platforms and social handles
      data.platforms = formData.getAll('platforms') || [];
      data.social_handles = {
        instagram: formData.get('instagram_handle'),
        tiktok: formData.get('tiktok_handle'),
        youtube: formData.get('youtube_handle'),
        twitter: formData.get('twitter_handle'),
        facebook: formData.get('facebook_handle'),
        twitch: formData.get('twitch_handle'),
        snapchat: formData.get('snapchat_handle')
      };

      // ===== Logo pre-upload to Supabase Storage =====
      let pendingLogoPath = null;
      let pendingLogoToDelete = false;
      const logoFile = formData.get('logofile');

      if (logoFile && logoFile.size > 0 && data.email) {
        try {
          const tempUserId = getPendingUserId(data.email);
          const sanitized = logoFile.name
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9._-]/g, '');
          pendingLogoPath = `${tempUserId}-${sanitized}`;

          const { error: uploadErr } = await supabase.storage
            .from('logos')
            .upload(pendingLogoPath, logoFile, {
              cacheControl: '3600',
              upsert: true,
              contentType: logoFile.type,
              metadata: {
                owner: tempUserId,
                pending: true
              }
            });

          if (uploadErr) throw uploadErr;

          localStorage.setItem('pendingLogoPath', pendingLogoPath);
          pendingLogoToDelete = true;
          data.logo_path = pendingLogoPath;
          data.hasLogo = true;
        } catch (err) {
          logError('LogoUpload', err);
        }
      }

      // ===== Store registration data (password kept on window only) =====
      const registration = {};
      for (const k in data) {
        if (k !== 'password' && k !== 'confirm_password') {
          registration[k] = data[k];
        }
      }

      // Keep passwords in memory for payment-success flow (only in this tab)
      window.__signupPassword = password;
      window.__signupConfirmPassword = confirm_password;

      localStorage.setItem('pendingRegistration', JSON.stringify(registration));

      if (refCode) {
        localStorage.setItem('pendingReferralCode', refCode);
      }

      // Decide if this is a FREE sponsee account that should skip Stripe
      const userType = data.userType;
      const planType = data.planType || 'pro';
      const isFreeSponsee = (userType === 'besponsored' && planType === 'free');

      if (isFreeSponsee) {
        // Skip Stripe — let payment-success-signup.html handle account creation in "free" mode
        window.location.href = './payment-success-signup.html?mode=free';
        return;
      }

      if (window.__signupProcessing) return;
      window.__signupProcessing = true;

      // ===== Start Stripe subscription for signup (paid plans) =====
      let sessionRes, sessionData;
      try {
        // Compute frontendBaseUrl – GitHub Pages vs production
        const frontendBaseUrl = window.location.origin.includes('github.io')
          ? 'https://sponsor-sorter.github.io/Demo'
          : window.location.origin;

        sessionRes = await fetch(STRIPE_BACKEND, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'subscription',
            subscriptionPriceId: STRIPE_SUBSCRIPTION_PRICE_ID,
            offerId: registration.email + '-' + Date.now(),
            offerType: 'signup',
            frontendBaseUrl
          })
        });

        sessionData = await sessionRes.json();
        if (!sessionRes.ok) {
          throw new Error(`[Stripe] ${sessionData.error || sessionRes.statusText}`);
        }
        if (!sessionData.sessionId) {
          throw new Error('[Stripe] No sessionId returned');
        }
      } catch (err) {
        logError('StripeCheckout', err);
        if (pendingLogoToDelete && pendingLogoPath) {
          await supabase.storage.from('logos').remove([pendingLogoPath]);
          localStorage.removeItem('pendingLogoPath');
        }
        throw err;
      }

      // ===== Redirect to Stripe checkout =====
      try {
        await loadStripeJS();
        const stripe = window.Stripe(STRIPE_PK);
        const { error } = await stripe.redirectToCheckout({ sessionId: sessionData.sessionId });
        if (error) throw error;
      } catch (err) {
        logError('StripeRedirect', err);
        if (pendingLogoToDelete && pendingLogoPath) {
          await supabase.storage.from('logos').remove([pendingLogoPath]);
          localStorage.removeItem('pendingLogoPath');
        }
        throw err;
      }
    } catch (error) {
      // Errors already surfaced via logError
    } finally {
      window.__signupProcessing = false;
      if (submitButton) {
        submitButton.disabled = false;
        if (btnText) btnText.textContent = 'Sign Up';
        if (spinner) spinner.style.display = 'none';
      }
    }
  });
});

// Exported helper for other pages (e.g., payment-success) to cleanup unused logos
export async function cleanupPendingLogo() {
  const pendingLogoPath = localStorage.getItem('pendingLogoPath');
  if (pendingLogoPath) {
    await supabase.storage.from('logos').remove([pendingLogoPath]);
    localStorage.removeItem('pendingLogoPath');
  }
}

// Optional preview helper (also defined inline in HTML, kept here if needed)
window.previewLogo = function () {
  const fileInput = document.getElementById('logofile');
  const file = fileInput?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = document.getElementById('pici');
    if (img) img.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

// Referral helper: record a successful referral for new user (called from payment-success flow)
export async function processReferralForNewUser(newUserId) {
  if (!refCode) return; // Only run if referral code present

  // Look up the referrer by referral code
  const { data: refLink, error: linkErr } = await supabase
    .from('referral_links')
    .select('user_id')
    .eq('code', refCode)
    .single();

  if (!refLink || linkErr) return; // Fail silently if not valid

  // Record the referral relationship in referral_rewards
  await supabase
    .from('referral_rewards')
    .insert([{
      referrer_id: refLink.user_id,
      referred_user_id: newUserId,
      reward_type: 'month_free'
    }]);
}

// Show a little banner if user is coming in via referral code
if (refCode) {
  supabase
    .from('referral_links')
    .select('user_id')
    .eq('code', refCode)
    .single()
    .then(({ data }) => {
      if (data?.user_id) {
        supabase
          .from('users_extended_data')
          .select('username')
          .eq('user_id', data.user_id)
          .single()
          .then(({ data: refUser }) => {
            if (refUser?.username) {
              const el = document.getElementById('referral-banner');
              if (el) {
                el.textContent = `You're signing up with a referral from ${refUser.username}! 🎉`;
              }
            }
          });
      }
    });
}

// FamBot modal renderer
function showFamBotModal(result) {
  const existing = document.getElementById('fambot-modal');
  if (existing) existing.remove();

  const categories = (result.flaggedCategories || [])
    .map(cat => cat.charAt(0).toUpperCase() + cat.slice(1))
    .join(', ');

  const modal = document.createElement('div');
  modal.id = 'fambot-modal';
  modal.innerHTML = `
    <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.55);z-index:10000;display:flex;align-items:center;justify-content:center;">
      <div style="background:white;padding:2.5rem 2rem 1.5rem 2rem;max-width:430px;border-radius:18px;box-shadow:0 6px 32px 4px rgba(0,0,0,.12);text-align:center;">
        <h2 style="margin-bottom:12px;color:#C41A1A;">Profile Details Unacceptable</h2>
        <p style="color:#222;font-size:1.04em;margin-bottom:1em;">
          ${result.message || 'This content was blocked by moderation. Please try again with different wording.'}
        </p>
        ${
          categories
            ? `<div style="color:#b44;margin-bottom:.7em;"><b>Flagged Category:</b> ${categories}</div>`
            : ''
        }
        <button id="fambot-close" style="margin-top:8px;background:#0c7a1a;color:#fff;padding:7px 28px;border:none;border-radius:9px;font-weight:600;cursor:pointer;">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('fambot-close').onclick = () => modal.remove();
}

