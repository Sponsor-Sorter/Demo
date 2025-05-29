import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Initialize Supabase
const supabaseUrl = 'https://mqixtrnhotqqybaghgny.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // shortened for readability
const supabase = createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => {

  // === LOGIN FORM ===
  const loginForm = document.querySelector('.login-form');
  loginForm?.addEventListener('submit', e => {
    e.preventDefault();
    const username = document.querySelector('#username')?.value;
    const password = document.querySelector('#password')?.value;
    if (username && password) loginUser(username, password);
  });

  function loginUser(username, password) {
    if (username === 'johndoe' && password === 'password123') {
      const user = {
        username: 'JohnDoe',
        email: 'johndoe@example.com',
        subscription: 'Premium',
        linkedAccounts: {
          youtube: '@JohnDoeYT',
          twitter: '@JohnDoeTweets',
          spotify: '@JohnDoeMusic',
          instagram: '@john_doe_insta'
        }
      };
      populateUserProfile(user);
    } else {
      alert('Invalid username or password!');
    }
  }

  function populateUserProfile(user) {
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.innerText = text;
    };

    setText('user-name', user.username);
    setText('user-email', user.email);
    setText('subscription-status', user.subscription);
    setText('youtube-handle', user.linkedAccounts.youtube);
    setText('twitter-handle', user.linkedAccounts.twitter);
    setText('spotify-handle', user.linkedAccounts.spotify);
    setText('instagram-handle', user.linkedAccounts.instagram);

    const searchable = document.getElementById("searchable-status");
    if (searchable) {
      searchable.style.display = user.subscription === 'Premium' ? 'block' : 'none';
    }

    const companies = [
      { name: 'Brand 1', logo: 'company-logo1.png' },
      { name: 'Brand 2', logo: 'company-logo2.png' },
      { name: 'Brand 3', logo: 'company-logo3.png' }
    ];

    const container = document.querySelector('.company-profiles ul');
    if (container) {
      container.innerHTML = '';
      companies.forEach(company => {
        const item = document.createElement('li');
        item.innerHTML = `
          <figure>
            <img src="${company.logo}" alt="${company.name} Logo">
            <figcaption>${company.name}</figcaption>
          </figure>`;
        container.appendChild(item);
      });
    }
  }

  // === SIGNUP FORM ===
  const signupForm = document.querySelector('.signup-form');
  signupForm?.addEventListener('submit', e => {
    e.preventDefault();
    const formData = new FormData(signupForm);
    console.log('Form Data Submitted', formData);
    alert('Form submitted successfully!');
  });

  // === FINDER PAGE SEARCH ===
  const searchInput = document.querySelector('#search-input');
  const searchButton = document.querySelector('.search-button');

  if (searchButton && searchInput) {
    searchButton.addEventListener('click', () => {
      const query = searchInput.value.trim();
      if (query) searchForSponsors(query);
    });
  }

  function searchForSponsors(query) {
    console.log('Searching for sponsors with query:', query);
    const results = [
      { name: 'Sponsor 1', description: 'Looking for new partners!' },
      { name: 'Sponsor 2', description: 'Looking for social influencers' },
      { name: 'Sponsor 3', description: 'Expanding into new markets' }
    ];

    const container = document.querySelector('.search-results');
    if (container) {
      container.innerHTML = '';
      results.forEach(result => {
        const li = document.createElement('li');
        li.innerHTML = `
          <figure>
            <img src="logos.png" alt="${result.name}">
            <figcaption>${result.name}: ${result.description}</figcaption>
          </figure>`;
        container.appendChild(li);
      });
    }
  }

  // === HOME PAGE CAROUSEL ===
  const homeCarouselImages = document.querySelectorAll('.logo1.png');
  if (homeCarouselImages.length > 0) {
    let carouselIndex = 0;
    setInterval(() => {
      homeCarouselImages[carouselIndex]?.classList.remove('visible');
      carouselIndex = (carouselIndex + 1) % homeCarouselImages.length;
      homeCarouselImages[carouselIndex]?.classList.add('visible');
    }, 3000);
  }

  // === CHARTS ===
  const pieCtx = document.getElementById('follower-pie-chart')?.getContext('2d');
  const barCtx = document.getElementById('sponsorship-bar-chart')?.getContext('2d');
  const activeListingsCtx = document.getElementById('active-listings-bar-chart')?.getContext('2d');

  if (pieCtx) {
    new Chart(pieCtx, {
      type: 'pie',
      data: {
        labels: ['Instagram', 'TikTok', 'YouTube', 'Twitter', 'Facebook'],
        datasets: [{
          data: [2000, 1500, 1000, 500, 800],
          backgroundColor: ['#ff6384', '#36a2eb', '#ffcd56', '#4caf50', '#ff8c00']
        }]
      },
      options: { responsive: true }
    });
  }

  if (barCtx) {
    new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: ['Offer Sent', 'Offer Accepted', 'Sponsorship Active', 'Completed – Awaiting Payment', 'Ongoing Sponsorship'],
        datasets: [{
          label: 'Deals Count',
          data: [3, 2, 5, 1, 2],
          backgroundColor: '#4caf50'
        }]
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  if (activeListingsCtx) {
    new Chart(activeListingsCtx, {
      type: 'bar',
      data: {
        labels: ['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Stage 5'],
        datasets: [{
          label: 'Active Listings',
          data: [20, 40, 60, 80, 100],
          backgroundColor: '#ff8c00'
        }]
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // === INDEX BUTTON REDIRECT ===
  const indexPageButton = document.getElementById('index-button');
  indexPageButton?.addEventListener('click', () => {
    window.location.href = 'signup.html';
  });

  // === DYNAMIC SOCIAL PLATFORM ADDITION ===
  const addButton = document.querySelector('.add-button');
  addButton?.addEventListener('click', () => {
    const newField = document.createElement('div');
    newField.innerHTML = `
      <label>Social Handles:
        <select>
          <option>Select</option>
          <option>Youtube</option>
          <option>Instagram</option>
          <option>Facebook</option>
          <option>Spotify</option>
          <option>Twitter</option>
          <option>Reddit</option>
        </select>
        <input type="text" name="socialhandles" placeholder="@Handle">
        Content type: <input type="text" name="contenttype" placeholder="e.g., Podcast">
      </label>`;
    document.getElementById('additionalPlatformFields')?.appendChild(newField);
  });

  // === PREFERRED SPONSOR PLATFORM LOGIC ===
  const platformCheckboxes = document.querySelectorAll('.platform-checkbox');
  const dropdownContainer = document.getElementById('preferred-sponsor-platform-container');
  const dropdown = document.getElementById('preferred-sponsor-platform');
  const platformNames = ['Instagram', 'TikTok', 'YouTube', 'Twitter', 'Facebook', 'Twitch', 'Snapchat'];

  function updatePreferredSponsorPlatform() {
    if (!dropdown || !dropdownContainer) return;
    dropdown.innerHTML = '<option value="">Select Sponsor Platform</option>';
    platformCheckboxes.forEach((checkbox, index) => {
      if (checkbox.checked) {
        const option = document.createElement('option');
        option.value = platformNames[index];
        option.textContent = platformNames[index];
        dropdown.appendChild(option);
      }
    });
    dropdownContainer.style.display = dropdown.options.length > 1 ? 'block' : 'none';
  }

  platformCheckboxes.forEach(cb => cb.addEventListener('change', updatePreferredSponsorPlatform));
  updatePreferredSponsorPlatform();

  // === COOKIE BANNER HANDLING ===
  const banner = document.getElementById("cookie-banner");
  const acceptBtn = document.getElementById("accept-cookies");
  const declineBtn = document.getElementById("decline-cookies");

  if (banner && !localStorage.getItem("cookieConsent")) {
    banner.style.display = "flex";
  }

  acceptBtn?.addEventListener('click', () => {
    localStorage.setItem("cookieConsent", "accepted");
    if (banner) banner.style.display = "none";
  });

  declineBtn?.addEventListener('click', () => {
    localStorage.setItem("cookieConsent", "declined");
    if (banner) banner.style.display = "none";
  });

});
