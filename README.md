# Vocab Speak — Vocabulary & Spontaneous Speaking Trainer

A React + Vite app for practicing spontaneous
English speaking. Styled with plain per-component CSS (design tokens live as
CSS custom properties in `src/index.css`); all animations are CSS
transitions/keyframes — no UI libraries. Pick a topic, talk for 2–4 minutes,
tap a hint button if you stall, and get pace/filler-word stats when you're done.

For a detailed explanation of the user flow, modules, audio analysis, browser
data flow, privacy behavior, deployment, and current limitations, see
[PROJECT_GUIDE.md](PROJECT_GUIDE.md).

## Run it locally

```bash
npm install
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`) and allow
microphone access when prompted. Speech recognition uses the browser Web Speech
API; AI scoring requires a signed-in user and the Vercel API route.

Build for production with `npm run build`; preview that build with
`npm run preview`.

## Deploying to Vercel

Import the repo and keep the default Vite preset (build command `npm run build`,
output `dist`). The optional Supabase integration supplies the project's public
URL and publishable key at build time; connect it in Vercel and redeploy after
applying `supabase/schema.sql` in the Supabase SQL Editor. For local use, copy
`.env.example` to `.env.local` and fill in both the `VITE_SUPABASE_*` browser
values and the matching server-side `SUPABASE_*` values. Basic practice and
history need no Vercel Function. AI feedback uses a short Vercel Function; add
`GEMINI_API_KEY` as a server-only Vercel environment variable, apply the current
SQL schema, and redeploy to enable it. Microphone audio stays in the browser.

## How it works

- **Topic selection** — filter by category and difficulty, then shuffle
  until a topic feels right. Topics live in `src/data/topics.js` — add as
  many as you like, each with a title, a one-line prompt, and a list of
  rescue keywords.
- **Speaking session** — a stage-clock ring counts up toward the target
  time for the chosen difficulty (2/3/4 min). If you stall, tap
  "Stuck? Get a few words" to reveal keywords a few at a time — not the
  whole list at once, so it stays a nudge rather than a script.
- **Speech recognition** — uses the browser's Web Speech API to show live
  captions. The resulting transcript is sent to Gemini only for scoring and
  suggestions; microphone audio is not uploaded to Gemini.
- **Mic check** — optional 4-second pre-session check measures your noise
  floor (feeding the pause/voicing detectors — fluent nonstop talkers
  otherwise get undercounted), catches dead or clipping mics, and settles
  the mic permission before recognition starts.
- **Vocabulary analysis** — unique-word ratio with MATR diversity estimate,
  content-word overuse ("you said 'networking' ×9"), and keyword timing
  (early planner / spread out / late scrambler).
- **Stats** — word count, words-per-minute, filler-word count/breakdown
  (um, uh, like, you know, etc.), and how many hint keywords you actually
  used, computed in `src/lib/analyzeSpeech.js`. Gemini's verbatim live mode
  returns filler words as transcript text. Short voiced regions with no
  transcript words are still shown as possible fillers, not certain words.
- **Voice analysis** — pauses, loudness, and pitch variety measured from the
  raw waveform with the Web Audio API (`src/lib/analyzeAudio.js`,
  `src/lib/pitch.js`), so they work in any modern browser — no transcript
  needed. Auto-gain is disabled at capture time on purpose, so the volume
  stats reflect you, not your OS's gain riding.
- **Accounts and history** — optional Supabase email/password accounts save
  finished topics and transcripts to a private, per-user history. Browsing and
  practicing still work without signing in. Custom topics and streaks remain
  local to the browser.
- **AI speaking feedback** — after a signed-in user finishes a session with a
  transcript, Gemini returns a 0–100 score and 2–3 suggestions. A protected
  Vercel Function keeps the Gemini key off the browser; each account is limited
  to five evaluations per day. This uses `GEMINI_MODEL` (which can list two
  model IDs to alternate between).
- **Topics stay local** — this version uses the built-in prompt bank and
  custom prompts saved in this browser. It has no AI topic-generation or API
  key settings feature.

## Project structure

```
src/
  data/topics.js          curated offline topic bank
  hooks/useSpeechRecognition.js   mic transcription wrapper
  hooks/useAudioAnalysis.js       mic capture: loudness + pitch sampling
  hooks/useLocalStorage.js        tiny persistence helper
  lib/analyzeSpeech.js     WPM / filler-word / keyword-usage stats
  lib/analyzeAudio.js      pause / volume / pitch-variety stats
  lib/pitch.js             YIN-lite pitch detector
  components/              Header, CategoryPicker, TopicCard, TimerRing,
                            KeywordHelper, SessionScreen, StatsPanel,
                            CustomTopicModal
  App.jsx                  select -> session -> results state machine
```

## Ideas for extending it

- A fuller progress dashboard (streaks are already tracked in
  `localStorage` — `speakstage.streak` — just needs a view).
- Compare saved session scores and transcripts over time.
- Difficulty auto-adjustment based on recent WPM/filler stats.
- A "duel" mode: two topics, pick one on the spot, no shuffling allowed.
- Export session stats as a shareable image/card.
