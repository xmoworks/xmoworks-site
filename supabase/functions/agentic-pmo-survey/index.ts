const origins = new Set(['https://xmoworks.ae','https://www.xmoworks.ae']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const choices: Record<string,string[]> = {
  role:['pm','pmo','consultant','delivery','executive','other'],
  pain:['scope','decisions','risks','reporting','capacity','none','other'],
  gain:['budget','confidence','speed','capacity','value','other'],
  frequency:['none','once','2-5','6+','unknown'],
  impact_type:['','time','cost','delay','qualitative','unknown']
};
const ranges: Record<string,string[]> = {time:['','under2','2-8','9-24','25+','unknown'],cost:['','under1k','1k-5k','5k-20k','20k+','unknown'],delay:['','under1','1-3','4-10','10+','unknown']};
Deno.serve(async req => {
  const origin = req.headers.get('origin') || '';
  const headers: Record<string,string> = {'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if (origins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info';
  headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  const reply = (data: unknown,status=200) => new Response(JSON.stringify(data),{status,headers});
  if (!origins.has(origin)) return reply({error:'origin_not_allowed'},403);
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if (req.method !== 'POST') return reply({error:'method_not_allowed'},405);
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 10000) return reply({error:'request_too_large'},413);
    const b = JSON.parse(raw);
    if (b.website) return reply({error:'submission_rejected'},400);
    if (!['agentic-pmo-v1','agentic-pmo-v1.1'].includes(b.schema_version) || !uuid.test(b.submission_id)) return reply({error:'invalid_submission'},400);
    if (typeof b.opt_in !== 'boolean' || typeof b.is_test !== 'boolean') return reply({error:'invalid_flags'},400);
    const v11 = b.schema_version === 'agentic-pmo-v1.1';
    const a = b.answers;
    if (!a || typeof a !== 'object' || Array.isArray(a)) return reply({error:'answers_required'},400);
    const answers: Record<string,unknown> = {};
    for (const [key,values] of Object.entries(choices)) {
      const allowed = [...values];
      if (v11 && ['role','pain','gain','frequency'].includes(key)) allowed.push('not_applicable');
      if (v11 && key === 'gain') allowed.push('none');
      const value = key === 'impact_type' ? (a[key] ?? '') : a[key];
      if (!allowed.includes(value)) return reply({error:'invalid_'+key},400);
      answers[key] = value;
    }
    if (a.pain === 'none' && a.frequency !== 'none') return reply({error:'invalid_frequency'},400);
    if (v11 && a.pain === 'not_applicable' && a.frequency !== 'not_applicable') return reply({error:'invalid_frequency'},400);
    if (v11 && ['none','not_applicable'].includes(a.pain) && (!['','unknown'].includes(a.impact_type ?? '') || (a.impact_range ?? '') !== '' || (a.impact_note ?? '') !== '')) return reply({error:'impact_must_be_skipped'},400);
    for (const [key,max] of Object.entries({context:120,impact_note:200,example:500})) {
      if (typeof (a[key] ?? '') !== 'string' || (a[key] ?? '').length > max) return reply({error:'invalid_'+key},400);
      answers[key] = (a[key] ?? '').trim();
    }
    const allowedRanges = ranges[String(answers.impact_type)] || [''];
    if (!allowedRanges.includes(a.impact_range ?? '')) return reply({error:'invalid_range'},400);
    answers.impact_range = a.impact_range ?? '';
    for (const [key,allowed] of Object.entries({workaround:['manual','pm_tool','generic_ai','specialist','other','none'],host:['m365','copilot_studio','chatgpt','claude','other','none']})) {
      if (!Array.isArray(a[key]) || a[key].length > allowed.length || a[key].some((v: unknown) => typeof v !== 'string' || !allowed.includes(v))) return reply({error:'invalid_'+key},400);
      if (v11 && (new Set(a[key]).size !== a[key].length || (a[key].includes('none') && a[key].length !== 1))) return reply({error:'exclusive_'+key},400);
      answers[key] = [...new Set(a[key])].sort();
    }
    if (v11) {
      for (const name of ['role_other','pain_other','gain_other','workaround_other','host_other']) {
        if (a[name] !== undefined && (typeof a[name] !== 'string' || a[name].length > 200)) return reply({error:'invalid_'+name},400);
        if (a[name] !== undefined) answers[name] = a[name].trim();
      }
      if (a.host_permission !== undefined) {
        if (!['not_asked','approved','personal_only','approval_needed','not_permitted','unknown'].includes(a.host_permission)) return reply({error:'invalid_host_permission'},400);
        answers.host_permission = a.host_permission;
      }
      const allowedKeys = new Set([...Object.keys(choices),'context','impact_note','example','impact_range','workaround','host','role_other','pain_other','gain_other','workaround_other','host_other','host_permission']);
      if (Object.keys(a).some(k => !allowedKeys.has(k))) return reply({error:'unexpected_answer_field'},400);
    }
    if (!b.opt_in && b.email !== null) return reply({error:'email_requires_opt_in'},400);
    const email = b.opt_in && typeof b.email === 'string' ? b.email.trim().toLowerCase() : null;
    if (b.opt_in && (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return reply({error:'valid_email_required'},400);
    const source: Record<string,string> = {};
    for (const key of ['utm_source','utm_medium','utm_campaign','utm_content']) {
      const value = b.source?.[key];
      if (value !== undefined && (typeof value !== 'string' || !/^[a-zA-Z0-9_ .:\/-]{1,120}$/.test(value))) return reply({error:'invalid_source'},400);
      if (value) source[key] = value;
    }
    const row = {id:b.submission_id,schema_version:b.schema_version,answers,source,opt_in:b.opt_in,email,is_test:b.is_test,consent_version:b.opt_in?'agentic-early-access-v1':null};
    const bytes = new TextEncoder().encode(JSON.stringify(row));
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
    const url = Deno.env.get('SUPABASE_URL')!+'/rest/v1/agentic_pmo_survey_responses';
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const auth = {apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
    // A replay returns only the same stored receipt, never answers or contact data.
    const previous = await fetch(url+'?id=eq.'+row.id+'&select=id,received_at,payload_hash',{headers:auth});
    if (!previous.ok) throw new Error('receipt_lookup_failed');
    const existing = await previous.json();
    if (existing.length) return existing[0].payload_hash === digest ? reply({ok:true,submission_id:existing[0].id,received_at:existing[0].received_at}) : reply({error:'submission_conflict'},409);
    // Small global admission ceiling protects the bounded discovery campaign.
    const since = new Date(Date.now()-60000).toISOString();
    const rate = await fetch(url+'?received_at=gte.'+encodeURIComponent(since)+'&select=id&limit=60',{headers:auth});
    if (!rate.ok) throw new Error('admission_check_failed');
    if ((await rate.json()).length >= 60) return reply({error:'busy_try_later'},429);
    const saved = await fetch(url+'?select=id,received_at',{method:'POST',headers:{...auth,Prefer:'return=representation'},body:JSON.stringify({...row,payload_hash:digest})});
    if (!saved.ok) {
      if (saved.status === 409) return reply({error:'retry_same_submission'},409);
      throw new Error('capture_failed');
    }
    const receipt = (await saved.json())[0];
    if (!receipt?.id || !receipt?.received_at) throw new Error('capture_unconfirmed');
    return reply({ok:true,submission_id:receipt.id,received_at:receipt.received_at},201);
  } catch (_) { return reply({error:'capture_unconfirmed_retry_same_submission'},400); }
});
