// Integration contract and local simulator only. Never connect this module to a live
// WhatsApp number or payment provider without authoritative Sportozen services.
export class BookingWorkflow {
  constructor(services) { this.services=services; this.sessions=new Map(); this.messageIds=new Set(); this.paymentIds=new Set(); }

  async onMessage({ id, from, reference, text }) {
    if (!id || !from || !reference) throw new Error('message id, sender and enquiry reference required');
    if (this.messageIds.has(id)) return { duplicate:true };
    this.messageIds.add(id);
    let session=this.sessions.get(reference);
    if (!session) {
      const enquiry=await this.services.getEnquiry(reference);
      if (!enquiry) return { state:'staff', reply:'I cannot find that enquiry. A Sportozen teammate will help you.' };
      session={ reference, from, venueId:enquiry.venueId, sport:enquiry.sport, state:'selecting_date' };
      this.sessions.set(reference,session);
      return { state:session.state, reply:`You selected ${enquiry.sport} at ${enquiry.venueName}. Which date would you like? Reply YYYY-MM-DD.` };
    }
    if (session.from!==from) return { state:'staff', reply:'This enquiry belongs to a different chat. Please contact Sportozen support.' };
    if (/^(help|human|agent)$/i.test(text.trim())) { session.state='staff'; return {state:'staff',reply:'A Sportozen teammate will take over this enquiry.'}; }
    if (session.state==='selecting_date') {
      if(!/^\d{4}-\d{2}-\d{2}$/.test(text.trim())) return {state:session.state,reply:'Please send a date as YYYY-MM-DD.'};
      session.date=text.trim();
      const slots=await this.services.getAvailableSlots(session.venueId,session.sport,session.date);
      if(!slots?.length){session.state='staff';return {state:'staff',reply:'Live slots are unavailable. A teammate will confirm options with you.'};}
      session.slots=slots;session.state='selecting_slot';
      return {state:session.state,reply:`Available options:\n${slots.map((s,i)=>`${i+1}. ${s.label}`).join('\n')}\nReply with an option number.`};
    }
    if(session.state==='selecting_slot'){
      const index=Number(text.trim())-1;const slot=session.slots?.[index];
      if(!slot)return {state:session.state,reply:'Please reply with one of the listed option numbers.'};
      const quote=await this.services.quote(session.venueId,slot.id);
      if(!quote || !Number.isFinite(quote.total))return {state:session.state,reply:'Price could not be confirmed. A teammate will help.'};
      const hold=await this.services.hold(session.venueId,slot.id,reference);
      if(!hold){session.state='selecting_date';return {state:session.state,reply:'That slot was just taken. Please choose another date.'};}
      session.slot=slot;session.quote=quote;session.hold=hold;session.state='payment_pending';
      return {state:session.state,reply:`Slot held until ${hold.expiresAt}. Total: ${quote.currency} ${quote.total}. Cancellation terms: ${quote.cancellationTerms}. Payment instructions will be sent by Sportozen.`,holdId:hold.id};
    }
    if(session.state==='payment_pending')return {state:session.state,reply:'Payment is pending. Please use the Sportozen payment instructions or ask for help.'};
    if(session.state==='confirmed')return {state:session.state,reply:`Your booking is confirmed. Reference: ${session.bookingReference}.`};
    return {state:session.state,reply:'A Sportozen teammate will help with this enquiry.'};
  }

  async onVerifiedPayment({ id, reference, holdId, providerEvent }) {
    if(!id || !reference || !holdId)throw new Error('payment event id, enquiry and hold required');
    if(this.paymentIds.has(id))return {duplicate:true};
    const session=this.sessions.get(reference);
    if(session?.state==='confirmed' && session.hold?.id===holdId)return {state:'confirmed',duplicate:true,bookingReference:session.bookingReference};
    if(!session || session.hold?.id!==holdId || session.state!=='payment_pending')return {state:'recovery',reason:'No matching pending hold; investigate payment manually.'};
    const verified=await this.services.verifyPayment(providerEvent,holdId,session.quote.total);
    if(!verified)return {state:'failed',reason:'Payment was not verified.'};
    this.paymentIds.add(id);
    try{
      const booking=await this.services.confirm(holdId,reference,id);
      session.state='confirmed';session.bookingReference=booking.reference;
      return {state:'confirmed',reply:`Booking confirmed: ${booking.reference}. ${session.date}, ${session.slot.label}. ${booking.address}`};
    }catch{
      session.state='recovery';await this.services.alertStaff({reference,holdId,paymentEventId:id});
      return {state:'recovery',reason:'Payment verified but booking confirmation failed; staff alerted.'};
    }
  }
}

export class OfficialWhatsAppProviderAdapter {
  verifyWebhook() { throw new Error('Configure the existing official WhatsApp provider and webhook signature verification.'); }
  normalizeInbound() { throw new Error('Configure the existing provider message schema.'); }
  sendMessage() { throw new Error('Configure the existing provider outbound API.'); }
}
