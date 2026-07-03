import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { to, subject, body, pdfUrl } = await req.json();

    if (!to || !subject) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, subject' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Default recipient if not provided
    const recipient = to || 'georgios.meli@un.org';

    // Fetch PDF as base64 if URL provided
    let attachments: Array<{ filename: string; content: string; type: string; disposition: string }> = [];
    if (pdfUrl) {
      try {
        const pdfResp = await fetch(pdfUrl);
        const pdfBuffer = await pdfResp.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
        const filename = pdfUrl.split('/').pop() || 'waybill.pdf';
        attachments = [{ filename, content: base64, type: 'application/pdf', disposition: 'attachment' }];
      } catch (e) {
        console.warn('Failed to fetch PDF for attachment:', e);
      }
    }

    const emailPayload: Record<string, unknown> = {
      from: 'WDMS <noreply@resend.dev>',
      to: [recipient],
      subject,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#2563EB">Water Distribution Management System</h2>
        <p>${body || 'Please find attached the final approved Water Bottles Delivery Waybill.'}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="color:#6b7280;font-size:12px">This is an automated notification from WDMS.</p>
      </div>`,
    };

    if (attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    const resendData = await resendResp.json();

    if (!resendResp.ok) {
      console.error('Resend error:', resendData);
      return new Response(JSON.stringify({ error: resendData.message || 'Email sending failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('send-email error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
