// /public/js/sponsorCharts.js
import { supabase } from '/public/js/supabaseClient.js';
import { getActiveUser } from '/public/js/impersonationHelper.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await getActiveUser();
  if (!user || !user.email) {
    console.error("Sponsor not logged in.");
    return;
  }

  // Fetch offers for this sponsor
  const { data: offers, error } = await supabase
    .from('private_offers')
    .select('offer_title, offer_amount, created_at, platforms')
    .eq('sponsor_email', user.email);

  if (error) {
    console.error("Error fetching offers:", error);
    return;
  }
  if (!offers || offers.length === 0) {
    // Optionally show "No Data" on the charts
    return;
  }

  // === 1. Campaign Bar Chart: Total offer_amount per campaign (offer_title) ===
  // Aggregate amounts by offer_title
  const campaignTotals = {};
  offers.forEach(o => {
    if (!o.offer_title) return;
    campaignTotals[o.offer_title] = (campaignTotals[o.offer_title] || 0) + Number(o.offer_amount || 0);
  });
  const campaignLabels = Object.keys(campaignTotals);
  const campaignAmounts = campaignLabels.map(label => campaignTotals[label]);

  const barChart = document.getElementById("campaign-bar-chart");
  if (barChart && campaignLabels.length > 0) {
    new Chart(barChart, {
      type: 'bar',
      data: {
        labels: campaignLabels,
        datasets: [{
          label: 'Offer Amount ($)',
          data: campaignAmounts,
          backgroundColor: '#36a2eb'
        }]
      },
      options: {
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { display: false } }
      }
    });
  }

  // === 2. Spending Line Chart: Offer amount summed per month ===
  const monthlySpend = {};
  offers.forEach(o => {
    const date = o.created_at ? new Date(o.created_at) : null;
    if (!date) return;
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlySpend[month] = (monthlySpend[month] || 0) + Number(o.offer_amount || 0);
  });
  const months = Object.keys(monthlySpend).sort();
  const amounts = months.map(m => monthlySpend[m]);

  const lineChart = document.getElementById("spending-line-chart");
  if (lineChart && months.length > 0) {
    new Chart(lineChart, {
      type: 'line',
      data: {
        labels: months,
        datasets: [{
          label: 'Monthly Spend ($)',
          data: amounts,
          borderColor: '#4caf50',
          backgroundColor: '#c8eccf',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // === 3. Platform Pie Chart: Count of offers per platform ===
  const platformCounts = {};
  offers.forEach(o => {
    if (Array.isArray(o.platforms)) {
      o.platforms.forEach(p => {
        platformCounts[p] = (platformCounts[p] || 0) + 1;
      });
    }
  });
  const platformLabels = Object.keys(platformCounts);
  const platformValues = platformLabels.map(p => platformCounts[p]);
  const pieChart = document.getElementById("platform-pie-chart");
  if (pieChart && platformLabels.length > 0) {
    new Chart(pieChart, {
      type: 'pie',
      data: {
        labels: platformLabels,
        datasets: [{
          data: platformValues,
          backgroundColor: [
            '#ff6384', '#36a2eb', '#ffce56', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4'
          ]
        }]
      },
      options: {
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }
});
