// /public/js/badges.js
import { supabase } from './supabaseClient.js'

/**
 * Injects unlocked offer badges (bronze, silver, gold) and social OAuth badges (platform logos).
 * Social badges are rendered on a NEW LINE beneath the offer badges.
 *
 * Usage: injectUserBadge(userEmail, selector, emailField)
 *  - userEmail: email address of user (sponsor or sponsee)
 *  - selector: querySelector for the badge slot (e.g., "#profile-badge-slot")
 *  - emailField: "sponsor_email" or "sponsee_email" (default is "sponsor_email")
 *  - reinable twitter and and tiktok connected when needed
 */
export async function injectUserBadge(userEmail, selector, emailField = 'sponsor_email') {
  let reviewCompletedCount = 0

  // 1) Offer-based badges (bronze/silver/gold)
  try {
    const { count, error } = await supabase
      .from('private_offers')
      .select('*', { count: 'exact', head: true })
      .eq(emailField, userEmail)
      .eq('status', 'review_completed')

    if (error) throw error
    reviewCompletedCount = count || 0
  } catch (e) {
    console.warn('Could not load offer badge count:', e)
  }

  const levelBadges = []
  if (reviewCompletedCount >= 1)  levelBadges.push('bronze')
  if (reviewCompletedCount >= 5)  levelBadges.push('silver')
  if (reviewCompletedCount >= 10) levelBadges.push('gold')

  let levelHTML = ''
  if (levelBadges.length) {
    levelHTML =
      levelBadges
        .map(level => {
          const label = level.charAt(0).toUpperCase() + level.slice(1)
          return `<span class="badge badge-${level}" title="${label} Verified"></span>`
        })
        .join(' ') +
      `<span class="badge-count" style="margin-left:5px; font-size:13px; vertical-align:middle;">${reviewCompletedCount}</span>`
  }

  // 2) Social OAuth badges (platform logos)
  const SOCIAL_FIELDS = [
    'youtube_connected',
    'twitch_connected',
    'instagram_connected',
    'facebook_connected'
  ]

  const SOCIAL_LOGOS = {
    youtube_connected:   { src: 'youtubelogo.png',   title: 'YouTube connected' },
    twitch_connected:    { src: 'twitchlogo.png',    title: 'Twitch connected' },
    instagram_connected: { src: 'instagramlogo.png', title: 'Instagram connected' },
    facebook_connected:  { src: 'facebooklogo.png',  title: 'Facebook connected' },
    tiktok_connected:    { src: 'tiktoklogo.png',    title: 'TikTok connected' },
    twitter_connected:   { src: 'twitterlogo.png',   title: 'Twitter/X connected' }
  }

  let socialHTML = ''
  try {
    const { data: userRow, error: socialErr } = await supabase
      .from('users_extended_data')
      .select(SOCIAL_FIELDS.join(','))
      .eq('email', userEmail)
      .maybeSingle()

    if (socialErr) throw socialErr

    if (userRow) {
      const icons = []
      for (const key of SOCIAL_FIELDS) {
        if (userRow[key]) {
          const { src, title } = SOCIAL_LOGOS[key] || {}
          if (src) {
            icons.push(
              `<img class="badge-social" src="${src}" alt="${title}" title="${title}" ` +
              `style="height:24px;width:24px;vertical-align:middle;display:inline-block;margin-right:8px;border-radius:8px">`
            )
          }
        }
      }
      socialHTML = icons.join('')
    }
  } catch (e) {
    console.warn('Could not load social OAuth badges:', e)
  }

  // 3) Inject into the slot with SOCIAL BADGES ON THEIR OWN LINE
  const badgeSlot = document.querySelector(selector)
  if (badgeSlot) {
    const rows = []
    if (levelHTML) {
      rows.push(
        `<div class="badge-row badge-tier-row" aria-label="Offer badges">` +
          levelHTML +
        `</div>`
      )
    }
    if (socialHTML) {
      rows.push(
        `<div class="badge-row badge-social-row" aria-label="Connected platforms" style="margin-top:6px;">` +
          socialHTML +
        `</div>`
      )
    }
    badgeSlot.innerHTML = rows.join('')

    // Optional minimal CSS hook (safe if you choose to style in your main stylesheet)
    // .badge-row { display:inline-block; width:100%; }
    // .badge-social-row img { filter: none; opacity: 0.95; }
  }
}
