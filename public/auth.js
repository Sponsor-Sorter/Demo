// public/js/auth.js (NEW VERSION)
import { supabase } from './js/supabaseClient.js'

document.addEventListener("DOMContentLoaded", async () => {
  // Get current session from Supabase
  const { data: { session } } = await supabase.auth.getSession()
  const userNameEl = document.getElementById("user-name")
  const navContainer = document.querySelector(".navii nav:last-child") // Second nav (login/signup)

  if (session && session.user) {
    const userEmail = session.user.email

    // Display user's email (or you can fetch extended profile data later)
    if (userNameEl) {
      userNameEl.textContent = userEmail
    }

    // Replace "Login" link with "Logout"
    const loginLink = navContainer.querySelector('a[href="login.html"]')
    if (loginLink) {
      const logoutBtn = document.createElement("a")
      logoutBtn.href = "#"
      logoutBtn.id = "logout-btn"
      logoutBtn.textContent = "Logout"
      logoutBtn.style.cursor = "pointer"
      loginLink.replaceWith(logoutBtn)

      // Logout logic — clears Supabase session
      logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault()
        await supabase.auth.signOut()
        window.location.href = "login.html"
      })
    }

    console.log("✅ Logged in as:", userEmail)
  } else {
    // Not logged in → redirect to login
    window.location.href = "login.html"
  }
})
