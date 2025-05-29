import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registrationForm');
  const submitButton = document.getElementById('submitBtn');
  const btnText = submitButton.querySelector('.btn-text');
  const spinner = submitButton.querySelector('.spinner');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Extra: Block if TOS not checked (HTML required, but JS is backup)
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

      // Step 1: Sign up user
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
        console.error('User ID not found after signup.');
        alert('Sign-up successful! Please verify your email before logging in.');
        
        // Redirect to login
        const basePath = window.location.pathname.includes('/public') ? '/public' : '';
        window.location.href = `${basePath}/login.html`;
        
        return;
      }

      // Step 2: Handle extra form fields
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

      // Step 3: Upload logo if provided
      const logoFile = formData.get('logofile');
      if (logoFile && logoFile.size > 0) {
        const logoUploadResult = await uploadLogo(userId, logoFile);
        if (logoUploadResult.success) {
          data.profile_pic = logoUploadResult.path;  // ✅ Save just file path, not URL
        } else {
          console.error('Logo upload failed:', logoUploadResult.error);
          alert('Logo upload failed, continuing without logo...');
        }
      }

      // Step 4: Insert extra user profile data into 'users_extended_data'
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
        // 🔥 Save TOS agreement (ALWAYS TRUE if form passed)
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

      // Step 5: Success - redirect to login
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

// ---------------------------
// 🛠️ Helper Functions Below
// ---------------------------

async function uploadLogo(userId, file) {
  // 🛠️ Sanitize file name (no spaces or weird characters)
  const sanitizedFilename = file.name
    .toLowerCase()
    .replace(/\s+/g, '_')               // Replace spaces with underscores
    .replace(/[^a-z0-9._-]/g, '');      // Remove unsafe characters except . _ -

  const filePath = `${userId}-${sanitizedFilename}`;

  const { error } = await supabase.storage
    .from('logos')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
      metadata: {
        owner: userId
      }
    });

  if (error) {
    console.error('Upload error:', error.message);
    return { success: false, error };
  }

  return { success: true, path: filePath };  // ✅ Just return path
}

// ---------------------------
// 🖼️ Logo Preview Locally
// ---------------------------
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
