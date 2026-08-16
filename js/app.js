const EPS = 'ε';
const EPS_ALIASES = new Set(['ε','eps','epsilon','λ','lambda','empty','none','']);
const END = '$';

const examples = {
  expr: `E  -> T E'
E' -> + T E' | ε
T  -> F T'
T' -> * F T' | ε
F  -> ( E ) | id`,
  stmt: `Stmt   -> if ( Expr ) Stmt Else | id = Expr ; | { StmtList }
Else   -> else Stmt | ε
StmtList -> Stmt StmtList | ε
Expr   -> id`,
  ll1fail: `S -> A | B
A -> id
B -> id`
};

document.getElementById('exampleSelect').addEventListener('change', e=>{
  const v = e.target.value;
  if(v && examples[v]){
    document.getElementById('grammarInput').value = examples[v];
    refreshStartSymbolOptions();
  }
  e.target.value = '';
});

document.getElementById('clearBtn').addEventListener('click', ()=>{
  document.getElementById('grammarInput').value = '';
  refreshStartSymbolOptions();
  document.getElementById('resultsWrap').innerHTML = '<div class="empty-state">Nothing computed yet — hit "Execute" on the left.</div>';
  document.getElementById('traceLog').innerHTML = '<div class="empty-state">The reasoning shows up here, line by line, once you compute.</div>';
  document.getElementById('toggleLL1').style.display = 'none';
  document.getElementById('ll1Wrap').style.display = 'none';
  document.getElementById('ll1Status').textContent = '';
  hideErr();
});

function hideErr(){ const b=document.getElementById('errBox'); b.style.display='none'; b.textContent=''; }
function showErr(msg){ const b=document.getElementById('errBox'); b.style.display='block'; b.textContent = msg; }

// ---------- Parsing ----------
function parseGrammar(text){
  const lines = text.split('\n').map(l=>l.trim()).filter(l=>l.length>0 && !l.startsWith('//'));
  if(lines.length===0) throw new Error('Grammar is empty.');

  const productions = [];
  const nonTerminals = new Set();
  const rawRules = [];
  for(const line of lines){
    const arrowMatch = line.split(/->|→|::=/);
    if(arrowMatch.length < 2) throw new Error(`Couldn't find "->" in line: "${line}"`);
    const lhs = arrowMatch[0].trim();
    const rhsPart = arrowMatch.slice(1).join('->').trim();
    if(!lhs) throw new Error(`Missing left-hand side in line: "${line}"`);
    nonTerminals.add(lhs);
    rawRules.push({lhs, rhsPart});
  }

  for(const {lhs, rhsPart} of rawRules){
    const alts = rhsPart.split('|').map(a=>a.trim());
    for(const alt of alts){
      let symbols;
      if(EPS_ALIASES.has(alt.toLowerCase())){
        symbols = [EPS];
      } else {
        symbols = alt.split(/\s+/).filter(s=>s.length>0).map(s=> EPS_ALIASES.has(s.toLowerCase()) ? EPS : s);
      }
      productions.push({ lhs, rhs: symbols });
    }
  }

  const terminals = new Set();
  for(const p of productions){
    for(const sym of p.rhs){
      if(sym!==EPS && !nonTerminals.has(sym)) terminals.add(sym);
    }
  }

  return { productions, nonTerminals:[...nonTerminals], terminals:[...terminals] };
}

function refreshStartSymbolOptions(){
  const sel = document.getElementById('startSymbol');
  sel.innerHTML = '';
  try{
    const { nonTerminals } = parseGrammar(document.getElementById('grammarInput').value);
    nonTerminals.forEach((nt)=>{
      const opt = document.createElement('option');
      opt.value = nt; opt.textContent = nt;
      sel.appendChild(opt);
    });
  }catch(e){ /* silent until compute */ }
}
document.getElementById('grammarInput').addEventListener('input', refreshStartSymbolOptions);
refreshStartSymbolOptions();

// ---------- Trace helper ----------
let traceEl;
let stepCounter = 0;
function trace(tag, html){
  stepCounter++;
  const line = document.createElement('div');
  line.className = 'trace-line';
  line.innerHTML = `<span class="step-no">${stepCounter}.</span><span class="tag ${tag}">${tag}</span><span class="msg">${html}</span>`;
  traceEl.appendChild(line);
}

// ---------- FIRST / FOLLOW computation ----------
function compute(){
  hideErr();
  traceEl = document.getElementById('traceLog');
  traceEl.innerHTML = '';
  stepCounter = 0;

  let grammar;
  try{
    grammar = parseGrammar(document.getElementById('grammarInput').value);
  }catch(e){
    showErr(e.message);
    return;
  }
  const { productions, nonTerminals, terminals } = grammar;
  if(nonTerminals.length===0){ showErr('No non-terminals found.'); return; }

  refreshStartSymbolOptions();
  const startSel = document.getElementById('startSymbol');
  const startSymbol = startSel.value || nonTerminals[0];

  trace('INFO', `Grammar read: <b>${nonTerminals.length}</b> non-terminals, <b>${terminals.length}</b> terminals, <b>${productions.length}</b> rules. Start symbol is <b>${startSymbol}</b>.`);

  const FIRST = {};
  nonTerminals.forEach(nt=> FIRST[nt] = new Set());
  terminals.forEach(t=> FIRST[t] = new Set([t]));
  FIRST[EPS] = new Set([EPS]);

  function firstOfSequence(seq){
    const result = new Set();
    let allNullable = true;
    for(const sym of seq){
      const symFirst = FIRST[sym] || new Set([sym]);
      for(const s of symFirst){ if(s!==EPS) result.add(s); }
      if(!symFirst.has(EPS)){ allNullable = false; break; }
    }
    if(allNullable) result.add(EPS);
    return result;
  }

  let changed = true;
  let pass = 1;
  while(changed){
    changed = false;
    for(const {lhs, rhs} of productions){
      const before = FIRST[lhs].size;
      if(rhs.length===1 && rhs[0]===EPS){
        if(!FIRST[lhs].has(EPS)){
          FIRST[lhs].add(EPS);
          trace('FIRST', `<span class="sym">${lhs}</span> → ε directly, so ε ∈ FIRST(${lhs}).`);
        }
      } else {
        let allNullableSoFar = true;
        for(let i=0;i<rhs.length;i++){
          const sym = rhs[i];
          const symFirst = FIRST[sym] || new Set([sym]);
          let added = [];
          for(const s of symFirst){
            if(s!==EPS && !FIRST[lhs].has(s)){ FIRST[lhs].add(s); added.push(s); }
          }
          if(added.length){
            trace('FIRST', `${lhs} → ${rhs.join(' ')} : {${added.join(', ')}} comes from FIRST(<span class="sym">${sym}</span>), goes into FIRST(<b>${lhs}</b>).`);
          }
          if(!symFirst.has(EPS)){ allNullableSoFar = false; break; }
        }
        if(allNullableSoFar && !FIRST[lhs].has(EPS)){
          FIRST[lhs].add(EPS);
          trace('FIRST', `${lhs} → ${rhs.join(' ')} : every symbol here can vanish, so ε ∈ FIRST(<b>${lhs}</b>).`);
        }
      }
      if(FIRST[lhs].size !== before) changed = true;
    }
    pass++;
    if(pass>200) break;
  }
  trace('INFO', `FIRST sets stopped changing — that's the fixed point.`);

  const FOLLOW = {};
  nonTerminals.forEach(nt=> FOLLOW[nt]=new Set());
  FOLLOW[startSymbol].add(END);
  trace('FOLLOW', `${END} ∈ FOLLOW(<span class="sym2">${startSymbol}</span>) — the start symbol always gets the end marker.`);

  changed = true; pass=1;
  while(changed){
    changed = false;
    for(const {lhs, rhs} of productions){
      for(let i=0;i<rhs.length;i++){
        const B = rhs[i];
        if(!nonTerminals.includes(B)) continue;
        const beta = rhs.slice(i+1);
        const betaFirst = firstOfSequence(beta);
        const before = FOLLOW[B].size;
        let added=[];
        for(const s of betaFirst){
          if(s!==EPS && !FOLLOW[B].has(s)){ FOLLOW[B].add(s); added.push(s); }
        }
        if(added.length){
          trace('FOLLOW', `${lhs} → ${rhs.join(' ')} : FIRST(${beta.length? beta.join(' ') : 'ε'}) gives {${added.join(', ')}} to FOLLOW(<span class="sym2">${B}</span>).`);
        }
        if(beta.length===0 || betaFirst.has(EPS)){
          let added2=[];
          for(const s of FOLLOW[lhs]){
            if(!FOLLOW[B].has(s)){ FOLLOW[B].add(s); added2.push(s); }
          }
          if(added2.length){
            trace('FOLLOW', `${lhs} → ${rhs.join(' ')} : nothing but nullable stuff comes after <span class="sym2">${B}</span> here, so FOLLOW(${lhs}) = {${added2.join(', ')}} copies straight into FOLLOW(<b>${B}</b>).`);
          }
        }
        if(FOLLOW[B].size !== before) changed = true;
      }
    }
    pass++;
    if(pass>200) break;
  }
  trace('DONE', `FOLLOW sets stopped changing too. Done.`);

  renderResults(nonTerminals, FIRST, FOLLOW, startSymbol);
  setupLL1(grammar, FIRST, FOLLOW, startSymbol);
}

function renderResults(nonTerminals, FIRST, FOLLOW, startSymbol){
  const wrap = document.getElementById('resultsWrap');
  let rows = '';
  for(const nt of nonTerminals){
    const firstChips = [...FIRST[nt]].sort().map(s=>{
      const cls = s===EPS ? 'eps' : 'first';
      return `<span class="chip ${cls}">${s}</span>`;
    }).join('');
    const followChips = [...FOLLOW[nt]].sort().map(s=>`<span class="chip follow">${s}</span>`).join('');
    rows += `<tr>
      <td class="nt-cell">${nt}${nt===startSymbol?'<span class="start-mark">start ✓</span>':''}</td>
      <td class="braceset">${firstChips}</td>
      <td class="braceset">${followChips}</td>
    </tr>`;
  }
  wrap.innerHTML = `<table>
    <thead><tr><th>non‑terminal</th><th>FIRST</th><th>FOLLOW</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ---------- LL(1) parse table ----------
function setupLL1(grammar, FIRST, FOLLOW, startSymbol){
  const { productions, nonTerminals, terminals } = grammar;
  const toggleBtn = document.getElementById('toggleLL1');
  const ll1Wrap = document.getElementById('ll1Wrap');
  const statusEl = document.getElementById('ll1Status');
  toggleBtn.style.display = 'inline-block';
  toggleBtn.textContent = 'also build the LL(1) table ▸';
  ll1Wrap.style.display = 'none';
  statusEl.textContent = '';

  toggleBtn.onclick = ()=>{
    const open = ll1Wrap.style.display === 'block';
    ll1Wrap.style.display = open ? 'none' : 'block';
    toggleBtn.textContent = open ? 'also build the LL(1) table ▸' : 'hide the LL(1) table ▾';
    if(!open) buildLL1Table();
  };

  function firstOfSequence(seq){
    const result = new Set();
    let allNullable = true;
    for(const sym of seq){
      const symFirst = FIRST[sym] || new Set([sym]);
      for(const s of symFirst){ if(s!==EPS) result.add(s); }
      if(!symFirst.has(EPS)){ allNullable=false; break; }
    }
    if(allNullable) result.add(EPS);
    return result;
  }

  function buildLL1Table(){
    const M = {};
    nonTerminals.forEach(nt=>{ M[nt] = {}; });
    let conflict = false;

    for(const {lhs, rhs} of productions){
      const seq = (rhs.length===1 && rhs[0]===EPS) ? [] : rhs;
      const fs = firstOfSequence(seq);
      for(const t of fs){
        if(t===EPS) continue;
        if(!M[lhs][t]) M[lhs][t] = [];
        M[lhs][t].push(rhs);
        if(M[lhs][t].length>1) conflict = true;
      }
      if(fs.has(EPS)){
        for(const t of FOLLOW[lhs]){
          if(!M[lhs][t]) M[lhs][t] = [];
          M[lhs][t].push(rhs);
          if(M[lhs][t].length>1) conflict = true;
        }
      }
    }

    const cols = [...terminals, END];
    let thead = '<thead><tr><th></th>' + cols.map(c=>`<th>${c}</th>`).join('') + '</tr></thead>';
    let tbody = '<tbody>';
    for(const nt of nonTerminals){
      tbody += `<tr><td class="nt-cell">${nt}</td>`;
      for(const c of cols){
        const cell = M[nt][c];
        if(!cell || cell.length===0){
          tbody += `<td class="cell-empty">·</td>`;
        } else if(cell.length===1){
          tbody += `<td class="cell-rule">${nt} → ${cell[0].join(' ')}</td>`;
        } else {
          tbody += `<td class="cell-conflict">${cell.map(r=>nt+' → '+r.join(' ')).join(' / ')}</td>`;
        }
      }
      tbody += '</tr>';
    }
    tbody += '</tbody>';
    document.getElementById('ll1Table').innerHTML = thead + tbody;

    statusEl.textContent = conflict ? 'conflicts — not LL(1)' : 'clean — this grammar is LL(1)';
    statusEl.className = 'status ' + (conflict ? 'bad' : 'ok');
  }
}

document.getElementById('computeBtn').addEventListener('click', compute);
refreshStartSymbolOptions();
