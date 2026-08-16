# FIRST( ) / FOLLOW( ) — Grammar Worksheet

A browser-based tool that computes FIRST and FOLLOW sets for a context-free
grammar, shows the derivation step by step, and can optionally build the
LL(1) parsing table.

## Running it

No build step, no server needed. Just open `index.html` in a browser.

```
first-follow-project/
├── index.html      # page structure
├── css/
│   └── style.css   # all styling
├── js/
│   └── app.js       # grammar parsing + FIRST/FOLLOW/LL(1) logic
└── README.md
```

## Grammar input format

One production per line:

```
A -> alpha1 | alpha2
```

- Arrows: `->`, `→`, or `::=`
- Symbols separated by spaces
- Epsilon: `ε`, `eps`, `epsilon`, or `λ`
- Any symbol starting with a capital letter is treated as a non-terminal;
  everything else is a terminal.

## What it computes

1. **FIRST sets** — via fixed-point iteration over all productions until no
   set changes.
2. **FOLLOW sets** — same fixed-point approach, seeded with `$` on the start
   symbol.
3. **LL(1) parsing table** (optional, toggle in the results panel) — flags
   conflicting cells if the grammar isn't LL(1).

Every rule application is logged to the trace panel so you can follow (or
double-check) the reasoning by hand.
