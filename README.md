# MámNaTo?

Webová aplikace pro jednotlivce, páry i rodiny v České republice, která pomáhá pochopit finanční situaci a rozhodnout se, zda si mohou dovolit koupit nemovitost.

## Funkce

- Step-by-step průvodce (jednotlivec / pár / rodina s dětmi)
- Předvyplněné hodnoty dle průměrů ČR (ČSÚ, ČNB)
- Cash flow přehled s grafem vývoje úspor
- Kalkulačka nemovitosti (splátka, akontace, DTI/DSTI dle limitů ČNB)
- Srovnání splátka hypotéky vs. nájem
- Výhledový graf cash flow po koupi
- Rule-based finanční scénáře s doporučeními
- Tmavý / světlý režim
- Veškerá data zůstávají v prohlížeči (localStorage) — žádný backend

## Spuštění lokálně

```bash
npm install
npm run dev
# Otevřete http://localhost:5173
```

## Testy

```bash
npm run test
```

## Build

```bash
npm run build
npm run preview
```

## Nasazení na Vercel

1. Propojte repozitář s Vercelem
2. Build command: `npm run build`
3. Output directory: `dist`
## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · Recharts · Vitest
