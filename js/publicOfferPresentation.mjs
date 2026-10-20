import {escapeHtml, safeImageUrl} from './safePresentation.js';
export {escapeHtml};
export const imageAttribute = value => escapeHtml(safeImageUrl(value));

// Stored application content is text, never markup or executable event attributes.
export function createApplicantRow(app, profile = {}, options = {}) {
  const doc = options.document || document;
  const row = doc.createElement('div');
  row.id = `app-row-${app.id}`;
  row.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:14px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #393963;overflow-wrap:anywhere;';
  const identity = doc.createElement('div'); identity.style.textAlign = 'center';
  const image = doc.createElement('img'); image.alt = 'Applicant profile picture';
  image.src = profile.profile_pic ? safeImageUrl(`https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${profile.profile_pic}`) : 'logos.png';
  image.style.cssText = 'width:54px;height:54px;border-radius:50%;object-fit:cover;';
  const username = doc.createElement('div'); username.textContent = app.sponsee_username || '';
  identity.append(image, username);
  const detail = doc.createElement('div'); detail.style.cssText = 'flex:1;min-width:120px;';
  const status = doc.createElement('strong');
  const value = String(app.status || ''); status.textContent = value ? value[0].toUpperCase() + value.slice(1) : '';
  status.style.color = ({accepted:'#13b257',withdrawn:'#c90b3e',pending:'#ff9800'})[value] || '#fff';
  detail.append(status);
  if (app.application_text) {
    const message = doc.createElement('p'); message.style.cssText = 'white-space:pre-wrap;margin:8px 0;';
    const label = doc.createElement('strong'); label.textContent = 'Message: ';
    const body = doc.createElement('span'); body.textContent = String(app.application_text);
    message.append(label, body); detail.append(message);
  }
  const button = (label, color) => {
    const element = doc.createElement('button'); element.type = 'button'; element.textContent = label;
    element.style.cssText = `background:${color};color:#fff;padding:6px 12px;border-radius:7px;border:0;cursor:pointer;`;
    return element;
  };
  const view = button('View Profile', '#4061b3');
  view.onclick = () => (options.navigate || (url => { window.location.href = url; }))(`./viewprofile.html?username=${encodeURIComponent(app.sponsee_username || '')}`);
  row.append(identity, detail, view);
  if (app.status === 'accepted' || (app.status === 'pending' && options.parentAvailable)) {
    const accept = button(app.status === 'accepted' ? 'Accepted' : 'Accept', '#13b257');
    accept.disabled = app.status === 'accepted';
    accept.onclick = () => { accept.disabled = true; accept.textContent = 'Checking...'; options.onAccept?.(app.id, accept); };
    row.append(accept);
  }
  const remove = button('Remove', '#c90b3e'); remove.disabled = app.status !== 'pending' || !options.parentAvailable;
  remove.onclick = () => options.onRemove?.(app.id, remove); row.append(remove);
  return row;
}
