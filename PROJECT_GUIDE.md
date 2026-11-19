# Vocab Speak — Project Guide

> A guided speaking-practice app that gives you a topic, a few rescue words, and a useful picture of how your speaking session went.

This guide describes the **current code in this repository**. It is intended for someone who wants to run the app, understand how its features work, change the UI, or safely extend the project.

---

## Contents

- [What the app does](#what-the-app-does)
- [Run it locally](#run-it-locally)
- [A complete session, from click to results](#a-complete-session-from-click-to-results)
- [How the analysis works](#how-the-analysis-works)
- [Browser APIs, privacy, and external services](#browser-apis-privacy-and-external-services)
- [Accounts and session history](#accounts-and-session-history)
- [AI speaking feedback](#ai-speaking-feedback)
- [Project map](#project-map)
- [Local storage and session data](#local-storage-and-session-data)
- [Visual design](#visual-design)
- [Build and deploy on Vercel](#build-and-deploy-on-vercel)
- [Current limitations and implementation notes](#current-limitations-and-implementation-notes)
- [Good places to extend the app](#good-places-to-extend-the-app)

---

## What the app does

Vocab Speak helps a person practise speaking continuously in English without preparing a script first. It is a single-page React app with three screens:

1. **Choose a topic.** Filter prompts by category and difficulty, spin for another topic, or add a personal prompt.
2. **Speak.** A timer tracks the session. The user can reveal rescue keywords in groups of three. If supported, the browser transcribes speech while the app records and samples microphone audio.
3. **Review.** The app calculates transcript and voice indicators and presents them as stat cards, notes, a volume curve, and an estimated transcript heatmap.

The built-in exercise is usable without an account or app server. Optional Supabase email/password accounts let a user keep a private history of finished topics and transcripts. It is not an English certification tool: its numbers are practice feedback, and several depend on browser transcription and microphone conditions.

### Topics and levels

The offline topic bank contains **30 prompts** in six categories: History, Society, Technology, Personal, World & Nature, and Business. Each prompt has a title, a short instruction, a difficulty, and rescue keywords.

| Difficulty | Target time | Prompt style |
|---|---:|---|
| Beginner | 2 minutes | Familiar, concrete subjects |
| Intermediate | 3 minutes | Subjects that invite some nuance |
| Advanced | 4 minutes | More abstract or debatable questions |

The target time is a guide, not a forced stop. The speaker may finish earlier or keep going after reaching the target.

---

## Run it locally

Requirements: Node.js and npm versions compatible with the installed Vite 8 toolchain.

```bash
npm install
npm run dev
```

Open the local address printed by Vite, usually `http://localhost:5173`. Microphone capture works on localhost and on secure HTTPS pages. Allow microphone access when prompted.

Useful commands:

```bash
npm run build       # create the static production build in dist/
npm run preview     # serve the production build locally
node scripts/test-audio-libs.mjs  # run the pure-library and UI-render checks
```

The analysis check script prints its results to the terminal; it does not create a report file by default.

---

## A complete session, from click to results

```mermaid
flowchart TD
    A[Topic selection] --> B[Choose filters or spin]
    B --> C[Start session]
    C --> D{Microphone available?}
    D -- Yes --> E[Open one microphone stream]
    D -- No --> F[Timer-only session]
    E --> G[Waveform sampling]
    E --> H[Gemini Live transcription]
    E --> I[MediaRecorder capture]
    F --> J[Finish]
    G --> J
    H --> J
    I --> J
    J --> K[Calculate transcript, vocabulary, and audio metrics]
    K --> L[Results screen]
    L --> M{Signed in and configured?}
    M -- Yes --> N[Save topic and transcript to Supabase]
```

### 1. Topic selection

`App.jsx` owns the selected category, difficulty, current topic, and current screen. When the user changes a filter or presses **Spin again**, `pickTopic()` chooses another prompt from the combined pool of built-in and custom topics.

The spin is visual as well as functional: it cycles through temporary topics quickly, decelerates through a short landing sequence, and ends on the selected prompt. If two spin requests overlap, a run ID prevents the earlier request from replacing the newer result.

If a filter has no matching topic, the topic selector falls back to the available pool. The initial topic is selected from the built-in list.

### 2. Optional microphone check

Before starting, a user can run `checkMic()` in `useAudioAnalysis.js`. It:

1. Requests microphone access.
2. Samples about two seconds of quiet to estimate the room noise floor.
3. Samples about two seconds while the user speaks.
4. Reports a rough floor, peak level, and fraction of frames that rose above the floor.
5. Keeps the microphone stream open so the session can reuse it without a second permission prompt.

The check can identify a very noisy room, a near-clipping signal, or little apparent speech. Its readings are relative to the microphone, input gain, distance, and room; they are not calibrated sound-pressure measurements.

### 3. Starting and running

`SessionScreen.jsx` coordinates the active exercise. It starts the elapsed-time display, then asks the audio hook for a microphone stream. Only after microphone acquisition does it connect to Gemini Live, so the app has one microphone permission prompt.

When available, the same stream feeds two local consumers:

- **Web Audio analyser:** samples RMS loudness and estimates pitch. Samples are stored in a ref rather than triggering a React render on every audio frame.
- **MediaRecorder:** records audio in short chunks, preferring `audio/webm;codecs=opus` when supported. The resulting blob is retained with the session result in memory; the current UI does not upload or play it.

`useSpeechRecognition.js` converts the microphone signal to 16 kHz mono PCM and streams it directly from the browser to Gemini Live over a WebSocket. A short-lived, single-use token is requested from `/api/transcription-token`; that Vercel Function verifies the Supabase session before requesting the token. The browser then selects the live transcription model and verbatim text mode in its session setup. Supabase also limits token issuance to 20 requests per user per UTC day. Interim text is shown in a lighter style, and finalized transcript segments are accumulated with approximate arrival timestamps. The audio connection does not pass through Vercel.

The audio sampler and recognizer share a `performance.now()` start time. This gives their sample times and transcript-segment times a common clock for later approximate alignment.

Hints come from the selected topic. `KeywordHelper.jsx` reveals the first three words and offers a control to reveal the next group. It does not expose the entire hint list immediately.

### 4. Finishing

When the user finishes, the session:

- Stops the timer and audio stream, signals the end of audio to Gemini, and waits briefly for the final transcript message.
- Collects the finalized transcript plus the latest interim text.
- Adds any trailing interim text to the timestamped segment list so it is included in the annotated transcript.
- Stops waveform sampling and closes the audio resources.
- Lets `MediaRecorder` flush its final chunk before building a `Blob`.
- Sends the resulting in-memory session object to `App.jsx` for analysis.

Leaving the session instead of finishing tears down microphone tracks and discards the recording rather than showing results.

### 5. Results

`finishSession()` in `App.jsx` runs the transcript, vocabulary, audio, and transcript-alignment functions. `StatsPanel.jsx` displays whatever data is available. If transcription is missing, waveform statistics may still be available; if microphone access failed, transcript statistics may still be available.

When the user is signed in and the transcript is non-empty, `App.jsx` also requests an AI evaluation. It passes the transcript, topic title, and selected difficulty to `/api/evaluate-session`; the result screen adds the score and suggestions when the response arrives.

---

## How the analysis works

The deterministic transcript, vocabulary, and audio analysis functions in `src/lib/` are local JavaScript. The optional AI coaching step is the only analysis that calls a hosted model.

### Transcript statistics — `analyzeSpeech.js`

- **Word count:** splits the recognized text on whitespace.
- **Words per minute:** word count divided by elapsed session time in minutes. Since the session can end early, this is not based on the topic's target time.
- **Pace description:** below 90 WPM is labelled “slow & deliberate,” above 160 WPM “quite fast,” and the middle range “natural conversational pace.” These are broad heuristics.
- **Filler count:** counts recognized occurrences of tokens such as `um`, `uh`, `erm`, `you know`, `kind of`, and `basically`. The list is in `FILLER_WORDS`.
- **Ambiguous words:** `like` and `right` are counted separately as possible fillers because both are often ordinary words.
- **Hint keywords:** checks whether each topic keyword appears as a whole-word/phrase match in the transcript.

Gemini Live is configured for verbatim transcription, which is intended to preserve filler words, repetitions, and false starts. Recognition can still omit or mishear speech. Short audio regions with no transcript assignment are shown separately as **possible** fillers; audio levels alone cannot identify that a sound was definitely “um.”

### Vocabulary indicators — `analyzeVocabulary.js`

- **Unique words:** number of distinct normalized transcript tokens.
- **Type-token ratio (TTR):** unique words divided by all words. This is returned for every non-empty transcript but naturally changes with transcript length.
- **MATR:** for transcripts of at least 30 words, computes the type-token ratio in each rolling 30-word window, then averages the windows. For shorter transcripts it uses TTR and labels it as an estimate.
- **Diversity description:** maps the selected ratio to “repetitive,” “steady range,” or “wide vocabulary.” These bands are rough feedback, not proficiency grades.
- **Repeated content words:** counts tokens after excluding a built-in stopword list, filler words, topic keywords, and tokens shorter than three characters. Words occurring at least `max(3, wordCount / 80)` times may be listed, up to six terms.
- **Keyword timing:** records the end time of the first recognized segment containing each prompt keyword. When two or more keywords are found, their average timing is described as early, spread out, or late.

All of these results inherit any recognition omissions or substitutions in the transcript.

### Voice and pauses — `analyzeAudio.js`

The sampler records `{ t, rmsDb, f0 }` points. `rmsDb` is root-mean-square amplitude expressed in dBFS; `f0` is the estimated fundamental pitch in hertz or `null`.

The voice mask is based on microphone level, not a trained speech detector:

1. Use the measured quiet-room noise floor when the mic check ran; otherwise estimate a baseline from the 10th percentile of session levels.
2. Apply a three-sample median smoother to reduce isolated level spikes.
3. Start a voiced region at least 10 dB above the baseline (with a −55 dBFS floor), then keep it voiced until it drops below a lower exit threshold (6 dB above baseline, with a −58 dBFS floor). Separate entry and exit thresholds are hysteresis.

The resulting mask is used to estimate:

- **Voiced seconds:** total sample time classified as voice.
- **Pauses:** unvoiced stretches at least 0.3 seconds long between detected voice. Silence before the first voice and after the last voice is excluded. Pause rate is normalized by the span between first and last detected voice.
- **Average level and volume variation:** computed over voiced samples. Labels use fixed dBFS thresholds and should be interpreted in the context of the user's mic setup.
- **Pitch variety:** calculated only when there are at least 30 voiced samples with pitch estimates. The spread is measured in semitones relative to the speaker's median F0, with rough “monotone,” “some variation,” and “expressive” labels.
- **Volume sparkline:** peak levels are grouped into at most 120 buckets, with small pause markers overlaid.
- **Tips:** rule-based suggestions are generated from long/frequent pauses, low levels, large volume changes, pitch variation, or very few pauses during a long session.

Sessions with fewer than two seconds of detected voice do not receive audio statistics. A loud fan, distant microphone, quiet voice, or changing input gain can affect the voice mask and the resulting pause metrics.

### Pitch estimation — `pitch.js`

`detectPitch()` is a lightweight YIN-style detector. It downsamples each sampled frame to approximately 12 kHz, computes a difference function and cumulative-mean normalized difference, selects a periodicity dip, and refines the lag with parabolic interpolation. It returns an F0 estimate only within 50–400 Hz and when the signal is above its RMS gate. This is a simple pitch-variety measure, not pronunciation recognition.

### Transcript-to-waveform alignment — `alignTranscript.js`

The Web Speech API does not provide word timestamps. The heatmap therefore estimates them:

1. Turn the waveform mask into contiguous voiced regions.
2. Match each finalized recognition segment's arrival time to the nearest voiced-region end, initially compensating for a 0.7-second recognition delay.
3. Estimate that delay from the median of segment-to-region timing differences when the session has enough consistent segments, clamped to 0.25–1.75 seconds.
4. Spread each segment's words across its assigned audio region in proportion to the number of characters in each word.
5. Average RMS levels over each estimated word span and add pause markers for sufficiently large gaps.

Short voiced regions that did not receive transcript words may be counted as possible untranscribed sounds. This can catch a separate “um” region, but not one blended into surrounding speech. The heatmap's per-word timing and loudness are estimates, not true word-level measurements.

### The results UI — `StatsPanel.jsx`

The results screen renders transcript stat cards only when text exists and audio stat cards only when waveform analysis returns useful data. It also conditionally shows:

- Filler breakdown, including possible fillers and ambiguous words.
- Vocabulary diversity and repeated terms.
- Keyword timing when enough keywords were recognized.
- A loudness curve with pause ticks and up to a few audio suggestions.
- A transcript heatmap with estimated loudness by word and pause pills.
- A plain full-transcript disclosure when no waveform alignment can be produced.

`TranscriptHeatmap.jsx` normalizes word highlight strength between the 5th and 95th loudness percentiles, reducing the effect of one unusually loud sample. Real spaces between rendered tokens allow the text to wrap and copy correctly.

---

## Browser APIs, privacy, and external services

### Microphone and recording

- `getUserMedia()` is used for waveform sampling and microphone check.
- `MediaRecorder` captures a local session blob while the session is active.
- Web Audio measures sound levels and pitch in the browser.
- Audio tracks and the `AudioContext` are stopped/closed when a session ends or the session screen unmounts.
- `MediaRecorder` keeps an in-memory recording blob for the current results flow, but the app does not save or upload that blob. Separately, the live microphone stream is sent directly to Gemini for transcription. Signed-in users' topic and transcript history is saved to Supabase; waveform samples remain in browser memory.

### Speech recognition

The app streams audio to Google's `gemini-3.5-transcribe-live` model. A signed-in user is required because the Vercel token route validates the user's Supabase session. The model returns interim and finalized text, and the app accumulates it for local analysis and (when signed in) the user's Supabase history. Verbatim mode is selected to retain fillers. Google's free API tier may use submitted content to improve its products; check the current Gemini API data terms and pricing before using personal or sensitive speech.

The timer and topic prompts still run when transcription is unavailable. Waveform analysis requires microphone permission and Web Audio support; live transcript capture also needs a working connection to Gemini and the Vercel API route.

### Accounts and session history

`useAuth.js` restores the Supabase Auth session and listens for sign-in and sign-out changes. `AuthModal.jsx` provides email/password sign-in and registration. Supabase Auth stores account credentials; this app does not keep passwords or copy account details into a custom profile table.

When a signed-in user finishes a session, `App.jsx` saves the chosen topic title, prompt, category, difficulty, transcript, duration, and completion date to `public.practice_sessions`. The history dialog displays the most recent 100 entries and lets the user delete one. Sessions finished while signed out stay only in the current page memory and are not uploaded later. Custom topics and streaks remain browser-local.

The database definition is in `supabase/schema.sql`. It enables row-level security and restricts reads, inserts, and deletes to rows whose `user_id` matches the authenticated Supabase user. The browser uses only the Supabase project URL and publishable (or legacy anon) key. Never add the Supabase secret/service-role key to a `VITE_` variable or browser code.

To enable cloud history:

1. Connect the Supabase integration to the Vercel project, or create a Supabase project and copy its project URL and publishable key.
2. Run `supabase/schema.sql` once in the Supabase SQL Editor.
3. For local development, copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. For Vercel, the Vite config also accepts `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` supplied by the integration.
4. In Supabase Auth URL configuration, set the production site URL and allow the Vercel deployment URLs used for email confirmation. The Vercel integration can sync Supabase environment variables and configure preview redirects.
5. Redeploy after adding environment variables. Vite includes these public values in the built client, so they are not secrets; database safety comes from the publishable key plus RLS.

Without configuration, the app continues to work locally and displays setup guidance when the account button is opened. The Vite site calls Supabase directly, so no Vercel serverless function or server runtime is used.

### AI speaking feedback

`src/lib/coach.js` calls the same-origin `/api/evaluate-session` Vercel Function after a signed-in user finishes speaking. The function validates the Supabase access token, atomically applies a five-evaluations-per-user-per-UTC-day limit through `claim_ai_coaching_request()`, and asks Gemini for JSON containing a 0–100 score plus 2–3 suggestions. The rubric covers topic relevance, organization, idea development, and vocabulary/grammar while adjusting expectations to the difficulty. It does not score accent, pronunciation, confidence, or other audio properties because only the transcript is sent.

`GEMINI_MODEL` accepts one or two comma-separated model IDs. With two, a database-backed global sequence alternates model selection on every allowed request, including across Vercel function instances. If unset, the app uses `gemini-3.5-flash-lite`.

The endpoint rejects non-POST and cross-origin browser requests, requires authentication, and caps transcript size at 12,000 characters. The Gemini key stays server-side in `GEMINI_API_KEY`; do not name it `VITE_GEMINI_API_KEY`. The transcript is sent to Google's Gemini service for evaluation. Review Google's current data-use terms for the API tier you select, especially before sending personal information.

Add `GEMINI_API_KEY` and a comma-separated two-model `GEMINI_MODEL` to Vercel's server environment, then redeploy. The existing Vercel-Supabase integration must provide `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; re-run the updated `supabase/schema.sql` once so the quota and rotation tables/RPC exist. For local calls, copy `.env.example` to `.env.local`, put the same Supabase URL and publishable key under both the `VITE_` and server-side names, and add your Gemini key and model IDs. Use `vercel dev`; Vite's `npm run dev` only serves the client. The function has a 30-second maximum, within Vercel Hobby's function limit.

### AI and API features

The current project does not include AI topic generation, an API-key settings screen, on-device pronunciation scoring, or a downloadable speech model. It includes optional transcript-only AI feedback. Topic selection uses the built-in bank and custom prompts stored in the browser. Speech transcription remains a browser feature and may use the browser vendor's speech service.

### Fonts and design asset

`index.html` loads Fraunces and Space Grotesk from Google Fonts with system-font fallbacks. The fantasy background illustration is a local static asset at `public/images/sakura-valley.jpg`; Vite serves it at `/images/sakura-valley.jpg` in production.

---

## Project map

```text
src/
  main.jsx                         React entry point and global stylesheet import
  App.jsx                          Main state machine, topic selection, result analysis and history save
  api/evaluate-session.js          Authenticated, rate-limited Gemini evaluation function
  App.css                          Screen layout and stage transitions
  index.css                        Palette, base elements, shared controls and effects
  data/topics.js                   30 curated topics, categories, difficulty, selection helpers
  hooks/
    useLocalStorage.js             Validated JSON persistence helper
    useAuth.js                     Supabase account session state
    useSpeechRecognition.js        Gemini Live WebSocket, audio conversion, and transcript accumulation
    useAudioAnalysis.js            Mic check, Web Audio sampling and cleanup
  lib/
    analyzeSpeech.js               Transcript counts, fillers, pace, hint keyword use
    analyzeVocabulary.js           Diversity, repeated words, keyword timing
    analyzeAudio.js                 Voice mask, pauses, volume and pitch metrics
    pitch.js                        YIN-lite F0 estimate
    alignTranscript.js              Estimated transcript-to-waveform alignment
    sessionHistory.js               Cloud history save, list, and delete operations
    coach.js                        Authenticated AI evaluation request and UI error handling
    supabase.js                     Optional browser Supabase client
  components/
    Header.jsx / Header.css         Home, streak, account, history, and add-topic controls
    CategoryPicker.jsx              Category/difficulty filter pills
    TopicCard.jsx                   Prompt card, spin animation and start action
    SessionScreen.jsx               Mic check, timer, transcript, hints and recording flow
    TimerRing.jsx                   Elapsed-time ring and goal state
    KeywordHelper.jsx               Progressive hint reveal
    StatsPanel.jsx                  Session result cards and explanatory sections
    TranscriptHeatmap.jsx           Estimated word loudness and pause display
    CustomTopicModal.jsx             Create/list/remove personal topics
    AuthModal.jsx                    Email/password account access
    HistoryModal.jsx                 View and delete saved sessions
    Modal.jsx                        Shared animated modal shell
  components/*.css                  Styles scoped to each component
public/
  images/sakura-valley.jpg          Static fantasy twilight background illustration
scripts/
  test-audio-libs.mjs               Audio, transcript, vocabulary and render checks
supabase/
  schema.sql                         Session table, access policies, and AI request quota
```

### App state flow

`App.jsx` holds a simple `select → session → results` stage value. A second `renderedStage` state waits for the outgoing fade to finish before replacing the screen. There is no router or app server; optional account and history data are stored in Supabase.

Topic selection and UI settings are managed by `App.jsx`; the session component owns transient timer/audio/transcript data; pure analysis functions turn the finished session object into a stats object; `StatsPanel` displays it.

---

## Local storage and session data

Persistent values are stored as JSON under the existing `speakstage.*` prefix. The name was retained to avoid dropping returning users' settings after the app branding changed.

| Key | Stored value | Purpose |
|---|---|---|
| `speakstage.streak` | Non-negative number | Consecutive local-calendar-day practice count |
| `speakstage.lastDate` | Date string or `null` | Last day on which a session reached results |
| `speakstage.customTopics` | Array | User-created prompts |

`useLocalStorage.js` parses and validates stored JSON. Invalid or unavailable storage falls back to the supplied initial value; writes also fail silently if storage is blocked.

Older installations may still contain `speakstage.apiKey` or `speakstage.aiMode` values from the removed AI feature. The current app no longer reads, uses, or transmits those values; they are left untouched in the user's browser storage.

The current session's audio samples, stats, and recording blob live in React memory only. Refreshing or closing the page loses them. If a user is signed in and cloud history is configured, the topic metadata and transcript are saved to Supabase; raw audio and analysis samples are never uploaded. A signed-out session is not added to history retroactively.

The streak uses the browser's local calendar date, not UTC. It increments at most once per local day when the user finishes a session and reaches the results screen. A session does not need to run the full target duration to reach results.

---

## Visual design

The current single theme is a cinematic twilight-fantasy look inspired by the supplied website reference: a custom sakura garden background, deep indigo and violet surfaces, soft rose highlights, lavender accents, and warm gold actions. The illustration is original project artwork and contains no interface text, so the UI stays responsive and accessible as HTML.

Styling uses regular CSS rather than a component or animation framework:

- Shared color and motion tokens live in `src/index.css`.
- Component styles are colocated as `Component.jsx` and `Component.css` pairs.
- The background artwork is a small static JPEG and adds no runtime service.
- Topic, modal, result-card, and button animations use CSS transitions/keyframes.
- Stage changes use a short CSS fade coordinated with a timer in `App.jsx`.
- The header logo button returns to topic selection. The header also has a streak indicator (when nonzero), add-topic control, and settings control.
- The filter pills keep their accent tint at rest; hover adds a brighter outline, lift, and stronger tint.
- Header icon buttons use a more opaque dark surface so they remain visible over the illustrated backdrop. Account and history actions use compact labeled buttons.

Reduced-motion preferences are handled in the global stylesheet.

---

## Build and deploy on Vercel

This project is a Vite static site. On Vercel, use the Vite preset with:

| Setting | Value |
|---|---|
| Install command | `npm install` |
| Build command | `npm run build` |
| Output directory | `dist` |

Small Node.js Vercel Functions issue Gemini transcription tokens and evaluate completed transcripts. The live WebSocket and audio stream remain in the browser-to-Gemini connection, so the function does not need to stay running for a speaking session. Supabase remains optional for basic practice and history, but is required for authenticated token issuance and cloud history.

To enable history and coaching, connect Supabase from the Vercel Marketplace and run the current `supabase/schema.sql` in that project's SQL Editor. Set the server-only `GEMINI_API_KEY` Vercel environment variable, then redeploy. The Supabase integration provides `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. For local development, copy `.env.example` to `.env.local`, set the browser and server-side Supabase variables to the same values, add `GEMINI_API_KEY`, then run `vercel dev` for both the app and API functions. The evaluation route allows five scoring requests per user per day.

The `vite.config.js` file sets the development port to 5173, opens the dev page automatically, and allows `.ngrok-free.app` hosts for development previews. Vercel deploys the generated static `dist/` directory.

---

## Current limitations and implementation notes

- **Network and provider access are required for transcription.** It needs an authenticated API token and a stable WebSocket connection to Gemini; recognized content can still be partial or inaccurate.
- **Verbatim mode helps filler detection but cannot guarantee it.** Gemini may still omit or mishear a filler. Waveform leftovers are only possible fillers.
- **Voice detection is level based.** It smooths and applies hysteresis, but is not a trained voice activity detector. Background sound and soft speech can still be misclassified.
- **Word timing is approximate.** Live transcription returns utterance segments rather than word-level timestamps; the heatmap estimates word positions by spreading words across a segment's detected voice region.
- **Microphone volume labels are relative.** Fixed dBFS thresholds can vary in usefulness with hardware, distance, room, and input processing.
- **History setup is external.** Cloud history requires the Supabase schema, project environment variables, and Auth redirect URLs. Without that setup the rest of the practice flow remains available.
- **Scoring and transcription are separate Gemini features.** Transcription always uses `gemini-3.5-transcribe-live`; transcript scoring uses the optional `GEMINI_MODEL` rotation.
- **External font request.** Google Fonts may be unavailable offline; system fallbacks are configured.
- **No automated framework test command.** The project includes a standalone Node check script for pure libraries and a server-rendered heatmap check; `package.json` does not define an `npm test` script.

---

## Good places to extend the app

1. **Add progress trends.** Compare saved pace, pause, and vocabulary metrics over time, and let users export or clear their cloud history.
2. **Improve transcription review.** Let users correct a transcript before using it for vocabulary and filler metrics, while preserving the original recognized text for reference.
3. **Improve filler feedback carefully.** An on-device recognizer could be evaluated as an optional download, but model size, first-use bandwidth, mobile memory, speed, and filler recall should be measured before adopting it. The current app has no such model.
4. **Improve voice detection.** Compare the existing adaptive energy/hysteresis mask with a small browser-compatible voice activity detector using recorded test cases across quiet and noisy rooms.
5. **Add accessibility polish.** Consider explicit live-region announcements for timer/transcription state and ensure each icon control has an understandable keyboard and screen-reader label.

When adding a feature, keep the static Vercel deployment constraint in mind: browser-side code and static assets work without adding a backend, while external APIs, large downloads, and persistent user data introduce separate tradeoffs.
