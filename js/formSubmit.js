import { supabase } from './supabaseClient.js';

const SUPABASE_ANON_KEY = '024636ea4f7d172f905c02347888f84e405b115a0255326a0b185bf767d2baf0';
const FAMBOT_SIGNUP_ENDPOINT = 'https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/FamBotSignup';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registrationForm');
  const submitButton = document.getElementById('submitBtn');
  const btnText = submitButton.querySelector('.btn-text');
  const spinner = submitButton.querySelector('.spinner');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const tosCheckbox = document.getElementById('agreeTOS');
    if (!tosCheckbox || !tosCheckbox.checked) {
      alert("You must agree to the Terms of Service to sign up.");
      return;
    }

    submitButton.disabled = true;
    btnText.textContent = 'Signing up...';
    spinner.style.display = 'inline-block';

    try {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      const email = data.email;
      const password = data.password;

      // Run FamBotSignup moderation BEFORE any inserts
      const famBotContent = {
        username: data.username,
        about_yourself: data['about-yourself'],
        title: data.title,
        company_name: data.company_name,
        contenttype: data.contenttype
      };

      const combinedContent = Object.values(famBotContent).filter(Boolean).join(" ");

      const famResponse = await fetch(FAMBOT_SIGNUP_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ user_id: null, content: combinedContent })
      });

      const famResult = await famResponse.json();

      if (famResult.flagged) {
        showFamBotModal(famResult);
        submitButton.disabled = false;
        btnText.textContent = 'Sign Up';
        spinner.style.display = 'none';
        return;
      }

      // Step 1: Sign up user in Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        console.error('Sign-up error:', signUpError);
        alert('Failed to sign up. Try again.');
        return;
      }

      const userId = authData?.user?.id;
      if (!userId) {
        alert('Sign-up successful! Please verify your email before logging in.');
        const basePath = window.location.pathname.includes('/public') ? '/public' : '';
        window.location.href = `${basePath}/login.html`;
        return;
      }

      // Handle extra form fields
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

      console.log('Captured social handles:', data.social_handles);

      // Upload logo if provided
      const logoFile = formData.get('logofile');
      if (logoFile && logoFile.size > 0) {
        const logoUploadResult = await uploadLogo(userId, logoFile);
        if (logoUploadResult.success) {
          data.profile_pic = logoUploadResult.path;
        } else {
          console.error('Logo upload failed:', logoUploadResult.error);
          alert('Logo upload failed, continuing without logo...');
        }
      }

      // Insert into users_extended_data
      const insertData = {
        username: data.username,
        email: data.email,
        title: data.title,
        bday: data.bday,
        company_name: data.company_name,
        location: data.location,
        about_yourself: data['about-yourself'],
        userType: data.userType,
        platforms: data.platforms,
        target_audience: data['target-audience'],
        age_range: data['age-range'],
        preferred_content_format: data['preferred-content-format'],
        partnership_type: data['partnership-type'],
        minfollowers: data.minfollowers,
        payment_method: data['payment-method'],
        paypal_email: data['paypal-email'],
        social_handles: data.social_handles,
        profile_pic: data.profile_pic || null,
        user_id: userId,
        email_verified: false,
        contenttype: data.contenttype,
        agreed_tos: tosCheckbox.checked === true
      };

      const { error: insertError } = await supabase
        .from('users_extended_data')
        .insert([insertData]);

      if (insertError) {
        console.error('Insert error:', insertError);
        alert('Account created, but failed to save extra profile info.');
        return;
      }

      alert('Sign-up successful! Please verify your email before logging in.');
      const basePath = window.location.pathname.includes('/public') ? '/public' : '';
      window.location.href = `${basePath}/login.html`;

    } catch (error) {
      console.error('Unexpected error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      submitButton.disabled = false;
      btnText.textContent = 'Sign Up';
      spinner.style.display = 'none';
    }
  });
});

// Upload Logo Helper
async function uploadLogo(userId, file) {
  const sanitizedFilename = file.name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._-]/g, '');

  const filePath = `${userId}-${sanitizedFilename}`;

  const { error } = await supabase.storage
    .from('logos')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
      metadata: { owner: userId }
    });

  if (error) {
    console.error('Upload error:', error.message);
    return { success: false, error };
  }

  return { success: true, path: filePath };
}

// Preview Logo Locally
window.previewLogo = function () {
  const fileInput = document.getElementById('logofile');
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    document.getElementById('pici').src = e.target.result;
  };
  reader.readAsDataURL(file);
};

// FamBot Modal Renderer
function showFamBotModal(result) {
  const existing = document.getElementById('fambot-modal');
  if (existing) existing.remove();

  const categories = (result.flaggedCategories || []).map(cat => cat.charAt(0).toUpperCase() + cat.slice(1)).join(', ');

  const modal = document.createElement('div');
  modal.id = 'fambot-modal';
  modal.innerHTML = `
    <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.55);z-index:10000;display:flex;align-items:center;justify-content:center;">
      <div style="background:white;padding:2.5rem 2rem 1.5rem 2rem;max-width:430px;border-radius:18px;box-shadow:0 6px 32px 4px rgba(0,0,0,.12);text-align:center;">
        <h2 style="margin-bottom:12px;color:#C41A1A;">Profile Details Unacceptable</h2>
        <p style="color:#222;font-size:1.04em;margin-bottom:1em;">
          ${result.message || 'This content was blocked by moderation. Please try again with different wording.'}
        </p>
        ${categories ? `<div style="color:#b44;margin-bottom:.7em;"><b>Flagged Category:</b> ${categories}</div>` : ''}
        <button id="fambot-close" style="margin-top:8px;background:#0c7a1a;color:#fff;padding:7px 28px;border:none;border-radius:9px;font-weight:600;cursor:pointer;">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('fambot-close').onclick = () => modal.remove();
}
