(() => {
const cfg = window.EVENT_CONFIG || {};
const $ = (id) => document.getElementById(id);
const money = n => new Intl.NumberFormat('en-US').format(Number(n)||0) + ' MMK';
const apiReady = () => !!(cfg.apiUrl && /^https:\/\/script\.google\.com\//.test(cfg.apiUrl));
async function api(action, payload={}) {
  if (!apiReady()) throw new Error('API is not configured yet. Follow README.md to deploy Google Apps Script and add its URL to config.js.');
  const response = await fetch(cfg.apiUrl, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action,...payload})});
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function setMessage(el, msg, good=false) { if(!el)return; el.hidden=false; el.textContent=msg; el.className='notice '+(good?'':'notice-warning'); }

function timeToSeconds(value) {
  if (value == null || value === '') return null;

  const parts = String(value).trim().split(':').map(Number);
  if (parts.length < 2 || parts.some(n => !Number.isFinite(n))) {
    return null;
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function getDuration(row) {
  const value = row.duration ?? row.totalTime ?? row.total_time ?? '';
  return timeToSeconds(value);
}

function calculateRanks(rows) {
  const valid = rows
    .map(r => ({ ...r, _duration: getDuration(r) }))
    .filter(r =>
      r._duration !== null &&
      !['DNF', 'DNS', 'DNQ', 'DSQ', 'INJURY']
        .includes(String(r.status || r.remark || '').toUpperCase())
    );

  const categoryGroups = new Map();

  valid.forEach(r => {
    const category = String(r.category || '').trim();
    if (!categoryGroups.has(category)) {
      categoryGroups.set(category, []);
    }
    categoryGroups.get(category).push(r);
  });

  const output = new Map();

  for (const [category, group] of categoryGroups) {
    group.sort((a, b) => a._duration - b._duration);

    const genderGroups = new Map();

    group.forEach(r => {
      const gender = String(r.gender || '').trim().toLowerCase();
      const key = gender.startsWith('m') || gender === 'ကျား'
        ? 'male'
        : gender.startsWith('f') || gender === 'မ'
          ? 'female'
          : gender;

      if (!genderGroups.has(key)) genderGroups.set(key, []);
      genderGroups.get(key).push(r);
    });

    const rankMap = new Map();

    group.forEach((r, i) => {
      const previous = i > 0 ? group[i - 1]._duration : null;
      const rank = previous === r._duration
        ? rankMap.get(r.bib).overallRank
        : i + 1;

      rankMap.set(r.bib, {
        ...r,
        overallRank: rank,
        overallTotal: group.length
      });
    });

    for (const [gender, members] of genderGroups) {
      members.sort((a, b) => a._duration - b._duration);

      members.forEach((r, i) => {
        const previous = i > 0 ? members[i - 1]._duration : null;
        const rank = previous === r._duration
          ? members[i - 1]._genderRank
          : i + 1;

        const result = rankMap.get(r.bib);
        if (result) {
          result.genderRank = rank;
          result.genderTotal = members.length;
          output.set(r.bib, result);
        }
      });
    }
  }

  return rows.map(r => {
    const result = output.get(r.bib);
    return result ? {
      ...r,
      overallRank: `${result.overallRank}/${result.overallTotal}`,
      genderRank: `${result.genderRank}/${result.genderTotal}`
    } : {
      ...r,
      overallRank: '',
      genderRank: ''
    };
  });
}
  
function downloadCsv(filename, rows) {
  if(!rows || !rows.length) { alert('No data to export.'); return; }
  const keys = Object.keys(rows[0]);
  const quote = v => '"' + String(v ?? '').replace(/"/g,'""') + '"';
  const csv = [keys.map(quote).join(','), ...rows.map(r=>keys.map(k=>quote(r[k])).join(','))].join('\r\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'})); a.download=filename; a.click(); URL.revokeObjectURL(a.href);
}
async function loadPublicRegistration() {
  const body=$('registrationRows'); if(!body)return;
  let rows=[];
  try { const d=await api('publicRegistrations'); rows=d.rows||[]; } catch(e) { body.innerHTML=`<tr><td colspan="6" class="empty-cell">${escapeHtml(e.message)}</td></tr>`; $('registrationCount').textContent='API not connected'; return; }
  const render=()=>{const q=($('registrationSearch').value||'').trim().toLowerCase();const shown=rows.filter(r=>String(r.name||'').toLowerCase().includes(q));$('registrationCount').textContent=`${shown.length} participants`;body.innerHTML=shown.length?shown.map(r=>`<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.gender)}</td><td>${escapeHtml(r.category)}</td><td>${escapeHtml(r.shirtSize)}</td><td>${escapeHtml(r.regSource||'Website')}</td><td>${r.approved?'<span class="ticket-link">Approved</span>':'—'}</td></tr>`).join(''):`<tr><td colspan="6" class="empty-cell">No matching participants found.</td></tr>`;};
  $('registrationSearch').addEventListener('input',render);render();
}
async function loadResults() {
  const male=$('maleResults'); if(!male)return;
  let rows=[];
  try { const d=await api('publicResults'); rows=d.rows||[]; } catch(e) { male.innerHTML=`<p class="empty-cell">${escapeHtml(e.message)}</p>`;$('femaleResults').innerHTML='';return; }
  const render=()=>{const cat=$('resultCategory').value,q=($('resultSearch').value||'').trim().toLowerCase();const byCat=rows.filter(r=>cat==='All'||r.category===cat);const top=(gender)=>byCat.filter(r=>String(r.gender).toLowerCase()===gender.toLowerCase()&&r.status!=='DNF'&&r.status!=='DNS'&&r.status!=='DNQ').sort((a,b)=>(Number(a.rank)||999999)-(Number(b.rank)||999999)).slice(0,10);const card=(r,i)=>`<div class="leader-row"><span class="rank-num">${escapeHtml(r.rank||i+1)}</span><div><div class="leader-name">${escapeHtml(r.name)}</div><div class="leader-sub">BIB ${escapeHtml(r.bib)} · ${escapeHtml(r.category)}</div></div><span class="leader-time">${escapeHtml(r.finishTime||r.totalTime||'—')}</span></div>`;male.innerHTML=top('Male').map(card).join('')||'<p class="empty-cell">No published male results yet.</p>';$('femaleResults').innerHTML=top('Female').map(card).join('')||'<p class="empty-cell">No published female results yet.</p>';const matches=q?byCat.filter(r=>String(r.bib).toLowerCase().includes(q)||String(r.name).toLowerCase().includes(q)):[];$('allSearchResults').innerHTML=q?(matches.length?matches.map(card).join(''):'<p class="empty-cell">No matching result found.</p>'):'<p class="muted">Search using BIB number or name.</p>';};
  $('resultCategory').addEventListener('change',render);$('resultSearch').addEventListener('input',render);render();
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function initCountdown(){if(!$('countdown'))return;const target=new Date('2026-12-30T18:00:00+06:30').getTime();function tick(){let d=Math.max(0,target-Date.now());[['days',86400000],['hours',3600000],['minutes',60000],['seconds',1000]].forEach(([id,unit])=>{const el=$(id);if(el)el.textContent=String(Math.floor(d/unit)%(id==='days'?Infinity:id==='hours'?24:id==='minutes'?60:60)).padStart(2,'0')});}tick();setInterval(tick,1000);}
function initRegistration(){
 const form=$('registration-form');if(!form)return;
 const cat=$('category'),fee=$('fee'),student=$('student'),id=$('nationalId'),file=$('paymentScreenshot');
 let liveFees = {...(cfg.fees || {})};
 const updateFee=()=>fee.textContent=cat.value?money(liveFees[cat.value]):'Choose a distance to see fee';
 cat.addEventListener('change',updateFee);
 // Load live event settings and the current public KBZPay QR from Apps Script.
 if (apiReady()) {
   api('getPublicSettings').then(({settings:s={}})=>{
     if(s.eventName) $('eventName').value=s.eventName;
     if(s.eventDate) $('eventDate').value=s.eventDate;
     if(s.fee45!==undefined) liveFees['4.5 KM']=Number(s.fee45);
     if(s.fee9!==undefined) liveFees['9 KM']=Number(s.fee9);
     updateFee();
     const qr=$('kbzQr');
     // Keep the local assets/kbzpay-qr.png image as the default.
     // Only replace it when the backend explicitly provides a hosted QR URL.
     if(qr && s.kbzQrUrl) {
       qr.innerHTML=`<img src="${escapeHtml(s.kbzQrUrl)}" alt="Official KBZPay payment QR code" style="display:block;max-width:100%;width:220px;height:auto;margin:0 auto 8px;border-radius:8px"><small>Official KBZPay QR</small>`;
     }
     const instructions=$('paymentInstructions'); if(instructions) instructions.textContent=s.paymentInstructions||'Pay the exact registration fee and upload your payment screenshot.';
     if(String(s.registrationOpen).toLowerCase()==='false') {
       const submit=$('submitBtn'); if(submit){submit.disabled=true;submit.textContent='Registration Closed';}
       const notice=$('registrationMessage'); if(notice){notice.hidden=false;notice.textContent='Registration is currently closed by the organiser.';}
     }
   }).catch(()=>{});
 }
 student.addEventListener('change',()=>{const exempt=student.value==='Yes';id.required=!exempt;id.disabled=exempt;if(exempt)id.value='';$('idField').style.opacity=exempt?'.55':'1';});
 $('eventName').value=cfg.eventName||'New Year Eve Run Yangon 2026';$('eventDate').value=cfg.eventDate||'2026-12-30';updateFee();
 form.addEventListener('submit',async e=>{e.preventDefault();const msg=$('registrationMessage'),btn=$('submitBtn');if(!file.files[0])return setMessage(msg,'Please upload your payment screenshot.');if(file.files[0].size>(cfg.maxUploadMB||5)*1024*1024)return setMessage(msg,'Screenshot exceeds the 5 MB limit.');if(!apiReady())return setMessage(msg,'Registration backend is not connected yet. Complete the Google Apps Script setup in README.md.');btn.disabled=true;btn.textContent='Submitting…';try{const data=Object.fromEntries(new FormData(form).entries());delete data.paymentScreenshot;delete data.consent;const f=file.files[0];const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(f)});data.paymentScreenshot={name:f.name,mimeType:f.type,base64};data.fee=(cfg.fees||{})[data.category];const res=await api('register',{participant:data});setMessage(msg,`Registration submitted successfully. Your Registration ID is ${res.registrationId}. Payment is pending manual review. Please keep this ID and your registration email.`,true);form.reset();updateFee();}catch(err){setMessage(msg,err.message);}finally{btn.disabled=false;btn.innerHTML='Submit Registration <span>→</span>';}});
 const tf=$('ticketForm');if(tf)tf.addEventListener('submit',async e=>{e.preventDefault();const out=$('ticketResult');out.hidden=false;out.textContent='Looking up ticket…';try{const d=Object.fromEntries(new FormData(tf).entries());const r=await api('findTicket',d);if(!r.ticket)throw new Error('Ticket not found or not yet approved. Check your Registration ID and email.');const t=r.ticket;out.innerHTML=`<div class="ticket-card"><img alt="Approval QR ticket" src="${escapeHtml(t.qrDataUrl)}"><div><p class="eyebrow">APPROVED RACE TICKET</p><h3>${escapeHtml(t.name)}</h3><p>Registration ID: ${escapeHtml(t.registrationId)}<br>Gender: ${escapeHtml(t.gender)}<br>T-shirt Size: ${escapeHtml(t.shirtSize)}<br>Category: ${escapeHtml(t.category)}</p><button class="btn btn-ghost" id="printTicket">Print Ticket</button></div></div>`;$('printTicket').onclick=()=>window.print();}catch(err){out.textContent=err.message;out.className='ticket-result notice notice-warning';}});
}
async function initAdmin(){
 if(!$('eventSettingsForm'))return;
 const form=$('eventSettingsForm');
 form.addEventListener('submit',async e=>{e.preventDefault();const out=$('settingsMessage');try{const data=Object.fromEntries(new FormData(form).entries());delete data.kbzQr;delete data.sizeChart;await api('saveSettings',{settings:data});out.textContent='Settings saved.';}catch(err){out.textContent=err.message;}});
 $('adminSearch').addEventListener('input',()=>renderAdminRows(window._adminRows||[]));
 function renderAdminRows(rows){window._adminRows=rows;const q=$('adminSearch').value.toLowerCase();const shown=rows.filter(r=>[r.registrationId,r.name,r.email,r.bib].some(v=>String(v||'').toLowerCase().includes(q)));$('adminRows').innerHTML=shown.length?shown.map(r=>`<tr><td>${escapeHtml(r.registrationId)}</td><td>${escapeHtml(r.name)}</td><td><select data-id="${escapeHtml(r.registrationId)}" data-field="category"><option ${r.category==='4.5 KM'?'selected':''}>4.5 KM</option><option ${r.category==='9 KM'?'selected':''}>9 KM</option></select></td><td><select data-id="${escapeHtml(r.registrationId)}" data-field="shirtSize">${['XS','S','M','L','XL','2XL','3XL'].map(s=>`<option ${r.shirtSize===s?'selected':''}>${s}</option>`).join('')}</select></td><td>${escapeHtml(r.paymentStatus||'Pending')}</td><td>${r.screenshotUrl?`<a class="ticket-link" target="_blank" rel="noopener" href="${escapeHtml(r.screenshotUrl)}">View</a>`:'—'}</td><td>${escapeHtml(r.approvalStatus||'Pending')}</td><td><button class="btn btn-small" data-action="approve" data-id="${escapeHtml(r.registrationId)}">Approve</button> <button class="btn btn-small btn-ghost" data-action="reject" data-id="${escapeHtml(r.registrationId)}">Reject</button> <button class="btn btn-small btn-ghost" data-action="save" data-id="${escapeHtml(r.registrationId)}">Save</button></td></tr>`).join(''):'<tr><td colspan="8" class="empty-cell">No registrations found.</td></tr>'; }
 try{const d=await api('adminRegistrations');const rows=d.rows||[];renderAdminRows(rows);const s=d.stats||{};$('statApproved').textContent=s.approved??0;$('statPending').textContent=s.pending??0;$('stat45').textContent=s['4.5 KM']??0;$('stat9').textContent=s['9 KM']??0;$('shirtCounts').innerHTML=Object.entries(s.shirts||{}).map(([k,v])=>`<span class="size-count">${escapeHtml(k)}: <b>${v}</b></span>`).join('')||'No data';}catch(e){$('adminRows').innerHTML=`<tr><td colspan="8" class="empty-cell">${escapeHtml(e.message)}</td></tr>`;}
 $('adminRows').addEventListener('click',async e=>{const b=e.target.closest('button[data-action]');if(!b)return;const id=b.dataset.id,action=b.dataset.action;try{if(action==='save'){const fields=[...$('adminRows').querySelectorAll(`[data-id="${CSS.escape(id)}"][data-field]`)];const changes={};fields.forEach(f=>changes[f.dataset.field]=f.value);await api('updateParticipant',{registrationId:id,changes});alert('Participant updated.');}else{await api('reviewPayment',{registrationId:id,decision:action});alert(`Registration ${action}d.`);}location.reload();}catch(err){alert(err.message);}});
 
for (const [buttonId, action, fileName] of [
  ['exportParticipants', 'exportParticipants', 'participants.csv'],
  ['exportPayments', 'exportPayments', 'payment-review.csv'],
  ['exportResults', 'exportResults', 'results.csv']
]) {
  $(buttonId).addEventListener('click', async () => {
    try {
      const d = await api(action);
      let rows = d.rows || [];

      if (buttonId === 'exportResults') {
        rows = calculateRanks(rows).map(r => ({
          BIB: r.bib ?? '',
          Name: r.name ?? '',
          Gender: r.gender ?? '',
          Category: r.category ?? '',
          Duration: r.duration ?? r.totalTime ?? r.total_time ?? '',
          'Overall Rank': r.overallRank ?? '',
          'Gender Rank': r.genderRank ?? ''
        }));
      }

      downloadCsv(fileName, rows);
    } catch (e) {
      alert(e.message);
    }
  });
}

 $('uploadResults').addEventListener('click',async()=>{const f=$('resultCsv').files[0];if(!f)return setMessage($('resultUploadMessage'),'Choose a CSV file first.');try{const text=await f.text();const d=await api('importResults',{csv:text});$('resultUploadMessage').textContent=`Imported ${d.count} result rows.`;}catch(e){$('resultUploadMessage').textContent=e.message;}});
}
initCountdown();initRegistration();loadPublicRegistration();loadResults();initAdmin();
})();
