// /public/js/homepage.js
import { supabase } from './supabaseClient.js';

/* ========== ACTIVITY TICKER ========== */
function timeAgo(dateString) {
    const now = new Date();
    const then = new Date(dateString);
    const diff = Math.floor((now - then) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}
const staticLines = [
    "Over $500,000 paid out to creators",
    "4.9/5 average user rating ⭐️⭐️⭐️⭐️⭐️",
    "Brands are searching for creators right now!",
    "Sponsor Sorter – No bots. No spam. Just real connections.",
    "100% escrow protection for every campaign",
    "New! Invite friends—both get a free month!",
    "Every offer is reviewed for safety and trust",
    "Our support team is available 24/7 for your success",
    "Join the fastest-growing sponsorship community!",
    "Stripe payments supported for all users.",
    "Sponsor payout: $3,200 sent to user Priya",
    "Ella from London landed a campaign with GreenJuice",
    "Our support team is available 24/7 for your success",
    "Verified: All users pass a multi-step fraud check.",
    "Review spotlight: 'The safest platform for collabs.'",
    "Tom matched with 2 brands in his first week!",
    "Ashley completed a $4,000 sponsorship campaign.",
    "Now trending: Fitness offers in your area",
    "Creator applications up 30% this month!",
    "Sponsor Sorter partners with Stripe for secure payments",
    "Our average match time is under 48 hours",
    "Join 10,000+ creators earning on Sponsor Sorter",
    "New! Invite friends—both get a free month!",
    "Brand offer: Looking for podcasters, $1,500 budget",
    "Ava received a tip for her campaign work",
    "12 public offers posted in the last hour!",
    "Max just left a glowing 5-star review for a sponsor.",
    "Creator testimonial: 'Escrow made me feel safe!'"
];
async function fetchActivityLines() {
    let lines = [];
    let { data: offers } = await supabase
        .from('private_offers')
        .select('offer_title, sponsor_company, offer_amount, platforms, created_at')
        .order('created_at', { ascending: false })
        .limit(6);
    if (offers && offers.length) {
        for (let offer of offers) {
            const amount = offer.offer_amount ? `$${Number(offer.offer_amount).toLocaleString()}` : "";
            const platforms = (offer.platforms && offer.platforms.length) ? `on ${offer.platforms.join(", ")}` : "";
            const title = offer.offer_title || "New Sponsorship Offer";
            lines.push(
                `🔥 ${offer.sponsor_company || "A sponsor"} posted "${title}" ${amount} ${platforms} (${timeAgo(offer.created_at)})`
            );
        }
    }
    let { data: reviews } = await supabase
        .from('private_offer_reviews')
        .select('review_text, rating, reviewer_role, reviewer_id, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
    if (reviews && reviews.length) {
        const ids = Array.from(new Set(reviews.map(r => r.reviewer_id).filter(Boolean)));
        let usernames = {};
        if (ids.length) {
            let { data: userData } = await supabase
                .from('users_extended_data')
                .select('user_id, username')
                .in('user_id', ids);
            if (userData) userData.forEach(u => usernames[u.user_id] = u.username);
        }
        for (let r of reviews) {
            const username = usernames[r.reviewer_id] ? `@${usernames[r.reviewer_id]}` : (r.reviewer_role || "User");
            const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
            let text = r.review_text ? `"${r.review_text.substring(0, 60)}${r.review_text.length > 60 ? "..." : ""}"` : "";
            lines.push(`🌟 ${username} left a ${r.rating}/5 review: ${stars} ${text} (${timeAgo(r.created_at)})`);
        }
    }
    let { data: payouts } = await supabase
        .from('offer_payouts')
        .select('amount, user_id, created_at')
        .order('created_at', { ascending: false })
        .limit(3);
    if (payouts && payouts.length) {
        const ids = Array.from(new Set(payouts.map(p => p.user_id).filter(Boolean)));
        let usernames = {};
        if (ids.length) {
            let { data: userData } = await supabase
                .from('users_extended_data')
                .select('user_id, username')
                .in('user_id', ids);
            if (userData) userData.forEach(u => usernames[u.user_id] = u.username);
        }
        for (let payout of payouts) {
            const username = usernames[payout.user_id] || "A creator";
            lines.push(`💸 Paid out ${"$" + Number(payout.amount).toLocaleString()} to @${username} (${timeAgo(payout.created_at)})`);
        }
    }
    let { data: users } = await supabase
        .from('users_extended_data')
        .select('username, location, created_at')
        .order('created_at', { ascending: false })
        .limit(3);
    if (users && users.length) {
        for (let user of users) {
            if (user.username)
                lines.push(`🎉 ${user.username}${user.location ? " from " + user.location : ""} just joined Sponsor Sorter!`);
        }
    }
    lines = lines.concat(staticLines);
    for (let i = lines.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lines[i], lines[j]] = [lines[j], lines[i]];
    }
    return lines;
}
let tickerLines = [];
let tickerIdx = 0;
async function startTicker() {
    tickerLines = await fetchActivityLines();
    if (!tickerLines.length) tickerLines = staticLines;
    const ticker = document.getElementById('activity-ticker');
    if (!ticker) return;
    ticker.textContent = tickerLines[0];
    setInterval(() => {
        tickerIdx = (tickerIdx + 1) % tickerLines.length;
        ticker.textContent = tickerLines[tickerIdx];
    }, 3200);
}

/* ========== WHO USES CAROUSEL ========== */
const slides = [
    { title: "YouTubers", img: "youtuber.jpeg" },
    { title: "Streamers", img: "streamer.jpeg" },
    { title: "Influencers", img: "socialmediainfluencer.jpeg" },
    { title: "Social Event Organizers", img: "socialevent.jpeg" },
    { title: "Team Sports", img: "teamsports.jpeg" },
    { title: "Content Creators", img: "youtuber1.jpeg" },
    { title: "Startups", img: "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=600&q=80" },
    { title: "Podcasters", img: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80" },
    { title: "Nonprofits", img: "https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=600&q=80" }
];
let currentSlide = 0;
let autoAdvance;
function showSlide(index) {
    const slide = slides[index];
    const title = document.getElementById("carousel-title");
    const img = document.getElementById("carousel-img");
    if (!title || !img) return;
    title.textContent = slide.title;
    img.style.opacity = "0";
    setTimeout(() => {
        img.src = slide.img;
        img.alt = slide.title;
        img.style.opacity = "1";
    }, 260);
}
function goToPrev() { currentSlide = (currentSlide - 1 + slides.length) % slides.length; showSlide(currentSlide); resetAutoAdvance(); }
function goToNext() { currentSlide = (currentSlide + 1) % slides.length; showSlide(currentSlide); resetAutoAdvance(); }
function resetAutoAdvance() { clearInterval(autoAdvance); autoAdvance = setInterval(goToNext, 3800); }

/* ========== TRUSTED LOGOS ========== */
async function loadSponsorLogos() {
    const { data: users, error } = await supabase
        .from('users_extended_data')
        .select('profile_pic, username')
        .limit(30);
    const container = document.getElementById('sponsor-logos');
    if (!container) return;
    if (error || !users || users.length === 0) {
        container.innerHTML = '<p>No sponsors to show yet.</p>';
        return;
    }
    const shuffled = users.sort(() => Math.random() - 0.5);
    const selection = shuffled.slice(0, 6);
    let html = '';
    for (const user of selection) {
        const picUrl = user.profile_pic
            ? `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${user.profile_pic}`
            : 'logos.png';
        html += `
          <figure>
            <img src="${picUrl}" alt="${user.username || 'Sponsor'}">
            <figcaption>@${user.username || 'Sponsor'}</figcaption>
          </figure>
        `;
    }
    container.innerHTML = html;
}

/* ========== TESTIMONIALS CAROUSEL ========== */
async function loadTestimonials() {
    const { data: reviews } = await supabase
        .from('private_offer_reviews')
        .select('review_text, rating, reviewer_role, reviewer_id, created_at')
        .order('created_at', { ascending: false })
        .limit(8);
    const { data: users } = await supabase
        .from('users_extended_data')
        .select('user_id, username, profile_pic');
    const testimonials = [];
    if (reviews && reviews.length) {
        for (let review of reviews) {
            if (!review.review_text) continue;
            let user = users?.find(u => u.user_id === review.reviewer_id);
            let stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
            testimonials.push({
                text: review.review_text,
                stars,
                name: user ? user.username : review.reviewer_role,
                pic: user && user.profile_pic ? `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${user.profile_pic}` : 'logos.png'
            });
        }
    }
    if (!testimonials.length) {
        testimonials.push({
            text: "Sponsor Sorter helped us find our first brand partnership. The escrow system and chat made everything feel safe and professional. I can’t recommend it enough!",
            stars: "★★★★★",
            name: "Emily, Influencer",
            pic: "logos.png"
        });
    }
    return testimonials;
}
let currentTestimonial = 0;
let testimonialsArr = [];
function showTestimonial(idx) {
    const t = testimonialsArr[idx];
    const el = document.getElementById('testimonial-content');
    if (!t || !el) return;
    el.innerHTML = `
      <div class="testimonial" style="text-align:left;max-width:420px;margin:0 auto;transition:all .3s;">
        <div style="display:flex;align-items:center;gap:15px;">
          <img src="${t.pic}" alt="${t.name}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;">
          <span style="font-size:1.2em;color:gold;">${t.stars}</span>
        </div>
        <blockquote style="margin:12px 0 6px 0;min-height:42px;">${t.text}</blockquote>
        <cite style="font-size:0.96em;">— ${t.name}</cite>
      </div>`;
}
async function initTestimonialCarousel() {
    testimonialsArr = await loadTestimonials();
    showTestimonial(currentTestimonial);
    const prev = document.getElementById('testimonial-prev');
    const next = document.getElementById('testimonial-next');
    if (prev) prev.onclick = () => {
        currentTestimonial = (currentTestimonial - 1 + testimonialsArr.length) % testimonialsArr.length;
        showTestimonial(currentTestimonial);
    };
    if (next) next.onclick = () => {
        currentTestimonial = (currentTestimonial + 1) % testimonialsArr.length;
        showTestimonial(currentTestimonial);
    };
    setInterval(() => {
        currentTestimonial = (currentTestimonial + 1) % testimonialsArr.length;
        showTestimonial(currentTestimonial);
    }, 7800);
}

/* ========== CALCULATOR ========== */
function calculateEarnings() {
    var followers = document.getElementById('followers').value;
    var engagement = document.getElementById('engagement').value;
    if (!followers || !engagement) {
        document.getElementById('earningsResult').innerHTML = "<span style='color:red;'>Please enter both values.</span>";
        return;
    }
    var earnings = (followers * engagement * 0.01);
    document.getElementById('earningsResult').innerHTML = "Estimated Earnings: <strong>$" + earnings.toFixed(2) + "</strong>";
}

window.addEventListener('DOMContentLoaded', () => {
    // Activity Ticker
    startTicker();

    // Carousel
    showSlide(currentSlide);
    document.querySelector(".carousel-prev").onclick = goToPrev;
    document.querySelector(".carousel-next").onclick = goToNext;
    autoAdvance = setInterval(goToNext, 3800);

    // Trusted Logos
    loadSponsorLogos();

    // Testimonials
    initTestimonialCarousel();

    // Calculator
    const calcBtn = document.getElementById('calc-earnings-btn');
    if (calcBtn) {
        calcBtn.onclick = calculateEarnings;
    }
});
