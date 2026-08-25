/**
 * Black-outline animal line drawings for the naming item, in the style of the
 * official MoCA stimuli (which are licensed and cannot be redistributed —
 * these are same-style stand-ins). Side profiles, plain strokes, no fill.
 */

const S = {
  fill: 'none',
  stroke: '#23303a',
  strokeWidth: 3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function LionDrawing(): JSX.Element {
  return (
    <svg width={340} height={230} viewBox="0 0 340 230" data-testid="animal-drawing-lion">
      {/* mane: spiky ring */}
      <path
        {...S}
        d="M96 38 l10 14 14-10 4 16 16-5 -2 16 17 1 -8 15 16 7 -13 11 12 12 -17 5 6 16 -17 -2 -1 17 -15 -8 -8 15 -11 -13 -14 10 -3 -16 -16 3 4 -16 -16 -3 9 -14 -13 -9 14 -8 -8 -15 17 -1 -2 -16 16 5 3 -16 14 9 z"
      />
      {/* face */}
      <circle {...S} cx={92} cy={102} r={26} />
      <circle cx={84} cy={96} r={2.6} fill="#23303a" />
      <circle cx={102} cy={96} r={2.6} fill="#23303a" />
      <path {...S} d="M88 108 q5 5 10 0" />
      <path {...S} d="M93 108 v6" />
      {/* back and rump */}
      <path {...S} d="M132 84 Q200 62 252 78 Q286 88 288 116 Q290 142 272 158" />
      {/* belly */}
      <path {...S} d="M126 138 Q180 152 236 148" />
      {/* front legs */}
      <path {...S} d="M138 140 L136 196 M158 144 L157 198" />
      <path {...S} d="M130 196 h14 M151 198 h14" />
      {/* hind legs */}
      <path {...S} d="M244 150 L246 198 M268 158 L266 200" />
      <path {...S} d="M238 198 h14 M260 200 h14" />
      {/* tail with tuft */}
      <path {...S} d="M286 118 Q312 128 308 158" />
      <path {...S} d="M304 156 q10 4 4 14 q-10 4 -8 -6 z" />
    </svg>
  );
}

export function RhinoDrawing(): JSX.Element {
  return (
    <svg width={340} height={230} viewBox="0 0 340 230" data-testid="animal-drawing-rhinoceros">
      {/* head with two horns, facing left */}
      <path
        {...S}
        d="M28 128 Q22 110 36 96 L52 82 Q60 74 72 76 L96 82"
      />
      {/* big front horn + small second horn */}
      <path {...S} d="M36 96 Q18 84 14 62 Q30 74 44 86" />
      <path {...S} d="M56 80 Q50 66 52 58 Q62 68 66 76" />
      {/* eye and ear */}
      <circle cx={74} cy={92} r={2.6} fill="#23303a" />
      <path {...S} d="M92 74 q4 -14 14 -8 q-2 10 -12 12" />
      {/* mouth/jaw */}
      <path {...S} d="M28 128 Q40 140 62 138 L84 132" />
      {/* massive back with shoulder hump */}
      <path {...S} d="M98 80 Q140 54 196 60 Q262 66 292 96 Q310 114 300 138" />
      {/* belly */}
      <path {...S} d="M84 132 Q110 156 168 158 Q232 160 278 148" />
      {/* legs, thick */}
      <path {...S} d="M116 150 L114 200 M146 156 L146 202" />
      <path {...S} d="M108 200 h16 M138 202 h16" />
      <path {...S} d="M244 156 L244 202 M276 150 L278 200" />
      <path {...S} d="M236 202 h16 M270 200 h16" />
      {/* tail */}
      <path {...S} d="M300 138 Q312 152 306 172" />
    </svg>
  );
}

export function CamelDrawing(): JSX.Element {
  return (
    <svg width={340} height={230} viewBox="0 0 340 230" data-testid="animal-drawing-camel">
      {/* head, facing left */}
      <path {...S} d="M40 76 Q28 78 26 90 Q26 100 38 102 L56 102" />
      <circle cx={40} cy={86} r={2.4} fill="#23303a" />
      <path {...S} d="M52 72 q2 -10 8 -10 q2 8 -4 12" />
      {/* neck */}
      <path {...S} d="M42 74 Q60 48 84 58 Q98 66 102 92" />
      <path {...S} d="M56 102 Q76 108 92 116" />
      {/* two humps */}
      <path {...S} d="M102 92 Q116 64 142 66 Q162 68 168 90 Q176 64 202 64 Q228 66 234 92 Q248 100 250 116" />
      {/* rump and tail */}
      <path {...S} d="M250 116 Q256 132 246 146" />
      <path {...S} d="M250 118 Q264 130 262 152" />
      {/* belly */}
      <path {...S} d="M96 120 Q120 142 170 144 Q216 146 240 140" />
      {/* long legs with knees */}
      <path {...S} d="M112 132 L110 168 L112 202 M136 140 L136 172 L134 204" />
      <path {...S} d="M106 202 h12 M128 204 h12" />
      <path {...S} d="M214 144 L216 176 L214 204 M240 140 L242 172 L240 202" />
      <path {...S} d="M208 204 h12 M234 202 h12" />
    </svg>
  );
}

export const ANIMAL_DRAWINGS: Record<string, () => JSX.Element> = {
  lion: LionDrawing,
  rhinoceros: RhinoDrawing,
  camel: CamelDrawing,
};
