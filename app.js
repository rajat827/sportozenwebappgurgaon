import { calculateEndTime, composeMessage } from './booking-utils.mjs';
import { spotsRemaining, spotsLabel } from './pickup-utils.mjs';
import { verifiedRating, venueOffer } from './venue-utils.mjs';

const config = window.SPORTOZEN_CONFIG || {};
const $ = (selector) => document.querySelector(selector);
const state = { venues: [], filtered: [], games: [], gamesConnected: false, selectedId: null, sport: 'All', area: '', search: '', limit: 10, userLocation: null, map: null, mapReady: false, mapMarkers: [], mobileMap: true, demo: true, loading: false };
const icons = { Football:'⚽', Badminton:'🏸', Cricket:'🏏', Basketball:'🏀', Swimming:'🏊', Tennis:'🎾', Pickleball:'🥎' };
const cityCenter = [77.061, 28.449];

function escapeHtml(value='') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(value='') { return escapeHtml(value); }
function text(value) { return String(value ?? '').trim(); }
function safeHttpUrl(value) { if(typeof value!=='string'||!value.trim()||!/^https?:\/\//i.test(value))return null; try { const url=new URL(value); return ['http:','https:'].includes(url.protocol)?url.href:null; } catch { return null; } }
function toast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('show'),3500); }
function haversine(a,b) { const rad=Math.PI/180, dLat=(b[1]-a[1])*rad, dLon=(b[0]-a[0])*rad, x=Math.sin(dLat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dLon/2)**2; return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x)); }
function placeLabel(venue) { return [venue.locality,venue.city].filter(Boolean).join(', '); }
function venueSport(venue) { return venue.sports?.[0] || 'Sports'; }
function priceLabel(venue) { const p=venue.startingPrice; return p && Number.isFinite(Number(p.amount)) && p.unit ? `From ${p.currency==='INR'?'₹':p.currency+' '}${Number(p.amount).toLocaleString('en-IN')} / ${p.unit}` : 'Check price on WhatsApp'; }
function currentUrl(id) { const url=new URL(location.href); url.searchParams.set('venue',id); return url.toString(); }
function setUrl(id) { const url=new URL(location.href); if(id)url.searchParams.set('venue',id); else url.searchParams.delete('venue'); history.replaceState({},'',url); }

async function loadVenues() {
  const useDemo = !config.VENUE_API_BASE_URL || new URLSearchParams(location.search).get('demo')==='1';
  state.demo=useDemo;
  const base=useDemo ? './data/demo-venues.json' : `${config.VENUE_API_BASE_URL.replace(/\/$/,'')}/venues?city=gurugram`;
  try {
    const res=await fetch(base,{headers:{Accept:'application/json'}});
    if(!res.ok)throw new Error(`Venue service returned ${res.status}`);
    const payload=await res.json();
    const rows=Array.isArray(payload)?payload:payload.venues;
    if(!Array.isArray(rows))throw new Error('Venue response is missing venues');
    state.venues=rows.filter(v=>v && text(v.id) && text(v.name) && Number.isFinite(Number(v.latitude)) && Number.isFinite(Number(v.longitude))).map(v=>({...v,latitude:Number(v.latitude),longitude:Number(v.longitude),sports:Array.isArray(v.sports)?v.sports:[]}));
    $('#dataBadge').textContent=useDemo?'DEMO DATA':'LIVE VENUES';
    $('#dataBadge').classList.toggle('demo-pill',useDemo);
    $('#dataNote').textContent=useDemo?'Sample venue listings for UI review. Availability and prices are confirmed on WhatsApp.':'Availability and final prices are confirmed during booking.';
    populateFilters(); applyFilters();
    loadGames();
    const deepLink=new URLSearchParams(location.search).get('venue');
    if(deepLink && state.venues.some(v=>v.id===deepLink))openDetail(deepLink,false);
  } catch(error) {
    $('#venueList').innerHTML=`<div class="empty"><strong>Venues are unavailable right now.</strong><p>${escapeHtml(error.message)}. Please try again shortly.</p></div>`;
    $('#dataNote').textContent='The venue service could not be loaded.';
    $('#dataBadge').textContent='UNAVAILABLE';
  }
}
async function loadGames(){
  if(state.demo){state.games=[];state.gamesConnected=false;renderGames();return;}
  try{
    const res=await fetch(`${config.VENUE_API_BASE_URL.replace(/\/$/,'')}/pickup-games?city=gurugram`,{headers:{Accept:'application/json'}});
    if(!res.ok)throw new Error(`Pickup game service returned ${res.status}`);
    const payload=await res.json();const rows=Array.isArray(payload)?payload:payload.games;
    if(!Array.isArray(rows))throw new Error('Pickup game response is missing games');
    state.games=rows.filter(g=>g&&text(g.id)&&text(g.venueId)&&text(g.sport)&&Number.isFinite(Date.parse(g.startAt))&&Date.parse(g.startAt)>Date.now()).sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt));
    state.gamesConnected=true;
  }catch{state.games=[];state.gamesConnected=false;}
  renderGames();
}
function gameTime(game){return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(new Date(game.startAt));}
function renderGames(){
  $('#pickupCount').textContent=state.gamesConnected&&state.games.length?String(state.games.length):'';
  if(!state.gamesConnected){$('#pickupList').innerHTML='<div class="pickup-empty"><strong>Live games are not connected yet.</strong><p>When Sportozen posts games, this view will show the sport, venue, start time and verified player spots left.</p></div>';return;}
  if(!state.games.length){$('#pickupList').innerHTML='<div class="pickup-empty"><strong>No pickup games listed right now.</strong><p>Check back for new games in Gurugram.</p></div>';return;}
  $('#pickupList').innerHTML=state.games.map(g=>{const venue=state.venues.find(v=>v.id===g.venueId),full=spotsRemaining(g)===0;return `<article class="pickup-card"><div class="pickup-card-top"><span class="pickup-sport">${icons[g.sport]||'✦'} ${escapeHtml(g.sport)}</span><span class="pickup-spots ${full?'full':''}">${escapeHtml(spotsLabel(g))}</span></div><h3>${escapeHtml(venue?.name||g.venueName||'Venue to be confirmed')}</h3><p>📍 ${escapeHtml(venue?.locality||'Gurugram')} · ${escapeHtml(gameTime(g))}</p><button type="button" data-game="${escapeAttr(g.id)}" ${full?'disabled':''}>${full?'Game full':'Ask to join on WhatsApp ↗'}</button></article>`;}).join('');
  $('#pickupList').querySelectorAll('[data-game]').forEach(button=>button.addEventListener('click',()=>joinGame(button.dataset.game)));
}
function joinGame(id){const game=state.games.find(g=>g.id===id);if(!game||spotsRemaining(game)===0)return;const venue=state.venues.find(v=>v.id===game.venueId);const number=String(config.SPORTOZEN_WHATSAPP_NUMBER||'').replace(/\D/g,'');if(!number){toast('Sportozen WhatsApp number is not configured.');return;}const message=[`Hi Sportozen, I would like to join the ${game.sport} pickup game.`,`Game ID: ${game.id}`,`Venue: ${venue?.name||game.venueName||'Please confirm'} (ID: ${game.venueId})`,`Start: ${gameTime(game)} IST`,'Please confirm that a player spot is still available, the fee and any cancellation terms. This is an enquiry, not a confirmed place.'].join('\n');window.location.assign(`https://api.whatsapp.com/send/?phone=${number}&text=${encodeURIComponent(message)}&type=phone_number&app_absent=0`);}
function populateFilters(){
  const sports=['All',...new Set(state.venues.flatMap(v=>v.sports))];
  for(const selector of ['#sportFilters','#mapSportFilters']){
    $(selector).innerHTML=sports.map(s=>`<button class="chip ${state.sport===s?'active':''}" type="button" data-sport="${escapeAttr(s)}" aria-pressed="${state.sport===s}">${icons[s]||'✦'} ${escapeHtml(s)}</button>`).join('');
    $(selector).querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{state.sport=b.dataset.sport;state.limit=10;populateFilters();applyFilters();focusResults();}));
  }
  const areas=[...new Set(state.venues.map(v=>v.locality).filter(Boolean))].sort();
  $('#locality').innerHTML='<option value="">All areas</option>'+areas.map(a=>`<option value="${escapeAttr(a)}">${escapeHtml(a)}</option>`).join('');
  $('#locality').value=state.area;
}
function applyFilters(){
  const q=state.search.toLocaleLowerCase();
  state.filtered=state.venues.filter(v=>(state.sport==='All'||v.sports.includes(state.sport))&&(!state.area||v.locality===state.area)&&(!q||[v.name,v.locality,v.address,...v.sports].some(x=>text(x).toLocaleLowerCase().includes(q))));
  if(state.userLocation)state.filtered.sort((a,b)=>haversine(state.userLocation,[a.longitude,a.latitude])-haversine(state.userLocation,[b.longitude,b.latitude]));
  $('#resultCount').textContent=state.filtered.length.toLocaleString('en-IN');$('#resultLabel').textContent=state.filtered.length===1?'venue':'venues'; $('#mapCount').textContent=`${state.filtered.length} ${state.filtered.length===1?'place':'places'}`;
  renderList(); updateMap();
}
function focusResults(){
  if(!state.mapReady || !state.filtered.length || (matchMedia('(max-width:760px)').matches&&!state.mobileMap))return;
  if(state.filtered.length===1){const v=state.filtered[0];state.map.flyTo({center:[v.longitude,v.latitude],zoom:13.2,duration:300});return;}
  const bounds=new maplibregl.LngLatBounds();state.filtered.forEach(v=>bounds.extend([v.longitude,v.latitude]));
  state.map.fitBounds(bounds,{padding:{top:190,bottom:110,left:45,right:45},maxZoom:13.2,duration:300});
}
function renderList(){
  const shown=state.filtered.slice(0,state.limit);
  $('#venueList').innerHTML=shown.length?shown.map(v=>{
    const distance=state.userLocation?`${haversine(state.userLocation,[v.longitude,v.latitude]).toFixed(1)} km straight-line`:(v.locality||'Gurugram');
    const rating=verifiedRating(v),offer=venueOffer(v);
    return `<article class="venue-card ${state.selectedId===v.id?'selected':''}" tabindex="0" data-id="${escapeAttr(v.id)}" aria-label="View ${escapeAttr(v.name)}"><div class="venue-art"><span>${icons[venueSport(v)]||'✦'}</span></div><div class="venue-content"><div class="venue-topline"><span class="venue-sport">${escapeHtml(v.sports.length?v.sports.join(' · '):'Sports')}</span><span class="venue-area">${escapeHtml(distance)}</span></div><h3 class="venue-name">${escapeHtml(v.name)}</h3><p class="venue-address">${escapeHtml(v.address||placeLabel(v))}</p><div class="venue-facts"><span class="venue-rating">${rating?`★ ${rating.value.toFixed(1)} <small>(${rating.count})</small>`:'No verified rating'}</span>${offer?`<span class="venue-offer">${escapeHtml(offer.label)}</span>`:''}</div><div class="venue-bottom"><span class="price-copy">${escapeHtml(priceLabel(v))}</span><button class="card-book" type="button" data-book="${escapeAttr(v.id)}">Book on WhatsApp ↗</button></div></div></article>`;
  }).join(''):'<div class="empty"><strong>No venues match those filters.</strong><p>Try another sport, area, or search.</p></div>';
  $('#venueList').querySelectorAll('.venue-card').forEach(card=>{card.addEventListener('click',e=>{if(e.target.closest('[data-book]')){openDetail(card.dataset.id);return;} openDetail(card.dataset.id);});card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openDetail(card.dataset.id);}})});
  $('#loadMore').hidden=state.filtered.length<=state.limit;
}
function tintMap(){
  const colors={background:'#173c31',water:'#143a3c',park:'#2f6746',land:'#234f3a',building:'#38614b',road:'#86a48d',label:'#e2f1dd'};
  for(const layer of state.map.getStyle().layers){
    const id=layer.id.toLowerCase();
    try{
      if(layer.type==='background')state.map.setPaintProperty(layer.id,'background-color',colors.background);
      else if(layer.type==='fill'&&/water/.test(id))state.map.setPaintProperty(layer.id,'fill-color',colors.water);
      else if(layer.type==='fill'&&/park|wood|grass|green|forest/.test(id))state.map.setPaintProperty(layer.id,'fill-color',colors.park);
      else if(layer.type==='fill'&&/landcover|landuse/.test(id))state.map.setPaintProperty(layer.id,'fill-color',colors.land);
      else if(layer.type==='fill'&&/building/.test(id))state.map.setPaintProperty(layer.id,'fill-color',colors.building);
      else if(layer.type==='line'&&/road|highway|street|bridge|tunnel/.test(id)&&!/path|rail|outline|casing/.test(id))state.map.setPaintProperty(layer.id,'line-color',colors.road);
      else if(layer.type==='symbol'){
        if(/poi|airport|aerodrome/.test(id))state.map.setLayoutProperty(layer.id,'visibility','none');
        else if(layer.layout?.['text-field']){state.map.setPaintProperty(layer.id,'text-color',colors.label);state.map.setPaintProperty(layer.id,'text-halo-color',colors.background);state.map.setPaintProperty(layer.id,'text-halo-width',1.2);}
      }
    }catch{}
  }
}
function initMap(){
  if(!window.maplibregl){$('#mapFallback').hidden=false;return;}
  try{
    state.map=new maplibregl.Map({container:'map',style:config.MAP_STYLE_URL||'https://tiles.openfreemap.org/styles/liberty',center:cityCenter,zoom:11.3,attributionControl:false});
    state.map.addControl(new maplibregl.NavigationControl({showCompass:false}),'bottom-right');
    state.map.addControl(new maplibregl.AttributionControl({compact:true}));
    state.map.on('load',()=>{
      state.mapReady=true;
      tintMap();
      state.map.on('moveend',updateMap);
      updateMap();
    });
    state.map.on('error',e=>{if(!state.mapReady && e.error)$('#mapFallback').hidden=false;});
  }catch{ $('#mapFallback').hidden=false; }
}
function updateMap(){
  if(!state.mapReady)return;
  state.mapMarkers.forEach(marker=>marker.remove());state.mapMarkers=[];
  const groups=new Map();
  for(const v of state.filtered){const p=state.map.project([v.longitude,v.latitude]);const key=state.map.getZoom()>14? v.id : `${Math.floor(p.x/58)}:${Math.floor(p.y/58)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(v);}
  for(const group of groups.values()){
    const selected=group.find(v=>v.id===state.selectedId);const main=selected||group[0];
    const point=[group.reduce((n,v)=>n+v.longitude,0)/group.length,group.reduce((n,v)=>n+v.latitude,0)/group.length];
    const button=document.createElement('button');button.type='button';button.className=`map-marker${group.length>1?' cluster':''}${selected?' selected':''}`;
    button.textContent=group.length>1?String(group.length):(icons[venueSport(main)]||'✦');
    button.setAttribute('aria-label',group.length>1?`${group.length} venues. Zoom in to view.`:`View ${main.name}`);
    button.addEventListener('click',e=>{e.stopPropagation();if(group.length>1){const bounds=new maplibregl.LngLatBounds();group.forEach(v=>bounds.extend([v.longitude,v.latitude]));state.map.fitBounds(bounds,{padding:90,maxZoom:15.5});}else openDetail(main.id);});
    state.mapMarkers.push(new maplibregl.Marker({element:button,anchor:'center'}).setLngLat(point).addTo(state.map));
  }
}
function openDetail(id,writeUrl=true){
  const v=state.venues.find(x=>x.id===id);if(!v)return;
  state.selectedId=id;renderList();updateMap();if(writeUrl)setUrl(id);
  const sports=v.sports.length?v.sports:['Sports'];
  const facilities=Array.isArray(v.facilities)&&v.facilities.length?v.facilities.map(item=>`<span class="detail-chip">${escapeHtml(item)}</span>`).join(''):'<p class="detail-text">Facility information is not available yet. Ask Sportozen before booking.</p>';
  const ratingData=verifiedRating(v);
  const rating=ratingData?`★ ${ratingData.value.toFixed(1)} (${ratingData.count} reviews)`:'No verified rating yet';
  const activeOffer=venueOffer(v);
  const offer=activeOffer?`<div class="detail-offer"><strong>${escapeHtml(activeOffer.label)}</strong><span>${escapeHtml(activeOffer.terms||'Confirm offer terms before booking')}</span></div>`:'';
  const photo=Array.isArray(v.photos)&&safeHttpUrl(v.photos[0]);
  const source=safeHttpUrl(v.sourceUrl);
  const formats=Array.isArray(v.formats)&&v.formats.length?v.formats.map(item=>`<span class="detail-chip">${escapeHtml(item)}</span>`).join(''):'';
  const number=String(config.SPORTOZEN_WHATSAPP_NUMBER||'').replace(/\D/g,'');
  const displayNumber=number.startsWith('91')&&number.length===12?`+91 ${number.slice(2,7)} ${number.slice(7)}`:`+${number}`;
  const hero=photo?`<div class="detail-hero" style="background-image:url('${escapeAttr(photo)}');background-size:cover;background-position:center"><span class="detail-hero-label">VENUE PHOTO</span></div>`:'<div class="detail-hero"><span class="detail-hero-label">ILLUSTRATIVE COURT VIEW · NOT A VENUE PHOTO</span></div>';
  const directions=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v.latitude},${v.longitude}`)}`;
  $('#detailContent').innerHTML=`${hero}
    <div class="detail-body">
      <div class="detail-badges">${sports.map(s=>`<span class="detail-chip">${icons[s]||'✦'} ${escapeHtml(s)}</span>`).join('')}</div>
      <h2 id="detailTitle">${escapeHtml(v.name)}</h2>
      <p class="detail-address">📍 ${escapeHtml(v.address||placeLabel(v))}</p>
      <div class="detail-links"><a href="${escapeAttr(directions)}" target="_blank" rel="noopener noreferrer">↗ View map location</a><span>${state.userLocation?`${haversine(state.userLocation,[v.longitude,v.latitude]).toFixed(1)} km straight-line away`:escapeHtml(v.locality||v.city||'Gurugram')}</span></div>
      ${v.locationNote?`<p class="detail-caution">${escapeHtml(v.locationNote)}</p>`:''}
      ${state.demo?'<p class="detail-caution">Demo listing. Confirm whether this venue is available for booking with Sportozen.</p>':''}
      <div class="detail-meta"><div><small>Starting price</small><strong>${escapeHtml(priceLabel(v))}</strong></div><div><small>Community rating</small><strong>${escapeHtml(rating)}</strong></div><div><small>Opening hours</small><strong>${escapeHtml(v.openingHours||'Confirm on WhatsApp')}</strong></div><div><small>Offers</small><strong>${activeOffer?'Offer shown below':'No verified offer listed'}</strong></div></div>
      ${offer}
      ${formats?`<h3>Play formats</h3><div class="detail-facilities">${formats}</div>`:''}
      <h3>Facilities</h3><div class="detail-facilities">${facilities}</div>
      <p class="detail-text">Bookings are handled by the Sportozen team on WhatsApp${number?` (${escapeHtml(displayNumber)})`:''}. Your message starts an enquiry; it does not reserve a court.</p>
      <h3>Booking request</h3><p class="detail-text">Choose a sport, date and start time. The end time follows the 30- or 60-minute duration. Sportozen will confirm the actual slot, total price and cancellation terms.</p>
      <div class="booking-form"><label>Sport<select id="bookingSport">${sports.map(s=>`<option>${escapeHtml(s)}</option>`).join('')}</select></label><label>Duration<select id="bookingDuration"><option value="30">30 minutes</option><option value="60">60 minutes</option></select></label><label>Preferred date<input id="bookingDate" type="date" min="${new Date().toLocaleDateString('en-CA')}" /></label><span></span><label>Start time<input id="bookingStart" type="time" step="1800" /></label><label>End time<input id="bookingEnd" type="time" readonly aria-label="Calculated end time" /></label></div>
      <p class="detail-text" id="timeNote">Select a start time to calculate the end time.</p>
      <p class="detail-source">${source?`Listing source: <a href="${escapeAttr(source)}" target="_blank" rel="noopener noreferrer">view source ↗</a>`:'Details from Sportozen venue API.'}</p>
    </div><div class="detail-actions"><button class="secondary" id="shareButton" type="button" aria-label="Share venue">↗</button><button class="secondary" id="copyButton" type="button" aria-label="Copy WhatsApp message">▣</button><button class="primary" id="bookingButton" type="button">Book on WhatsApp ↗</button></div>`;
  $('#detailOverlay').hidden=false;$('#bookingButton').addEventListener('click',()=>handoff(v));$('#copyButton').addEventListener('click',()=>copyMessage(v));$('#shareButton').addEventListener('click',()=>shareVenue(v));
  $('#bookingStart').addEventListener('input',syncEndTime);$('#bookingDuration').addEventListener('change',syncEndTime);
  if(state.mapReady){state.map.flyTo({center:[v.longitude,v.latitude],zoom:Math.max(state.map.getZoom(),13.1),essential:true});}
}
function closeDetail(){state.selectedId=null;$('#detailOverlay').hidden=true;setUrl(null);renderList();updateMap();}
function syncEndTime(){const result=calculateEndTime($('#bookingStart').value,Number($('#bookingDuration').value));$('#bookingEnd').value=result?.time||'';$('#timeNote').textContent=!result?'Select a start time to calculate the end time.':result.nextDay?'End time is on the next day. Sportozen will confirm overnight availability.':'These are preferred times, subject to venue confirmation.';}
function bookingPreference(v){const start=$('#bookingStart')?.value||null;const end=$('#bookingEnd')?.value||null;return {venueId:v.id,sport:$('#bookingSport')?.value||venueSport(v),preferredDate:$('#bookingDate')?.value||null,preferredStartTime:start,preferredEndTime:end,endNextDay:Boolean(start&&end&&end<start),durationMinutes:Number($('#bookingDuration')?.value||30)};}
function requestKey(p){return `enquiry:${JSON.stringify(p)}`;}
async function createEnquiry(p){if(!config.VENUE_API_BASE_URL||state.demo)return null;const key=requestKey(p);let id=sessionStorage.getItem(key);if(!id){id=crypto.randomUUID();sessionStorage.setItem(key,id);}const res=await fetch(`${config.VENUE_API_BASE_URL.replace(/\/$/,'')}/enquiries`,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({...p,clientRequestId:id})});if(!res.ok)throw new Error('Enquiry tracking unavailable');const body=await res.json();if(!body.reference)throw new Error('Enquiry reference unavailable');return String(body.reference);}
async function handoff(v){if(state.loading)return;state.loading=true;const button=$('#bookingButton');button.disabled=true;button.textContent='Opening WhatsApp…';let reference=null;const p=bookingPreference(v);try{reference=await createEnquiry(p);}catch{toast('Enquiry tracking is unavailable. Your WhatsApp message still includes the venue.');}const message=composeMessage(v,p,reference);const number=String(config.SPORTOZEN_WHATSAPP_NUMBER||'').replace(/\D/g,'');if(!number){toast('Sportozen WhatsApp number is not configured. Copy the message instead.');button.disabled=false;button.textContent='Book on WhatsApp ↗';state.loading=false;return;}const url=`https://api.whatsapp.com/send/?phone=${number}&text=${encodeURIComponent(message)}&type=phone_number&app_absent=0`;window.location.assign(url);button.disabled=false;button.textContent='Book on WhatsApp ↗';state.loading=false;}
async function copyMessage(v){const message=composeMessage(v,bookingPreference(v),null);try{await navigator.clipboard.writeText(message);toast('WhatsApp message copied.');}catch{toast('Could not copy automatically. Please use Book on WhatsApp.');}}
async function shareVenue(v){const url=currentUrl(v.id);try{if(navigator.share)await navigator.share({title:v.name,url});else{await navigator.clipboard.writeText(url);toast('Venue link copied.');}}catch(error){if(error.name!=='AbortError')toast('Could not share this venue.');}}
function toggleMobile(map){state.mobileMap=map;$('.app-shell').classList.toggle('mobile-map',map);$('#listToggle').classList.toggle('active',!map);$('#mapToggle').classList.toggle('active',map);if(map)setTimeout(()=>{state.map?.resize();focusResults();},50);}
function setSearch(value){state.search=value.trim();$('#search').value=value;$('#mapSearch').value=value;state.limit=10;applyFilters();focusResults();}
function initControls(){
  for(const selector of ['#search','#mapSearch'])$(selector).addEventListener('input',e=>setSearch(e.target.value));
  $('#locality').addEventListener('change',e=>{state.area=e.target.value;state.limit=10;applyFilters();focusResults();});
  $('#clearFilters').addEventListener('click',()=>{state.sport='All';state.area='';state.search='';state.limit=10;$('#search').value='';$('#mapSearch').value='';populateFilters();applyFilters();focusResults();});
  $('#loadMore').addEventListener('click',()=>{state.limit+=10;renderList();});
  $('#locate').addEventListener('click',()=>{if(!navigator.geolocation){toast('Location is unavailable on this device.');return;}navigator.geolocation.getCurrentPosition(pos=>{state.userLocation=[pos.coords.longitude,pos.coords.latitude];applyFilters();state.map?.flyTo({center:state.userLocation,zoom:12.5});toast('Showing straight-line distance from your location.');},()=>toast('Location permission was not granted. Choose an area instead.'),{enableHighAccuracy:false,timeout:10000});});
  $('#recenter').addEventListener('click',()=>state.map?.flyTo({center:cityCenter,zoom:11.3}));
  $('#cityButton').addEventListener('click',()=>toast('Gurugram is available first. More cities are coming.'));
  $('#listToggle').addEventListener('click',()=>toggleMobile(false));$('#mapToggle').addEventListener('click',()=>toggleMobile(true));
  $('#detailClose').addEventListener('click',closeDetail);$('#detailScrim').addEventListener('click',closeDetail);
  $('#pickupButton').addEventListener('click',()=>{$('#pickupOverlay').hidden=false;renderGames();});
  $('#pickupClose').addEventListener('click',()=>$('#pickupOverlay').hidden=true);$('#pickupScrim').addEventListener('click',()=>$('#pickupOverlay').hidden=true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#pickupOverlay').hidden)$('#pickupOverlay').hidden=true;else if(e.key==='Escape'&&!$('#detailOverlay').hidden)closeDetail();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();(matchMedia('(max-width:760px)').matches&&state.mobileMap?$('#mapSearch'):$('#search')).focus();}});
  window.addEventListener('popstate',()=>{const id=new URLSearchParams(location.search).get('venue');if(id&&state.venues.some(v=>v.id===id))openDetail(id,false);else if(!$('#detailOverlay').hidden)closeDetail();});
  let touchStart=null;$('.detail-panel').addEventListener('touchstart',e=>{touchStart=e.touches[0].clientY-$('.detail-panel').getBoundingClientRect().top<70?e.touches[0].clientY:null;},{passive:true});$('.detail-panel').addEventListener('touchend',e=>{if(touchStart!=null && e.changedTouches[0].clientY-touchStart>110)closeDetail();touchStart=null;},{passive:true});
}
initControls();initMap();loadVenues();
