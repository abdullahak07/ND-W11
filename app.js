const $=(s,c=document)=>c.querySelector(s);
const $$=(s,c=document)=>[...c.querySelectorAll(s)];

const solved=new Set();
const evidenceTarget=15;
function earn(key){
  if(!solved.has(key)){solved.add(key);$('#evidenceCount').textContent=solved.size+' / '+evidenceTarget+' evidence items';}
}
function unlockEvidence(name,line){
  const node=$('[data-evidence="'+name+'"]'); if(node) node.classList.add('unlocked');
  if(line) $('.'+line)?.classList.add('live');
}
$$('[data-jump]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.jump)?.scrollIntoView({behavior:'smooth'})));
$('#caseReset').addEventListener('click',()=>location.reload());

// scroll progress + reveal
$$('.chapter>*').forEach(el=>{ if(!el.classList.contains('chapter-tag')) el.classList.add('reveal'); });
const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible')}),{threshold:.08});
$$('.reveal').forEach(el=>io.observe(el));
addEventListener('scroll',()=>{
  const d=document.documentElement,max=d.scrollHeight-d.clientHeight;
  $('#scrollProgress').style.width=(max?d.scrollTop/max*100:0)+'%';
},{passive:true});

// cycle explainer
const cycle=[
  '<b>1 · Identify.</b> Start with an anchor: IP, domain, hash, URL, email or another useful artefact.',
  '<b>2 · Contextualise & validate.</b> Ask why it matters, what it means, and whether the source is reliable.',
  '<b>3 · Pivot.</b> Search internal and external data sources to see where the indicator appears and what it touches.',
  '<b>4 · Discover.</b> Extract new indicators, then feed them back into contextualise → pivot. The loop continues.'
];
function setCycle(i){
  $$('[data-cycle]').forEach((b,j)=>b.classList.toggle('active',j===i));
  $('#cycleReadout').innerHTML=cycle[i];
}
$$('[data-cycle]').forEach(b=>b.addEventListener('click',()=>setCycle(+b.dataset.cycle)));
setCycle(0);

// first move
$$('#firstMove button').forEach(b=>b.addEventListener('click',()=>{
  if($('#firstMove').dataset.done)return;
  $('#firstMove').dataset.done='1';
  if(b.dataset.correct==='true'){
    b.classList.add('correct'); $('#firstMoveFeedback').textContent='Correct. Trusted source does not remove the need to validate. Start with context and corroboration.'; $('#firstMoveFeedback').className='game-feedback good'; earn('validate');
  }else{
    b.classList.add('wrong'); $('#firstMoveFeedback').textContent='Too early. First validate and contextualise the reported indicator before taking disruptive action.'; $('#firstMoveFeedback').className='game-feedback bad';
    $$('[data-correct="true"]',$('#firstMove')).forEach(x=>x.classList.add('correct'));
  }
}));

// pivot investigation
const pivotStages=[
  {
    log:['<div><i>QUESTION</i> Is the reported C2 indicator credible?</div>'],
    options:[
      {label:'WHOIS + VirusTotal',ok:true,out:['<div class="hit"><i>WHOIS</i> Registration context recovered.</div>','<div class="hit"><i>VT</i> 3 / 87 vendors flag the IP malicious; one suspicious.</div>','<div><i>ANALYST</i> External evidence supports deeper investigation, but is not proof of internal compromise.</div>'],ev:'external',line:'l1'},
      {label:'Search employee payroll',ok:false,out:['<div class="warn"><i>DEAD END</i> No clear relationship to the C2 indicator.</div>']},
      {label:'Delete the alert',ok:false,out:['<div class="warn"><i>ERROR</i> The indicator has not been validated or disproven.</div>']}
    ]
  },
  {
    log:['<div><i>QUESTION</i> Has ABC actually communicated with the indicator?</div>'],
    options:[
      {label:'Search internal network / SIEM logs',ok:true,out:['<div class="hit"><i>NETWORK</i> 172.16.99.12 repeatedly connects to 125.19.103.198.</div>','<div><i>NSLOOKUP</i> 172.16.99.12 → abc-webproxy-dmz.net.</div>','<div><i>NEXT</i> The proxy is a chokepoint. Inspect its transaction logs.</div>'],ev:'hosts',line:'l2'},
      {label:'Only search public Twitter',ok:false,out:['<div class="warn"><i>LIMIT</i> External OSINT cannot prove the indicator touched ABC.</div>']},
      {label:'Assume the provider is compromised',ok:false,out:['<div class="warn"><i>ASSUMPTION</i> You need internal evidence before claiming compromise.</div>']}
    ]
  },
  {
    log:['<div><i>QUESTION</i> Which internal clients are behind the proxy traffic?</div>'],
    options:[
      {label:'grep proxy transactions for the C2',ok:true,out:['<div class="hit"><i>PROXY</i> 192.168.8.4, .14 and .23 communicate with the C2.</div>','<div><i>URL</i> ftp://admin.test@125.19.103.198:21/sys/files/…</div>','<div><i>MIME</i> DOC/RAR suggests file exchange.</div>'],award:'proxy'},
      {label:'Ping every employee laptop',ok:false,out:['<div class="warn"><i>NOISE</i> Broad pinging does not answer which clients used the proxy to reach the C2.</div>']},
      {label:'Check printer toner levels',ok:false,out:['<div class="warn"><i>DEAD END</i> Irrelevant to the current pivot.</div>']}
    ]
  },
  {
    log:['<div><i>QUESTION</i> How do you strengthen confidence that the finding is real?</div>'],
    options:[
      {label:'Cross-check timestamps across independent logs',ok:true,out:['<div class="hit"><i>MATCH</i> Network and proxy logs align at 00:00 and 00:15 for the same hosts.</div>','<div><i>ASSESSMENT</i> Independent telemetry corroborates compromise.</div>','<div><i>ESCALATE</i> Engage incident response and forensics while continuing CTI analysis.</div>'],award:'timestamps'},
      {label:'Count how many tabs are open',ok:false,out:['<div class="warn"><i>NO VALUE</i> Browser-tab count does not corroborate the C2 relationship.</div>']},
      {label:'Trust one log source completely',ok:false,out:['<div class="warn"><i>WEAK</i> Cross-source corroboration is stronger than a single source.</div>']}
    ]
  },
  {
    log:['<div><i>QUESTION</i> You now have validated compromise. What analytical move comes next?</div>'],
    options:[
      {label:'Map evidence into Diamond + Kill Chain',ok:true,out:['<div class="hit"><i>CLASSIFY</i> Infrastructure and victim are confirmed.</div>','<div><i>GAPS</i> Adversary and capability remain unresolved.</div>','<div><i>NEXT</i> Use the gaps to drive the next pivots.</div>'],award:'framework'},
      {label:'Stop because one IP is confirmed',ok:false,out:['<div class="warn"><i>INCOMPLETE</i> You still do not know delivery, capability, objective or adversary.</div>']},
      {label:'Publish attribution immediately',ok:false,out:['<div class="warn"><i>TOO SOON</i> Attribution evidence is not yet sufficient.</div>']}
    ]
  }
];
let pivotIndex=0, pivotLocked=false;
function appendLogs(lines){const log=$('#pivotLog');lines.forEach(html=>{const wrap=document.createElement('div');wrap.innerHTML=html;const el=wrap.firstElementChild;log.appendChild(el)});log.scrollTop=log.scrollHeight}
function renderPivot(){
  $('#pivotStage').textContent='STAGE '+Math.min(pivotIndex+1,pivotStages.length)+' / '+pivotStages.length;
  const host=$('#pivotActions');host.innerHTML='';
  if(pivotIndex>=pivotStages.length){
    const b=document.createElement('button'); b.textContent='Case pivot complete ✓'; b.disabled=true;host.appendChild(b); return;
  }
  appendLogs(pivotStages[pivotIndex].log);
  pivotStages[pivotIndex].options.forEach(opt=>{
    const b=document.createElement('button');b.textContent=opt.label;
    b.onclick=()=>{
      if(pivotLocked)return;pivotLocked=true;
      appendLogs(opt.out);
      if(opt.ok){
        if(opt.ev) unlockEvidence(opt.ev,opt.line);
        earn(opt.award||opt.ev||('pivot'+pivotIndex));
        pivotIndex++;
        setTimeout(()=>{pivotLocked=false;renderPivot()},650);
      }else{
        b.style.borderColor='var(--red)';
        setTimeout(()=>{pivotLocked=false;b.style.borderColor=''},520);
      }
    };
    host.appendChild(b);
  });
}
renderPivot();

// Diamond model drag / click
let selectedEvidence=null;
const bankButtons=$$('#diamondBank button');
function placeEvidence(evBtn,slot){
  if(!evBtn||evBtn.classList.contains('used'))return;
  const correct=evBtn.dataset.type===slot.dataset.slot;
  if(correct){
    slot.classList.add('filled');slot.querySelector('b').textContent=evBtn.textContent;evBtn.classList.add('used');evBtn.classList.remove('selected');
    $('#diamondFeedback').textContent='Correct placement. The model makes confirmed evidence and gaps explicit.';$('#diamondFeedback').className='game-feedback good';
    earn('diamond-'+slot.dataset.slot);
    selectedEvidence=null;
    if($$('.vertex.filled').length===4){unlockEvidence('malware','l3');}
  }else{
    $('#diamondFeedback').textContent='That evidence does not belong on this vertex. Re-check what each Diamond vertex represents.';$('#diamondFeedback').className='game-feedback bad';
    slot.classList.add('target');setTimeout(()=>slot.classList.remove('target'),450);
  }
}
bankButtons.forEach(btn=>{
  btn.addEventListener('click',()=>{bankButtons.forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');selectedEvidence=btn});
  btn.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',btn.dataset.type+'|'+btn.textContent));
});
$$('.vertex').forEach(slot=>{
  slot.addEventListener('click',()=>placeEvidence(selectedEvidence,slot));
  slot.addEventListener('dragover',e=>{e.preventDefault();slot.classList.add('target')});
  slot.addEventListener('dragleave',()=>slot.classList.remove('target'));
  slot.addEventListener('drop',e=>{e.preventDefault();slot.classList.remove('target');const type=e.dataTransfer.getData('text/plain').split('|')[0];placeEvidence(bankButtons.find(b=>b.dataset.type===type&&!b.classList.contains('used')),slot)});
});

// inline checks
$$('.inline-choices').forEach(group=>{
  $$('button',group).forEach(b=>b.onclick=()=>{
    if(group.dataset.done)return;group.dataset.done='1';
    const ok=b.textContent.trim()===group.dataset.answer;
    b.classList.add(ok?'correct':'wrong');
    if(!ok)$$('button',group).find(x=>x.textContent.trim()===group.dataset.answer)?.classList.add('correct');
    const small=group.parentElement.querySelector('small'); if(small)small.textContent=ok?'Correct. The Kill Chain sequences the attack phases.':'Correct answer highlighted.';
  });
});

// exfil detector
$$('#trafficBars button').forEach(b=>b.onclick=()=>{
  if($('#trafficBars').dataset.done)return;$('#trafficBars').dataset.done='1';
  const ok=b.dataset.correct==='true';b.classList.add(ok?'correct':'wrong');
  if(!ok)$('#trafficBars [data-correct="true"]').classList.add('correct');
  $('#trafficFeedback').textContent=ok?'Correct. Large volume matters because it is combined with a confirmed C2 relationship and outbound FTP context.':'Volume alone is not enough. The C2-linked outbound FTP transfer is the strongest escalation candidate.';
  $('#trafficFeedback').className='game-feedback '+(ok?'good':'bad');
  if(ok){earn('exfil');unlockEvidence('exfil','l5')}
});

// memory forensics terminal
const memSteps=[
  {cmd:'pslist / pstree / psxview',out:'reader_sl.exe found under explorer.exe; no hidden processes detected.'},
  {cmd:'connscan / sockets',out:'PID 1484 communicates with 46.101.245.8:8080 — new infrastructure.'},
  {cmd:'cmdline',out:'C:\\Program Files\\Adobe\\Reader 9.0\\Reader\\Reader_sl.exe'},
  {cmd:'procdump / memdump',out:'Suspicious executable and memory region dumped to disk.'},
  {cmd:'md5deep',out:'MD5 12cf6583f5a9171a1d621ae02b4eb626 generated.'},
  {cmd:'VirusTotal lookup',out:'29 / 65 vendors flag the file malicious; trojan AcroSpeedLaunch.exe.'}
];
let memIndex=0;
const decoys=['netscan --random','format C:','delete-all-logs'];
function renderCommands(){
  const host=$('#commandPad');host.innerHTML='';
  if(memIndex>=memSteps.length){
    const b=document.createElement('button');b.textContent='Workflow complete ✓';b.disabled=true;host.appendChild(b);
    earn('memory');unlockEvidence('malware','l4');return;
  }
  const labels=[memSteps[memIndex].cmd,decoys[memIndex%decoys.length]].sort(()=>Math.random()-.5);
  labels.forEach(label=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>{
    if(label===memSteps[memIndex].cmd){
      $('#memoryScreen').insertAdjacentHTML('beforeend','<div class="prompt-line">analyst@sift:~$ '+label+'</div><div class="out hit">→ '+memSteps[memIndex].out+'</div>');
      memIndex++;renderCommands();
    }else{
      $('#memoryScreen').insertAdjacentHTML('beforeend','<div class="out" style="color:var(--red)">→ Wrong turn: this does not advance the stated forensic objective.</div>');
    }
    $('#memoryScreen').scrollTop=$('#memoryScreen').scrollHeight;
  };host.appendChild(b)});
}
renderCommands();

// attribution confidence
$$('[data-confidence]').forEach(b=>b.onclick=()=>{
  if($('.confidence-track').dataset.done)return;$('.confidence-track').dataset.done='1';
  if(b.dataset.confidence==='right'){
    b.classList.add('correct');$('#confidenceFeedback').textContent='Correct. Public reports support a likely link, but the case does not justify absolute attribution.';$('#confidenceFeedback').className='game-feedback good';earn('attribution');
  }else{
    b.classList.add('wrong');$('[data-confidence="right"]').classList.add('correct');$('#confidenceFeedback').textContent='Too strong or too dismissive. Intelligence reporting should express the supported confidence and uncertainty.';$('#confidenceFeedback').className='game-feedback bad';
  }
});

// phishing inspection
const clues={
  from:{title:'Sender persona',text:'The display name and organisation can be crafted. Treat them as claims, not proof of origin.'},
  subject:{title:'Targeted pretext',text:'A research-themed subject fits the victim’s professional interests — a classic spear-phishing tactic.'},
  attachment:{title:'Weaponized PDF',text:'research_tech.pdf contained embedded JavaScript and multiple EOF markers. It launched reader_sl.exe.'},
  received:{title:'Received chain',text:'Received headers are harder to forge convincingly. The chain exposes 194.150.215.153, which becomes a new pivot.'}
};
const foundClues=new Set();
$$('[data-clue]').forEach(b=>b.onclick=()=>{
  const c=clues[b.dataset.clue];$('#clueTitle').textContent=c.title;$('#clueText').textContent=c.text;b.classList.add('found');foundClues.add(b.dataset.clue);$('#cluesFound').textContent=foundClues.size+' / 4';
  if(foundClues.size===4){earn('phish');unlockEvidence('phish','l4')}
});

// MISP ordered builder
const mispOrder=['feeds','event','attributes','publish'];let mispIndex=0;
$$('[data-misp]').forEach((b,i)=>b.classList.toggle('current',i===0));
$$('[data-misp]').forEach(b=>b.onclick=()=>{
  if(b.classList.contains('done'))return;
  if(b.dataset.misp===mispOrder[mispIndex]){
    b.classList.add('done');b.classList.remove('current');mispIndex++;
    const msgs=[
      'Feeds enabled. External intelligence is now available for correlation.',
      'Event created with detection date, distribution and threat level.',
      'Attributes added and enrichment run across configured feeds.',
      'Event published. The investigation is now reusable organisational intelligence.'
    ];
    $('#mispScreen').textContent=msgs[mispIndex-1];$('#mispStatus').textContent=mispIndex+' / 4 steps complete';
    if(mispIndex<mispOrder.length)$('[data-misp="'+mispOrder[mispIndex]+'"]').classList.add('current');
    else earn('misp');
  }else{
    $('#mispScreen').textContent='Sequence error: complete the current highlighted step first.';
  }
});

// final quiz
const questions=[
  ['Why was 125.19.103.198 not treated as confirmed malicious immediately?',['A government source can never be trusted','Third-party reporting still needed independent validation and context','IP addresses cannot be malicious'],1],
  ['What is the four-step analysis loop?',['Identify → contextualise → pivot → discover','Block → delete → reimage → report','Scan → patch → encrypt → backup'],0],
  ['What did matching timestamps across network and proxy logs add?',['Independent corroboration','A new password','Proof of APT19 attribution'],0],
  ['Which Diamond Model vertices were initially confirmed after internal compromise?',['Adversary and capability','Infrastructure and victim','Only adversary'],1],
  ['Why was the 1–2.5+ GB outbound transfer suspicious?',['Any large transfer is automatically malicious','It combined high volume with a confirmed C2 relationship and outbound FTP context','FTP is always malware'],1],
  ['What did Volatility help the analyst do?',['Analyse memory/processes/connections and dump suspicious artefacts','Replace the firewall','Create the phishing email'],0],
  ['What was the defensible attribution conclusion?',['APT19 beyond doubt','No possible actor relationship','Public reporting supported a likely APT19/Codoso link, but not certainty'],2],
  ['What is MISP doing at the end of the workflow?',['Replacing analyst reasoning','Operationalising, correlating, storing and sharing the intelligence','Deleting all raw evidence'],1]
];
const qhost=$('#finalQuiz');let answered=0,score=0;
questions.forEach((q,i)=>{
  const card=document.createElement('article');card.className='final-q';card.innerHTML='<h3>'+(i+1)+'. '+q[0]+'</h3>';
  q[1].forEach((opt,j)=>{const b=document.createElement('button');b.textContent=opt;b.onclick=()=>{
    if(card.dataset.done)return;card.dataset.done='1';answered++;const bs=$$('button',card);bs.forEach(x=>x.disabled=true);
    if(j===q[2]){score++;b.classList.add('correct')}else{b.classList.add('wrong');bs[q[2]].classList.add('correct')}
    updateFinal();
  };card.appendChild(b)});qhost.appendChild(card);
});
const result=document.createElement('div');result.className='final-result';result.textContent='Complete all 8 questions to close the case.';qhost.appendChild(result);
function updateFinal(){
  if(answered<questions.length){result.textContent=answered+'/8 complete · current score '+score;return}
  const pct=Math.round(score/questions.length*100);
  result.innerHTML='CASE REVIEW: '+score+'/8 ('+pct+'%) · Evidence collected '+solved.size+'/'+evidenceTarget+'<br><span style="font-weight:600">'+(pct>=88?'Strong investigation: your pivots and evidence logic are defensible.':pct>=63?'Good case understanding — revisit the highlighted decisions.':'Re-run the investigation games and focus on why each pivot is justified.')+'</span>';
}

// ===== PPT deep-dive flip cards: every teaching section gets more lecture detail =====
const pptDeepDive={
  top:[
    {
      title:'What this week is really teaching',
      teaser:'One case study, three major skills.',
      bullets:[
        'Perform a threat analysis from a single reported indicator through to a fuller intrusion reconstruction.',
        'Use manual investigation skills alongside tools such as SIFT, VirusTotal, Wireshark, Hybrid Analysis and MISP.',
        'Synthesize findings into the Diamond Model and Cyber Kill Chain so evidence gaps become visible.',
        'Critically evaluate third-party intelligence rather than treating outside reporting as automatically true.',
        'The end goal is practical: identify the source of the threat and support actions that stop it.'
      ]
    },
    {
      title:'Why pivoting is the core skill',
      teaser:'A single IOC becomes an anchor for the next question.',
      bullets:[
        'An IP, hash, domain, URL or email can be the first anchor point.',
        'The analyst searches across data sources for related events, flows and artefacts.',
        'Every useful new artefact becomes another pivot target.',
        'Speed matters, so analytical and modelling skill must become repeatable and familiar.',
        'Automation is desirable, but manual proficiency remains essential when tools are unavailable or incomplete.'
      ]
    },
    {
      title:'The case-study promise',
      teaser:'The investigation is supposed to grow as evidence grows.',
      bullets:[
        'The chapter uses one continuous intrusion scenario rather than disconnected examples.',
        'It begins with a reported C2 IP and progressively reconstructs the attack.',
        'External intelligence, internal telemetry, network evidence, forensics and malware analysis all contribute.',
        'Frameworks organize the growing evidence rather than replacing investigative judgement.',
        'MISP is introduced only after the manual investigation so students understand what is being automated.'
      ]
    }
  ],
  process:[
    {
      title:'Step 1–2: identify, then validate',
      teaser:'Do not pivot blindly from an untrusted clue.',
      bullets:[
        'Start with an indicator such as an IP, domain, hash, URL, bank account or email address with metadata.',
        'Contextualization asks what the indicator means, why it matters and what scope it has.',
        'Source reliability must be judged before analyst time is committed to wider pivoting.',
        'Even a government or other third-party report still requires independent validation.',
        'Only after identification and validation should the analyst pivot through other data sources.'
      ]
    },
    {
      title:'Step 3–4: pivot, then discover',
      teaser:'This is where one indicator becomes many.',
      bullets:[
        'Search internal and/or external data to determine whether the indicator is present and how it behaves.',
        'A single IP may expose URLs, domains, files or other artefacts.',
        'Each newly discovered indicator is contextualised and validated again.',
        'The process is repeatable rather than a one-off search.',
        'Continue until the picture is sufficiently complete and no useful pivot remains.'
      ]
    },
    {
      title:'Why the process is cyclic',
      teaser:'The loop is the method, not just a diagram.',
      bullets:[
        'The objective is to progressively populate the Diamond Model and Cyber Kill Chain.',
        'Every task is performed because it may reveal evidence that closes one of those gaps.',
        'New indicators continuously feed back into earlier steps.',
        'A “finished” investigation is therefore evidence-driven, not based on completing a fixed number of searches.',
        'The realistic stop condition is enough evidence to conclude on the specific threat plus no further useful pivots.'
      ]
    }
  ],
  case:[
    {
      title:'External validation: WHOIS + VirusTotal',
      teaser:'External intelligence makes the report plausible, not final.',
      bullets:[
        'WHOIS shows registration context for 125.19.103.198, including organization and associated contact information.',
        'VirusTotal shows 3 of 87 vendors flagging the address as malicious and one as suspicious.',
        'Relations link the address with known malicious files and prior activity.',
        'A minority detection count does not automatically mean the indicator is safe.',
        'Law-enforcement reporting plus external intelligence is enough to justify an internal investigation.'
      ]
    },
    {
      title:'Internal validation: network + proxy logs',
      teaser:'Now prove whether ABC was actually touched.',
      bullets:[
        'Network telemetry shows repeated TCP sessions involving 172.16.99.12 and the reported C2.',
        'nslookup identifies 172.16.99.12 as the ABC web proxy server.',
        'Proxy logs reveal 192.168.8.4, 192.168.8.14 and 192.168.8.23 communicating with the C2.',
        'The FTP URL and DOC/RAR MIME type suggest file exchange.',
        'Independent internal hosts contacting the flagged infrastructure strongly corroborate compromise.'
      ]
    },
    {
      title:'Why timestamp matching matters',
      teaser:'Independent sources should agree on the same story.',
      bullets:[
        'Network logs and proxy logs show matching timestamp patterns for the same activity.',
        'Repeated matching timestamps reduce the chance that the finding is coincidence.',
        'Cross-source corroboration turns suspicion into a much stronger validated finding.',
        'At this stage the case should involve incident response and forensics teams.',
        'The CTI investigation still continues because delivery, capability and adversary are not yet fully explained.'
      ]
    }
  ],
  frameworks:[
    {
      title:'Initial Diamond Model state',
      teaser:'Two vertices are known, two are gaps.',
      bullets:[
        'Infrastructure: 125.19.103.198 is confirmed adversary infrastructure.',
        'Victim: 192.168.8.4, 192.168.8.14 and 192.168.8.23 are confirmed internal victims.',
        'Adversary: still unknown at this stage.',
        'Capability/TTP: also unresolved at this stage.',
        'The point of classification is to reveal exactly which question the next pivot must answer.'
      ]
    },
    {
      title:'Initial Kill Chain state',
      teaser:'Only Command & Control is firmly populated at first.',
      bullets:[
        'The COA matrix crosses seven Kill Chain phases with courses of action such as Discovery, Detect, Deny and Disrupt.',
        'At this point the confirmed C2 IP sits in the Command & Control phase.',
        'Reconnaissance through Installation remain mostly empty.',
        'An empty phase is not failure — it is a prioritized research gap.',
        'The proxy URL structure becomes the next useful pivot because it may expose more infrastructure and capability.'
      ]
    },
    {
      title:'Why both frameworks are needed',
      teaser:'They answer different questions about the same evidence.',
      bullets:[
        'The Diamond Model asks who and what: adversary, infrastructure, victim and capability.',
        'The Kill Chain asks when and how far the intrusion progressed.',
        'Each attack phase may have its own Diamond event.',
        'Empty Diamond vertices and empty Kill Chain phases both reveal missing evidence.',
        'Together they feed CTI reporting and the course-of-action matrix.'
      ]
    }
  ],
  host:[
    {
      title:'Exfiltration: volume plus context',
      teaser:'Large traffic alone is not proof.',
      bullets:[
        'The analyst checks outbound FTP, HTTP and SMTP activity with attention to TCP ports 20 and 21.',
        'More than 1 GB is sent to the known C2 from three hosts and more than 2.5 GB from a fourth.',
        'Large transfers can be normal in some organizations, so volume alone is not enough.',
        'The known C2 relationship and outbound FTP context make the transfer much more significant.',
        'Packet analysis is then used to understand exactly what left the network.'
      ]
    },
    {
      title:'Wireshark exposes plain FTP',
      teaser:'Raw packets reveal credentials and file movement.',
      bullets:[
        'The packet capture shows USER and PASS exchanges in plaintext.',
        'A RETR command downloads file1.exe.',
        'A STOR command transmits collected_data.rar.',
        'The observed protocol details clarify the attack methodology and impact.',
        'With SFTP, the content would be much more difficult to inspect directly because the session is encrypted.'
      ]
    },
    {
      title:'Memory-forensics workflow',
      teaser:'Process → connection → path → dump → hash.',
      bullets:[
        'pslist / pstree / psxview identifies reader_sl.exe running under explorer.exe.',
        'connscan / sockets links a process to 46.101.245.8:8080, revealing new infrastructure.',
        'cmdline resolves the full Adobe Reader path.',
        'procdump / memdump extracts the suspicious executable and memory region.',
        'md5deep produces a hash that VirusTotal confirms as malicious with 29 of 65 vendors flagging it.'
      ]
    }
  ],
  malware:[
    {
      title:'Static vs dynamic malware analysis',
      teaser:'Structure and behaviour answer different questions.',
      bullets:[
        'Dynamic analysis observes what the malware does when executed.',
        'Code/static analysis examines structure and artefacts directly.',
        'VirusTotal provides detection, detail, relation and behaviour views.',
        'Sandbox behaviour includes opening files, writing files, deleting Windows logs and changing the registry.',
        'Hybrid Analysis provides additional behavioural detail beyond a simple hash reputation check.'
      ]
    },
    {
      title:'MITRE ATT&CK mapping',
      teaser:'Observed behaviour becomes structured capability.',
      bullets:[
        'The case maps behaviour such as Service Execution, Hooking, Software Packaging and Application Window Discovery.',
        'It also includes Query Registry, System Time Discovery, RDP-related activity and Data Compressed.',
        'Mapped tactics span Execution, Persistence, Privilege Escalation, Defense Evasion, Credential Access, Discovery, Lateral Movement and Exfiltration.',
        'These findings help fill the capability/TTP vertex of the Diamond Model.',
        'They also strengthen the middle and later phases of the Kill Chain.'
      ]
    },
    {
      title:'Project Cobra + cautious attribution',
      teaser:'Motive becomes clearer, attribution remains probabilistic.',
      bullets:[
        'collected_data.rar contains engineering documents tied to a project called Cobra.',
        'The stolen material includes design and product-strategy information, supporting an espionage hypothesis.',
        'Public reports connect the malware with APT19 / Codoso.',
        'The adversary vertex is still the hardest part of the Diamond Model to fill with high confidence.',
        'Analysts should report the relationship as supported or likely when the evidence does not justify certainty.'
      ]
    }
  ],
  rootcause:[
    {
      title:'Weaponized PDF',
      teaser:'The backdoor traces back to research_tech.pdf.',
      bullets:[
        'research_tech.pdf and a temporary executable are found in Outlook temporary files.',
        'The PDF contains embedded JavaScript that launches reader_sl.exe.',
        'pdf-parser shows 12 end-of-file markers, which is highly unusual for a genuine PDF.',
        'The file is therefore treated as a weaponized document carrying a malicious payload.',
        'Its location in Outlook temporary files points the investigation toward email delivery.'
      ]
    },
    {
      title:'Spear-phishing delivery',
      teaser:'A believable research pretext caused the human click.',
      bullets:[
        'The victim receives a research-themed email with the malicious PDF attached.',
        'The email persona claims to be Catherine Majabu from a fictitious EXX group.',
        'The victim replies to thank the sender, supporting a successful social-engineering interaction.',
        'The targeted and personalized message is a textbook spear-phishing delivery vector.',
        'The organizational lesson is continuous phishing-awareness training.'
      ]
    },
    {
      title:'Headers, passive DNS and reconnaissance',
      teaser:'Rewind further to learn how the attacker selected the victim.',
      bullets:[
        'Most email fields can be spoofed, but the Received chain is much harder to falsify convincingly.',
        'The chain exposes 194.150.215.153, which VirusTotal partially flags and passive DNS links to suspicious domains.',
        'ABC had publicly named department heads and published their email addresses.',
        'Apache logs show 41.168.5.201 repeatedly visiting those employee pages.',
        'The visits occur nearly three months before the intrusion, consistent with deliberate reconnaissance.'
      ]
    }
  ],
  misp:[
    {
      title:'The full indicator pivot chain',
      teaser:'Seven linked events reconstruct the intrusion end to end.',
      bullets:[
        'Reconnaissance: public staff pages and email addresses expose targets.',
        'Delivery: spear-phishing from 194.150.215.153 carries research_tech.pdf.',
        'Exploit/install: the weaponized PDF triggers and installs reader_sl.exe / executable.1640.exe.',
        'Command and Control: the malware calls 125.19.103.198 using the /sys/files/ path.',
        'Actions on objectives: Project Cobra data is exfiltrated to 46.168.5.140 using FTP/HTTP.'
      ]
    },
    {
      title:'Why automation comes after manual skill',
      teaser:'Tools scale reasoning; they do not create it.',
      bullets:[
        'The manual case required many individually validated pivots across different tools and data sources.',
        'SIEM and TIP products can simplify correlation and dissemination.',
        'A CTI analyst should still understand log formats, pivot logic and manual intrusion analysis.',
        'Without manual literacy, automated outputs are harder to validate or troubleshoot.',
        'MISP operationalizes a process the analyst already understands.'
      ]
    },
    {
      title:'MISP operational workflow',
      teaser:'Feeds → event → attributes → enrichment → publish.',
      bullets:[
        'Enable built-in or custom feeds so external indicators can be correlated.',
        'Create an event with detection date, distribution setting and threat level.',
        'Add Cyber Kill Chain outputs as attributes, starting with infrastructure such as the C2 IP.',
        'Enrich the event to pull in further correlated information from configured feeds.',
        'Publish only when ready so the analysis becomes reusable intelligence for the organization or wider community.'
      ]
    }
  ],
  final:[
    {
      title:'Five chapter takeaways',
      teaser:'The whole lecture in five statements.',
      bullets:[
        'Pivoting is the core skill: identify, contextualise, pivot and discover repeatedly.',
        'Diamond Model and Kill Chain work together to track actor, infrastructure, victim, capability and phase.',
        'Packet and memory forensics help answer how the intrusion happened.',
        'Attribution supports action but may remain uncertain.',
        'MISP turns a one-off investigation into reusable, shareable organizational intelligence.'
      ]
    },
    {
      title:'Checklist for your next investigation',
      teaser:'A transferable method beyond this case.',
      bullets:[
        'Start with one validated indicator instead of chasing every lead at once.',
        'Pivot externally and internally because the two views complement one another.',
        'Cross-reference independent sources so evidence is corroborated.',
        'Update frameworks as you go; empty vertices and phases tell you where to dig next.',
        'Capture and share the result so the investigation benefits more than one analyst.'
      ]
    },
    {
      title:'What the tools contributed',
      teaser:'Different tools answered different questions.',
      bullets:[
        'WHOIS and VirusTotal provided external context and reputation.',
        'Network and proxy logs established internal contact and victim hosts.',
        'Wireshark exposed packet-level FTP activity.',
        'SIFT / Volatility reconstructed processes, connections and malicious files.',
        'MISP stored, correlated, enriched and shared the completed CTI case.'
      ]
    }
  ]
};

function buildPptDive(sectionId,cards){
  const section=document.getElementById(sectionId);
  if(!section||section.querySelector('.ppt-dive'))return;
  const wrap=document.createElement('section');
  wrap.className='ppt-dive';
  wrap.innerHTML='<div class="ppt-dive-head"><div><span>PPT DEEP DIVE</span><h3>Flip for the lecture detail behind this section</h3></div><div class="ppt-dive-tools"><button type="button" class="ppt-flip-all">Flip all</button><button type="button" class="ppt-front-all">Fronts</button></div></div><div class="ppt-card-grid"></div>';
  const grid=wrap.querySelector('.ppt-card-grid');

  cards.forEach((card,index)=>{
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='ppt-flip';
    btn.setAttribute('aria-pressed','false');
    btn.innerHTML='<div class="ppt-flip-inner"><div class="ppt-face ppt-front"><small>DETAIL '+String(index+1).padStart(2,'0')+'</small><h4>'+card.title+'</h4><p>'+card.teaser+'</p><em>CLICK TO FLIP ↻</em></div><div class="ppt-face ppt-back"><h4>'+card.title+'</h4><ul>'+card.bullets.map(x=>'<li>'+x+'</li>').join('')+'</ul></div></div>';
    btn.addEventListener('click',()=>{
      const on=!btn.classList.contains('flipped');
      btn.classList.toggle('flipped',on);
      btn.setAttribute('aria-pressed',on?'true':'false');
    });
    grid.appendChild(btn);
  });

  const header=section.querySelector('.chapter-head');
  if(header) header.insertAdjacentElement('afterend',wrap);
  else{
    const heroGrid=section.querySelector('.hero-grid');
    if(heroGrid) heroGrid.insertAdjacentElement('afterend',wrap);
    else section.prepend(wrap);
  }

  wrap.querySelector('.ppt-flip-all').addEventListener('click',()=>$$('.ppt-flip',wrap).forEach(c=>{c.classList.add('flipped');c.setAttribute('aria-pressed','true')}));
  wrap.querySelector('.ppt-front-all').addEventListener('click',()=>$$('.ppt-flip',wrap).forEach(c=>{c.classList.remove('flipped');c.setAttribute('aria-pressed','false')}));
}
Object.entries(pptDeepDive).forEach(([id,cards])=>buildPptDive(id,cards));
