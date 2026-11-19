import "./AppFooter.css";

const BACK_ROW = [
  [25, 60, 0.78, "#c98261", "#33213b", "#8b6a9d", 0],
  [138, 48, 0.82, "#e2ad82", "#242036", "#c08c72", 2],
  [250, 72, 0.74, "#a96752", "#211b2d", "#7e789c", 1],
  [365, 52, 0.8, "#ecc19b", "#3b2840", "#c67d9a", 0],
  [475, 68, 0.76, "#b9785a", "#201d2c", "#d5a557", 3],
  [590, 45, 0.84, "#d99c72", "#292039", "#8e7eb0", 1],
  [705, 68, 0.76, "#edc39d", "#201b2b", "#c88073", 0],
  [820, 50, 0.82, "#9f634e", "#30203a", "#d09c56", 2],
  [936, 70, 0.76, "#d49a73", "#221b30", "#8978ac", 1],
  [1050, 48, 0.84, "#e7b58a", "#31213c", "#ce7f9d", 0],
  [1165, 66, 0.78, "#af7158", "#241d31", "#ab8b72", 3],
  [1290, 50, 0.82, "#efc39d", "#2b2138", "#8175a5", 1],
];

const FRONT_ROW = [
  [65, 22, 1.02, "#d99e79", "#262033", "#c87b94", 1],
  [228, 5, 1.06, "#ad6f56", "#211b2c", "#d1a253", 2],
  [395, 28, 0.96, "#edc09a", "#30223b", "#8e7bb0", 0],
  [560, 9, 1.04, "#c38262", "#251d31", "#d984a5", 3],
  [725, 26, 0.98, "#e5b28a", "#201b2c", "#927ea9", 1],
  [890, 7, 1.05, "#a96850", "#30213c", "#d3a75d", 0],
  [1055, 25, 0.98, "#e9ba94", "#241e32", "#bf7b8e", 2],
  [1220, 8, 1.04, "#ba7959", "#201a2c", "#8e7ead", 1],
  [1380, 24, 1, "#dba27d", "#30213b", "#c98f69", 0],
];

function Person({ person, index, front = false }) {
  const [x, y, scale, skin, hair, shirt, hairstyle] = person;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={front ? 1 : 0.78}>
      <g className="crowd-person-bob" style={{ animationDelay: `${-((index * 0.37) % 2.8)}s` }}>
        <path
          d="M-56 410v-222c0-32 22-53 48-61l8-12h20l8 12c27 8 48 29 48 61v222z"
          fill={shirt}
          stroke="#1a1429"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path d="M-13 115h26v32h-26z" fill={skin} />
        <ellipse cx="0" cy="72" rx="31" ry="40" fill={skin} stroke="#241a2d" strokeWidth="3" />
        {hairstyle === 1 ? (
          <path d="M-33 75c-9-39 8-60 35-61 32-1 43 26 35 67l-9 47-11-13 2-44-15-25-27 8-3 70-13 15z" fill={hair} />
        ) : hairstyle === 2 ? (
          <path d="M-32 66c-9-33 6-57 31-58 33-2 43 24 34 56l-9 4-5-31-18-9-22 13-6 30z" fill={hair} />
        ) : hairstyle === 3 ? (
          <g fill={hair}>
            <circle cx="0" cy="26" r="19" />
            <path d="M-32 70c-4-31 9-50 32-50 25 0 37 19 33 50l-11-7-3-20-19-11-22 9-3 23z" />
          </g>
        ) : (
          <path d="M-32 70c-6-37 10-57 34-57 30 0 40 24 31 57l-9-7-3-23-19-11-22 10-3 24z" fill={hair} />
        )}
        <path d="M-13 65h6m14 0h6" stroke="#38252f" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M0 67l-3 13 6 1" fill="none" stroke="#9d644f" strokeWidth="2" strokeLinecap="round" />
        <path d="M-7 91q7 6 14 0" fill="none" stroke="#7f434c" strokeWidth="2.6" strokeLinecap="round" />
        {index % 3 === 0 && (
          <g fill="none" stroke="#241c30" strokeWidth="3">
            <rect x="-25" y="58" width="19" height="16" rx="5" />
            <rect x="6" y="58" width="19" height="16" rx="5" />
            <path d="M-6 65h12" />
          </g>
        )}
        <path d="M-14 145q14 16 28 0" fill="none" stroke="#f3d7ce" strokeOpacity=".72" strokeWidth="4" />
        {index % 2 === 0 && (
          <path d="M-38 190l18 30m58-30-18 30" stroke="#f6d8ca" strokeOpacity=".34" strokeWidth="4" />
        )}
      </g>
    </g>
  );
}

export default function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-crowd-scene" aria-label="A colorful crowd gathered together">
        <svg className="footer-crowd-art" viewBox="0 0 1440 410" preserveAspectRatio="xMidYMax slice" role="img" aria-labelledby="footer-crowd-title">
          <title id="footer-crowd-title">A crowd of people sharing their voices</title>
          <defs>
            <linearGradient id="footer-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#211839" />
              <stop offset="0.64" stopColor="#33234f" />
              <stop offset="1" stopColor="#17122a" />
            </linearGradient>
            <radialGradient id="footer-glow">
              <stop stopColor="#ff80b5" stopOpacity=".33" />
              <stop offset="1" stopColor="#ff80b5" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="footer-ground" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#493168" stopOpacity="0" />
              <stop offset="1" stopColor="#100d20" stopOpacity=".82" />
            </linearGradient>
          </defs>
          <rect width="1440" height="410" fill="url(#footer-sky)" />
          <ellipse cx="720" cy="128" rx="460" ry="215" fill="url(#footer-glow)" />
          <path d="M0 233q160-32 320 0t320 0 320 0 320 0 320 0v177H0z" fill="#493168" opacity=".34" />
          <text className="footer-crowd-watermark" x="720" y="178" textAnchor="middle">SPEAK</text>
          <g className="footer-speech-bubble" transform="translate(415 65)">
            <rect width="72" height="38" rx="19" fill="#fff2f7" fillOpacity=".92" />
            <circle cx="25" cy="19" r="3" fill="#e665a0" />
            <circle cx="36" cy="19" r="3" fill="#e6b557" />
            <circle cx="47" cy="19" r="3" fill="#8f73b4" />
            <path d="m18 34-7 10 17-8" fill="#fff2f7" fillOpacity=".92" />
          </g>
          <g className="footer-speech-bubble footer-speech-bubble--second" transform="translate(952 92) scale(.78)">
            <rect width="64" height="36" rx="18" fill="#ffd27a" fillOpacity=".92" />
            <path d="M20 18h24" stroke="#493168" strokeWidth="3" strokeLinecap="round" />
            <path d="m19 33-8 10 18-8" fill="#ffd27a" fillOpacity=".92" />
          </g>
          <g className="footer-crowd-row footer-crowd-row--back">
            {BACK_ROW.map((person, index) => <Person key={`back-${index}`} person={person} index={index} />)}
          </g>
          <g className="footer-crowd-row footer-crowd-row--front">
            {FRONT_ROW.map((person, index) => <Person key={`front-${index}`} person={person} index={index + 3} front />)}
          </g>
          <rect y="330" width="1440" height="80" fill="url(#footer-ground)" />
          <path d="M0 392q240-20 480 0t480 0 480 0" fill="none" stroke="#ff80b5" strokeOpacity=".3" strokeWidth="2" />
        </svg>
        <div className="footer-crowd-title">Every voice belongs.</div>
      </div>
      <div className="footer-crowd-caption">
        <span>© {year} Vocab Speak · Keep making space for your voice.</span>
        <span>Live microphone audio is streamed to Gemini for transcription.</span>
      </div>
    </footer>
  );
}
