import { createInterface } from 'node:readline';
import { BookingWorkflow } from './workflow.mjs';

// Local terminal-only simulation. Slots, prices and payment events below are fake.
const services={
  async getEnquiry(reference){return reference==='DEMO-1'?{venueId:'demo-venue',venueName:'Demo Venue',sport:'Badminton'}:null;},
  async getAvailableSlots(){return [{id:'slot-1',label:'18:00–18:30 (30 min)'},{id:'slot-2',label:'18:00–19:00 (60 min)'}];},
  async quote(_venueId,slotId){return {currency:'INR',total:slotId==='slot-1'?400:700,cancellationTerms:'Demo terms only; confirm real policy with Sportozen.'};},
  async hold(_venueId,slotId,reference){return {id:`${reference}-${slotId}`,expiresAt:'10 minutes from now (demo)'};},
  async verifyPayment(event){return event?.simulatedPaid===true;},
  async confirm(_holdId,reference){return {reference:`BOOK-${reference}`,address:'Demo address only'};},
  async alertStaff(details){process.stderr.write(`SIMULATED STAFF ALERT ${JSON.stringify(details)}\n`);}
};
const flow=new BookingWorkflow(services);
const input=createInterface({input:process.stdin,output:process.stdout,prompt:'demo> '});
process.stdout.write('Local-only demo. Enquiry DEMO-1. Enter a message, or type "paid" to simulate a verified payment. Nothing is sent to WhatsApp or a payment provider.\n');
let nextId=1;
input.prompt();
input.on('line',async line=>{
  try{
    const session=flow.sessions.get('DEMO-1');
    const result=line.trim().toLowerCase()==='paid'?await flow.onVerifiedPayment({id:`fake-pay-${nextId++}`,reference:'DEMO-1',holdId:session?.hold?.id,providerEvent:{simulatedPaid:true}}):await flow.onMessage({id:`fake-msg-${nextId++}`,from:'local-demo',reference:'DEMO-1',text:line});
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }catch(error){process.stderr.write(`${error.message}\n`);}input.prompt();
});
