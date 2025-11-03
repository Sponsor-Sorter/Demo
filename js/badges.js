// ./js/badges.js
import { supabase } from './supabaseClient.js'

/**
 * Injects:
 * 1) Supporter crown (from user_badges: supporter level 1/2/3)
 * 2) Offer medals (bronze/silver/gold) + affiliate badge
 * 3) Social OAuth badges on a new line beneath
 */
export async function injectUserBadge(userEmail, selector, emailField = 'sponsor_email') {
  let reviewCompletedCount = 0
  let isAffiliate = false
  let supporterHTML = ''

  // 1) Offer-based badges (bronze/silver/gold) — counts review_completed offers
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

  // 2) Resolve user_id once (used for affiliate + supporter crown)
  let userRow = null
  try {
    const { data, error } = await supabase
      .from('users_extended_data')
      .select('user_id')
      .eq('email', userEmail)
      .maybeSingle()
    if (error) throw error
    userRow = data

    // 2a) Affiliate check
    if (userRow?.user_id) {
      const { data: aff, error: affErr } = await supabase
        .from('affiliate_partners')
        .select('id')
        .eq('user_id', userRow.user_id)
        .limit(1)
        .maybeSingle()
      if (affErr) throw affErr
      if (aff) isAffiliate = true
    }
  } catch (e) {
    console.warn('Could not check affiliate status:', e)
  }

  // 2b) Supporter crown from user_badges (badge_key='supporter', visible=true)
  try {
    if (userRow?.user_id) {
      const { data: badge, error: badgeErr } = await supabase
        .from('user_badges')
        .select('badge_level,label,icon_url,visible')
        .eq('user_id', userRow.user_id)
        .eq('badge_key', 'supporter')
        .eq('visible', true)
        .maybeSingle()
      // PGRST116 = no rows found for single() in some versions; maybeSingle handles this, but just in case:
      if (badgeErr && badgeErr.code !== 'PGRST116') throw badgeErr

      if (badge) {
        const lvl = Number(badge.badge_level) || 1
        const color = (lvl >= 3) ? 'gold' : (lvl === 2 ? 'silver' : 'bronze')
        const label = badge.label || (lvl === 3 ? 'Champion' : (lvl === 2 ? 'Founder' : 'Supporter'))
        const icon = badge.icon_url || `./crown-${color}.png`

        supporterHTML = `
          <span class="badge badge-crown badge-${color}" title="${label}" style="    margin-bottom: 8px; border-left-width: 1px; border-top-width: 1px;
">
            <img src="${icon}" alt="${label} crown"
                 style="height:21px;width:21px;vertical-align:middle;display:inline-block;margin-right:6px;border-radius:4px;margin-bottom: 5px;" />
            
          </span>
        `
      }
    }
  } catch (e) {
    console.warn('Could not load supporter crown:', e)
  }

  // 3) Build medals row (offer badges + affiliate if applicable)
  const levelBadges = []
  if (reviewCompletedCount >= 10)  levelBadges.push('bronze')
  if (reviewCompletedCount >= 25)  levelBadges.push('silver')
  if (reviewCompletedCount >= 50)  levelBadges.push('gold')

  let levelHTML = ''
  if (levelBadges.length || isAffiliate) {
    const medals = levelBadges
      .map(level => {
        const label = level.charAt(0).toUpperCase() + level.slice(1)
        return `<span class="badge badge-${level}" title="${label} Verified"></span>`
      })
      .join(' ')

    const affiliateIcon = isAffiliate
      ? `<img class="badge-affiliate" src="./affiliate.png" alt="Affiliate partner" title="Affiliate partner"
           style="height:24px;width:24px;vertical-align:middle;display:inline-block;margin-left:8px;border-radius:8px">`
      : ''

    const countBadge = reviewCompletedCount
      ? `<span class="badge-count" style="margin-left:5px; font-size:13px; vertical-align:middle;">${reviewCompletedCount}</span>`
      : ''

    levelHTML = medals + countBadge + affiliateIcon
  }

  // 4) Social OAuth badges (still on separate line)
  const SOCIAL_FIELDS = [
    'youtube_connected',
    'twitch_connected',
    'instagram_connected',
    'facebook_connected',
    'tiktok_connected'
    // 'twitter_connected'
  ]
  const SOCIAL_LOGOS = {
    youtube_connected:   { src: './youtubelogo.png',   title: 'YouTube connected' },
    twitch_connected:    { src: './twitchlogo.png',    title: 'Twitch connected' },
    instagram_connected: { src: './instagramlogo.png', title: 'Instagram connected' },
    facebook_connected:  { src: './facebooklogo.png',  title: 'Facebook connected' },
    tiktok_connected:    { src: './tiktoklogo.png',    title: 'TikTok connected' },
    twitter_connected:   { src: './twitterlogo.png',   title: 'Twitter/X connected' }
  }

  let socialHTML = ''
  try {
    const { data: socials, error } = await supabase
      .from('users_extended_data')
      .select(SOCIAL_FIELDS.join(','))
      .eq('email', userEmail)
      .maybeSingle()
    if (error) throw error

    if (socials) {
      const icons = []
      for (const key of SOCIAL_FIELDS) {
        if (socials[key]) {
          const { src, title } = SOCIAL_LOGOS[key] || {}
          if (src) {
            icons.push(
              `<img class="badge-social" src="${src}" alt="${title}" title="${title}"
                style="height:24px;width:24px;vertical-align:middle;display:inline-block;margin-right:8px;border-radius:8px">`
            )
          }
        }
      }
      socialHTML = icons.join('')
    }
  } catch (e) {
    console.warn('Could not load social badges:', e)
  }

  // 5) Inject into DOM
  const badgeSlot = document.querySelector(selector)
  if (badgeSlot) {
    const rows = []
    // supporter crown on its own row at the top (if present)
    if (supporterHTML) {
      rows.push(`<div class="badge-row badge-supporter-row" aria-label="Supporter badge">${supporterHTML}</div>`)
    }
    if (levelHTML) {
      rows.push(`<div class="badge-row badge-tier-row" aria-label="Offer/Affiliate badges">${levelHTML}</div>`)
    }
    if (socialHTML) {
      rows.push(`<div class="badge-row badge-social-row" aria-label="Connected platforms" style="margin-top:6px;">${socialHTML}</div>`)
    }
    badgeSlot.innerHTML = rows.join('')
  }
}
