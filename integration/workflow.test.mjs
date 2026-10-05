import test from 'node:test';
import assert from 'node:assert/strict';
import { BookingWorkflow } from './workflow.mjs';

test('duplicate inbound and payment events cannot create duplicate bookings',async()=>{
  let confirmations=0;
  const flow=new BookingWorkflow({
    getEnquiry:async()=>({venueId:'v1',venueName:'Test Court',sport:'Badminton'}),
    getAvailableSlots:async()=>[{id:'s1',label:'18:00–18:30'}],
    quote:async()=>({currency:'INR',total:500,cancellationTerms:'Test only'}),
    hold:async()=>({id:'h1',expiresAt:'soon'}),
    verifyPayment:async()=>true,
    confirm:async()=>{confirmations++;return {reference:'B1',address:'Test address'};},
    alertStaff:async()=>{}
  });
  const base={from:'customer',reference:'E1'};
  assert.equal((await flow.onMessage({...base,id:'m1',text:'start'})).state,'selecting_date');
  assert.equal((await flow.onMessage({...base,id:'m1',text:'start'})).duplicate,true);
  assert.equal((await flow.onMessage({...base,id:'m2',text:'2026-10-07'})).state,'selecting_slot');
  assert.equal((await flow.onMessage({...base,id:'m3',text:'1'})).state,'payment_pending');
  assert.equal((await flow.onVerifiedPayment({id:'p1',reference:'E1',holdId:'h1',providerEvent:{}})).state,'confirmed');
  assert.equal((await flow.onVerifiedPayment({id:'p1',reference:'E1',holdId:'h1',providerEvent:{}})).duplicate,true);
  assert.equal((await flow.onVerifiedPayment({id:'p2',reference:'E1',holdId:'h1',providerEvent:{}})).duplicate,true);
  assert.equal(confirmations,1);
});

test('verified payment with failed confirmation is routed to recovery',async()=>{
  const alerts=[];
  const flow=new BookingWorkflow({
    getEnquiry:async()=>({venueId:'v1',venueName:'Test Court',sport:'Football'}),
    getAvailableSlots:async()=>[{id:'s1',label:'19:00–20:00'}],
    quote:async()=>({currency:'INR',total:800,cancellationTerms:'Test only'}),
    hold:async()=>({id:'h2',expiresAt:'soon'}),
    verifyPayment:async()=>true,
    confirm:async()=>{throw new Error('booking service unavailable');},
    alertStaff:async details=>alerts.push(details)
  });
  const base={from:'customer',reference:'E2'};
  await flow.onMessage({...base,id:'a1',text:'start'});
  await flow.onMessage({...base,id:'a2',text:'2026-10-07'});
  await flow.onMessage({...base,id:'a3',text:'1'});
  assert.equal((await flow.onVerifiedPayment({id:'pay1',reference:'E2',holdId:'h2',providerEvent:{}})).state,'recovery');
  assert.equal(alerts.length,1);
});
