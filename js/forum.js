// /public/js/forum.js

import { supabase } from '/public/js/supabaseClient.js';

let forumThreads = [];
let filteredThreads = [];
let userProfile = null;
let userIsAdmin = false;
let sessionUser = null;
let myVotes = {}; // { post_id: 1 | -1 }
let profilesCache = {};

let forumPage = 1;
let forumPerPage = 10;

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  sessionUser = session?.user || null;
  await hydrateProfile();
  await fetchMyVotes();
  await fetchThreads();

  document.getElementById('forum-add-btn').style.display = sessionUser ? '' : 'none';
  document.getElementById('forum-search').addEventListener('input', () => { forumPage = 1; filterThreads(); });
  document.getElementById('forum-category').addEventListener('change', () => { forumPage = 1; filterThreads(); });

  document.querySelectorAll('.forum-tab').forEach(tab =>
    tab.addEventListener('click', () => {
      document.querySelectorAll('.forum-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('forum-category').value = tab.dataset.category;
      forumPage = 1;
      filterThreads();
    })
  );
  document.getElementById('forum-add-btn').addEventListener('click', () => openThreadModal());
  hydrateNav(sessionUser);

  // Pagination: per-page selector
  const perPageSel = document.getElementById('forum-per-page');
  if (perPageSel) {
    perPageSel.value = forumPerPage;
    perPageSel.addEventListener('change', () => {
      forumPerPage = parseInt(perPageSel.value, 10) || 10;
      forumPage = 1;
      renderThreads(filteredThreads);
    });
  }
});

// -------- Profile & Auth --------
async function hydrateProfile() {
  if (!sessionUser) return;
  const { data } = await supabase
    .from('users_extended_data')
    .select('user_id, username, profile_pic, is_admin')
    .eq('user_id', sessionUser.id)
    .maybeSingle();
  if (data) {
    userProfile = data;
    userIsAdmin = !!data.is_admin;
  }
}

function hydrateNav(user) {
  const authLink = document.getElementById('auth-link');
  if (!authLink) return;
  if (user) {
    let dashboardUrl = "dashboardsponsee.html";
    supabase.from('users_extended_data').select('userType').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (data && data.userType === "sponsor") dashboardUrl = "dashboardsponsor.html";
      if (data && data.userType === "admin") dashboardUrl = "admindashboard.html";
      authLink.innerHTML = `<a href="${dashboardUrl}">Dashboard</a>`;
    });
  } else {
    authLink.innerHTML = `<a href="signup.html">Signup</a>`;
  }
}

// -------- Threads (fetch, render, and author join) --------
async function fetchVoteCountsForPosts(posts) {
  if (!posts.length) return {};
  const ids = posts.map(p => p.id);
  const { data } = await supabase
    .from('forum_post_votes')
    .select('post_id, vote')
    .in('post_id', ids);
  let votesMap = {};
  ids.forEach(id => votesMap[id] = { up: 0, down: 0 });
  (data || []).forEach(v => {
    if (votesMap[v.post_id]) {
      if (v.vote === 1) votesMap[v.post_id].up++;
      if (v.vote === -1) votesMap[v.post_id].down++;
    }
  });
  return votesMap;
}

async function fetchThreads() {
  const { data } = await supabase
    .from('forum_posts')
    .select('*')
    .order('created_at', { ascending: false });
  forumThreads = Array.isArray(data) ? data : [];
  const authorIds = [...new Set(forumThreads.map(p => p.author_id).filter(Boolean))];
  let profiles = {};
  if (authorIds.length) {
    const { data: profileData } = await supabase
      .from('users_extended_data')
      .select('user_id, username, profile_pic')
      .in('user_id', authorIds);
    profileData?.forEach(p => { profiles[p.user_id] = p; });
  }
  profilesCache = profiles;
  await fetchCommentCounts();

  // --- Fetch all vote counts for current threads ---
  const votesMap = await fetchVoteCountsForPosts(forumThreads);

  forumThreads = forumThreads.map(post => ({
    ...post,
    upvotes: votesMap[post.id]?.up || 0,
    downvotes: votesMap[post.id]?.down || 0,
    author: profiles[post.author_id] || {}
  }));
  filterThreads();
}

function renderThreads(threads) {
  // Pagination logic
  const total = threads.length;
  const perPage = forumPerPage || 10;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  forumPage = Math.min(Math.max(1, forumPage), totalPages);

  // Slice current page
  const startIdx = (forumPage - 1) * perPage;
  const endIdx = startIdx + perPage;
  const pageThreads = threads.slice(startIdx, endIdx);

  // Render controls
  renderPaginationControls(forumPage, totalPages);

  // List
  const container = document.getElementById('forum-list');
  if (!container) return;
  if (!pageThreads.length) {
    container.innerHTML = `<div class="forum-loading">No threads yet. Be the first to start the conversation!</div>`;
    return;
  }
  container.innerHTML = pageThreads.map(post => {
    let authorImg = post.author?.profile_pic
      ? `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${post.author.profile_pic}`
      : '/public/logos.png';
    let authorName = post.author?.username || "Anonymous";
    let voteCount = (post.upvotes || 0) - (post.downvotes || 0);
    let myVote = myVotes[post.id] || 0;
    let catClass = post.category || "qna";
    let catName = {
      qna: "Q&A", diary: "Deal Diary", feature: "Feature", help: "Help"
    }[post.category] || "General";
    let tagsHtml = (post.tags || []).map(t => `<span class="forum-tag">${escapeHtml(t)}</span>`).join('');
    let canEdit = userIsAdmin || (sessionUser && post.author_id === sessionUser.id);

    let isTruncated = post.content && post.content.length > 160;
    let shortPreview = isTruncated ? truncate(stripMd(post.content), 160) : stripMd(post.content);
    let fullContent = escapeHtml(stripMd(post.content || ''));
    let previewHtml = `
      <div class="forum-content-preview" data-id="${post.id}">
        <span class="preview-text">${escapeHtml(shortPreview)}</span>
        ${isTruncated ? `<span class="expand-arrow" data-id="${post.id}" style="cursor:pointer;color:#f6c62e;">... <span style="display:inline-block;transform:rotate(0deg);" class="arrow-icon">▶</span></span>` : ''}
        <span class="full-content" style="display:none;">${fullContent} <span class="collapse-arrow" data-id="${post.id}" style="cursor:pointer;color:#f6c62e;"><span style="display:inline-block;transform:rotate(90deg);" class="arrow-icon">▼</span> Show less</span></span>
      </div>
    `;

    return `
      <div class="forum-card" style="margin-bottom:28px;">
        <div class="forum-meta">
          <span class="forum-card-category ${catClass}">${catName}</span>
          <img src="${authorImg}" style="width:55px;height:55px;" class="forum-author-img" title="${escapeHtml(authorName)}"
            onerror="this.src='/public/logos.png'">
          <span>${escapeHtml(authorName)}</span>
          <span>🗓️ ${formatDate(post.created_at)}</span>
        </div>
        <div class="forum-title" style="font-size:1.22em;font-weight:700;color:#ffc533;margin:3px 0 8px 0;">
          ${escapeHtml(post.title)}
        </div>
        ${previewHtml}
        <div class="forum-tags" style="margin-top:7px;margin-bottom:5px;">${tagsHtml}</div>
        <div class="forum-card-footer" style="margin-top:11px;">
          <div class="forum-card-votes">
            <button class="forum-vote-btn upvote${myVote === 1 ? ' active' : ''}" data-id="${post.id}">▲</button>
            <span>${voteCount}</span>
            <button class="forum-vote-btn downvote${myVote === -1 ? ' active' : ''}" data-id="${post.id}">▼</button>
          </div>
          <span class="forum-card-comments" data-id="${post.id}" style="margin-left:14px;">
            💬 <span id="comments-count-${post.id}">${post.comments_count || 0}</span> <span style="margin-left:2px;">replies</span>
          </span>
          <button class="forum-view-btn" data-id="${post.id}" style="margin-left:14px;">View</button>
          ${canEdit ? `<span style="margin-left:11px;">
            <button class="forum-edit-btn" data-id="${post.id}">Edit</button>
            <button class="forum-delete-btn" data-id="${post.id}">Delete</button>
          </span>` : ""}
        </div>
      </div>
    `;
  }).join('');

  // Expand/collapse preview
  document.querySelectorAll('.expand-arrow').forEach(btn => {
    btn.onclick = function() {
      const id = btn.getAttribute('data-id');
      const card = document.querySelector(`.forum-content-preview[data-id="${id}"]`);
      card.querySelector('.preview-text').style.display = 'none';
      btn.style.display = 'none';
      card.querySelector('.full-content').style.display = '';
    };
  });
  document.querySelectorAll('.collapse-arrow').forEach(btn => {
    btn.onclick = function() {
      const id = btn.getAttribute('data-id');
      const card = document.querySelector(`.forum-content-preview[data-id="${id}"]`);
      card.querySelector('.preview-text').style.display = '';
      card.querySelector('.expand-arrow').style.display = '';
      card.querySelector('.full-content').style.display = 'none';
    };
  });

  // Voting
  document.querySelectorAll('.forum-vote-btn.upvote').forEach(btn =>
    btn.onclick = () => voteThread(btn.getAttribute('data-id'), 1)
  );
  document.querySelectorAll('.forum-vote-btn.downvote').forEach(btn =>
    btn.onclick = () => voteThread(btn.getAttribute('data-id'), -1)
  );
  document.querySelectorAll('.forum-card-comments').forEach(btn =>
    btn.onclick = () => openCommentsModal(btn.getAttribute('data-id'))
  );
  document.querySelectorAll('.forum-view-btn').forEach(btn =>
    btn.onclick = () => openFullThreadModal(btn.getAttribute('data-id'))
  );
  document.querySelectorAll('.forum-edit-btn').forEach(btn =>
    btn.onclick = () => openThreadModal(btn.getAttribute('data-id'))
  );
  document.querySelectorAll('.forum-delete-btn').forEach(btn =>
    btn.onclick = () => deleteThread(btn.getAttribute('data-id'))
  );
}

function renderPaginationControls(current, totalPages) {
  const controls = document.getElementById('forum-pagination-controls');
  if (!controls) return;
  if (totalPages <= 1) { controls.innerHTML = ""; return; }
  controls.innerHTML = `
    <button ${current === 1 ? 'disabled' : ''} id="forum-page-first">«</button>
    <button ${current === 1 ? 'disabled' : ''} id="forum-page-prev">‹</button>
    <span style="margin:0 8px;color:#ffc533;font-weight:500;">Page ${current} of ${totalPages}</span>
    <button ${current === totalPages ? 'disabled' : ''} id="forum-page-next">›</button>
    <button ${current === totalPages ? 'disabled' : ''} id="forum-page-last">»</button>
  `;
  document.getElementById('forum-page-first').onclick = () => { forumPage = 1; renderThreads(filteredThreads); };
  document.getElementById('forum-page-prev').onclick = () => { if (forumPage > 1) { forumPage--; renderThreads(filteredThreads); } };
  document.getElementById('forum-page-next').onclick = () => { if (forumPage < totalPages) { forumPage++; renderThreads(filteredThreads); } };
  document.getElementById('forum-page-last').onclick = () => { forumPage = totalPages; renderThreads(filteredThreads); };
}

// --------- Voting ---------
async function fetchMyVotes() {
  if (!sessionUser) return;
  const { data } = await supabase
    .from('forum_post_votes')
    .select('post_id, vote')
    .eq('voter_id', sessionUser.id);
  myVotes = {};
  if (data) data.forEach(v => { myVotes[v.post_id] = v.vote; });
}

async function voteThread(post_id, direction) {
  if (!sessionUser) return alert("You must be logged in to vote.");
  if (!myVotes[post_id]) {
    await supabase.from('forum_post_votes').insert([{ post_id, voter_id: sessionUser.id, vote: direction }]);
  } else if (myVotes[post_id] !== direction) {
    await supabase.from('forum_post_votes').update({ vote: direction }).eq('post_id', post_id).eq('voter_id', sessionUser.id);
  } else {
    await supabase.from('forum_post_votes').delete().eq('post_id', post_id).eq('voter_id', sessionUser.id);
  }
  await fetchMyVotes();
  await fetchThreads(); // will fetch and count all votes for all posts, real-time
}

// --------- Filtering ---------
function filterThreads() {
  const searchVal = (document.getElementById('forum-search').value || '').toLowerCase();
  const catVal = (document.getElementById('forum-category').value || '').toLowerCase();
  filteredThreads = forumThreads.filter(post => {
    const inCat = !catVal || (post.category && post.category.toLowerCase() === catVal);
    const inSearch = !searchVal ||
      (post.title && post.title.toLowerCase().includes(searchVal)) ||
      (post.content && post.content.toLowerCase().includes(searchVal)) ||
      (post.author?.username && post.author.username.toLowerCase().includes(searchVal)) ||
      (Array.isArray(post.tags) && post.tags.join(' ').toLowerCase().includes(searchVal));
    return inCat && inSearch;
  });
  forumPage = 1;
  renderThreads(filteredThreads);
}

// --------- Thread Creation / Edit Modal ---------
async function openThreadModal(editId = null) {
  const root = document.getElementById('forum-modal-root');
  let editing = !!editId;
  let data = {
    title: '', content: '', tags: '', category: 'qna'
  };
  if (editing) {
    const { data: post } = await supabase.from('forum_posts').select('*').eq('id', editId).maybeSingle();
    if (post) data = post;
  }
  root.classList.add('active');
  root.innerHTML = `
    <div class="forum-modal-backdrop" onclick="document.getElementById('forum-modal-root').classList.remove('active');document.getElementById('forum-modal-root').innerHTML=''"></div>
    <div class="forum-modal">
      <h2>${editing ? 'Edit Thread' : 'New Thread'}</h2>
      <form id="forum-edit-form">
        <label>Title</label>
        <input name="title" value="${escapeHtml(data.title)}" required maxlength="140"/>
        <label>Content</label>
        <textarea name="content" required>${escapeHtml(data.content || '')}</textarea>
        <label>Tags (comma separated)</label>
        <input name="tags" value="${(Array.isArray(data.tags) ? data.tags.join(', ') : '')}" />
        <label>Category</label>
        <select name="category">
          <option value="qna" ${data.category==="qna"?"selected":""}>Q&A</option>
          <option value="diary" ${data.category==="diary"?"selected":""}>Deal Diary</option>
          <option value="feature" ${data.category==="feature"?"selected":""}>Feature Voting</option>
          <option value="help" ${data.category==="help"?"selected":""}>Peer Help</option>
        </select>
        <div class="forum-modal-btns">
          <button type="button" class="forum-modal-cancel" onclick="document.getElementById('forum-modal-root').classList.remove('active');document.getElementById('forum-modal-root').innerHTML=''">Cancel</button>
          <button type="submit" class="forum-modal-save">${editing ? 'Save' : 'Publish'}</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('forum-edit-form').onsubmit = async function(e) {
    e.preventDefault();
    const form = e.target;
    const values = {
      title: form.title.value.trim(),
      content: form.content.value.trim(),
      tags: form.tags.value.split(',').map(x=>x.trim()).filter(Boolean),
      category: form.category.value,
      author_id: sessionUser.id
    };
    if (editing) {
      await supabase.from('forum_posts').update(values).eq('id', editId);
    } else {
      await supabase.from('forum_posts').insert([values]);
    }
    document.getElementById('forum-modal-root').classList.remove('active');
    document.getElementById('forum-modal-root').innerHTML = '';
    await fetchThreads();
  };
}

// --------- View Thread Modal -------------
async function openFullThreadModal(threadId) {
  const post = forumThreads.find(p => p.id === threadId);
  if (!post) return;
  const { data: comments } = await supabase
    .from('forum_comments')
    .select('*')
    .eq('post_id', threadId)
    .order('created_at', { ascending: true });
  const authorIds = [...new Set(comments.map(c => c.author_id).filter(Boolean))];
  let profiles = {};
  if (authorIds.length) {
    const { data: profileData } = await supabase
      .from('users_extended_data')
      .select('user_id, username, profile_pic')
      .in('user_id', authorIds);
    profileData?.forEach(p => { profiles[p.user_id] = p; });
  }
  const modal = document.createElement('div');
  modal.className = 'forum-modal-root active';
  modal.style.position = 'fixed';
  modal.style.left = 0; modal.style.top = 0;
  modal.style.width = '100vw'; modal.style.height = '100vh';
  modal.style.zIndex = 9999;
  modal.innerHTML = `
    <div class="forum-modal-backdrop" style="position:absolute;top:0;left:0;width:100vw;height:100vh;background:#000a;" onclick="this.parentNode.remove()"></div>
    <div class="forum-modal" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#23232b;padding:32px 20px 20px 20px;border-radius:13px;max-width:520px;width:97vw;box-shadow:0 0 22px #0008;overflow-y:auto;max-height:94vh;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:3px;">
        <img src="${post.author?.profile_pic
          ? `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${post.author.profile_pic}`
          : '/public/logos.png'}" style="width:45px;height:45px;border-radius:50%;background:#292941;">
        <span style="color:#fff;font-weight:600;font-size:1.1em;">${escapeHtml(post.author?.username || "Anonymous")}</span>
        <span style="color:#aaa;font-size:0.98em;margin-left:auto;">${formatDate(post.created_at)}</span>
      </div>
      <h2 style="color:#f6c62e;margin:10px 0 8px 0;">${escapeHtml(post.title)}</h2>
      <div style="color:#f8f8ff;font-size:1.09em;margin-bottom:13px;white-space:pre-line;">${escapeHtml(post.content)}</div>
      <div style="margin-bottom:10px;">${(post.tags||[]).map(t=>`<span class="forum-tag">${escapeHtml(t)}</span>`).join(' ')}</div>
      <hr style="border:0;border-top:1.5px solid #343450;margin:8px 0 14px 0;">
      <div id="modal-thread-comments">
        <b style="color:#36a2eb;">Replies</b><br>
        ${comments && comments.length ? comments.map(c=>{
          let author = profiles[c.author_id] || {};
          let authorImg = author.profile_pic
            ? `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${author.profile_pic}`
            : '/public/logos.png';
          let authorName = author.username || "Anonymous";
          return `
            <div style="display:flex;align-items:center;margin:13px 0 3px 0;">
              <img src="${authorImg}" style="width:30px;height:30px;border-radius:50%;background:#292941;margin-right:7px;">
              <span style="color:#f6c62e;font-weight:600;">${escapeHtml(authorName)}</span>
              <span style="color:#aaa;font-size:0.94em;margin-left:9px;">${formatDate(c.created_at)}</span>
            </div>
            <div style="color:#f8f8ff;margin:4px 0 13px 37px;">${escapeHtml(c.content)}</div>
          `;
        }).join('') : `<span style="color:#bbb;">No replies yet.</span>`}
      </div>
      <button style="margin-top:10px;background:#f6c62e;color:#222;border:none;border-radius:7px;padding:7px 18px;font-weight:700;cursor:pointer;" onclick="this.closest('.forum-modal-root').remove()">Close</button>
    </div>
  `;
  document.body.appendChild(modal);
}

// --------- Thread Deletion ---------
async function deleteThread(id) {
  if (!confirm('Are you sure you want to delete this thread? This cannot be undone.')) return;
  await supabase.from('forum_posts').delete().eq('id', id);
  await fetchThreads();
}

// --------- Comments/Replies ---------
async function openCommentsModal(postId) {
  const root = document.getElementById('forum-comments-modal-root');
  root.classList.add('active');
  root.innerHTML = `<div class="forum-modal-backdrop" onclick="closeCommentsModal()"></div>
    <div class="forum-comments-modal">
      <div id="forum-comments-inner"></div>
      <form id="forum-comment-form" style="margin-top:10px;">
        <label>Reply</label>
        <textarea name="content" required maxlength="700"></textarea>
        <div class="forum-comments-modal-btns">
          <button type="button" class="forum-comments-modal-cancel" onclick="closeCommentsModal()">Cancel</button>
          <button type="submit" class="forum-comments-modal-save">Post</button>
        </div>
      </form>
    </div>
  `;
  await renderComments(postId);
  document.getElementById('forum-comment-form').onsubmit = async function(e) {
    e.preventDefault();
    const content = e.target.content.value.trim();
    if (!content) return;
    await supabase.from('forum_comments').insert([{
      post_id: postId, author_id: sessionUser?.id, content
    }]);
    e.target.content.value = '';
    await renderComments(postId);
    await updateCommentCount(postId);
    await fetchThreads();
  };
}
window.closeCommentsModal = function() {
  const root = document.getElementById('forum-comments-modal-root');
  root.classList.remove('active');
  root.innerHTML = '';
};

async function renderComments(postId) {
  const { data: comments } = await supabase
    .from('forum_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  const authorIds = [...new Set(comments.map(c => c.author_id).filter(Boolean))];
  let profiles = {};
  if (authorIds.length) {
    const { data: profileData } = await supabase
      .from('users_extended_data')
      .select('user_id, username, profile_pic')
      .in('user_id', authorIds);
    profileData?.forEach(p => { profiles[p.user_id] = p; });
  }
  const inner = document.getElementById('forum-comments-inner');
  if (!comments || !comments.length) {
    inner.innerHTML = `<div style="color:#bbb;">No replies yet.</div>`;
    return;
  }
  inner.innerHTML = `<h2>Replies</h2>` + comments.map(c => {
    let author = profiles[c.author_id] || {};
    let authorImg = author.profile_pic
      ? `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${author.profile_pic}`
      : '/public/logos.png';
    let authorName = author.username || "Anonymous";
    let canEdit = userIsAdmin || (sessionUser && c.author_id === sessionUser.id);
    return `
      <div style="display:flex;align-items:center;margin-bottom:9px;">
        <img src="${authorImg}" class="forum-author-img" style="margin-right:8px;">
        <div>
          <span style="color:#f6c62e;font-weight:600;">${escapeHtml(authorName)}</span>
          <span style="color:#aaa;font-size:0.94em;">${formatDate(c.created_at)}</span>
          <div style="color:#f8f8ff;margin:4px 0;">${escapeHtml(c.content)}</div>
          ${canEdit ? `<button class="comment-delete-btn" data-id="${c.id}" data-post="${postId}" style="color:#ff5899;background:none;border:none;">Delete</button>` : ""}
        </div>
      </div>
    `;
  }).join('');
  document.querySelectorAll('.comment-delete-btn').forEach(btn => 
    btn.onclick = () => deleteComment(btn.getAttribute('data-id'), btn.getAttribute('data-post'))
  );
}

async function deleteComment(commentId, postId) {
  if (!confirm('Delete this reply?')) return;
  await supabase.from('forum_comments').delete().eq('id', commentId);
  await renderComments(postId);
  await updateCommentCount(postId);
  await fetchThreads();
}

async function updateCommentCount(postId) {
  const { count } = await supabase
    .from('forum_comments')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);
  await supabase.from('forum_posts').update({ comments_count: count }).eq('id', postId);
}

// --------- Helper Functions ---------
async function fetchCommentCounts() {
  if (!forumThreads.length) return;
  for (let post of forumThreads) {
    const { count } = await supabase
      .from('forum_comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id);
    post.comments_count = count || 0;
  }
}
function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function formatDate(dt) {
  if (!dt) return '';
  const date = new Date(dt);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function truncate(str, n) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}
function stripMd(md) {
  return md.replace(/[_*~`>#-]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1');
}
