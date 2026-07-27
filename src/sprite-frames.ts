// Zaur pixel sprite frames — shared across apps.
// '.' transparent, 'X' body, 'W' eye (transparent).

// idle (both feet planted)
const IDLE = [
  "....................",
  "....................",
  ".............XXXXX..",
  "............XWXXXXX.",
  "............XXXXXXX.",
  "............XXXXX...",
  "...........XXXX.....",
  "......XXXXXXXXX.....",
  "....XXXXXXXXXXX.....",
  "...XXXXXXXXXXX......",
  "....XXXXXXXX........",
  "......XX.X.XX.......",
  "....XX.....XX.......",
  "....XX....XXX.......",
  "...XXX.....XX.......",
  "...XX........XX.....",
  "..XXXX.....XXXX.....",
  "....................",
];

// walk frame A — left leg swung back (foot behind hips), right leg planted
const WALK_A = [
  "....................",
  "....................",
  ".............XXXXX..",
  "............XWXXXXX.",
  "............XXXXXXX.",
  "............XXXXX...",
  "...........XXXX.....",
  "......XXXXXXXXX.....",
  "....XXXXXXXXXXX.....",
  "...XXXXXXXXXXX......",
  "....XXXXXXXX........",
  ".....XX.X.XX........",
  "....XX.....XX.......",
  "...XX......XXX......",
  "..XXX.......XX......",
  "..XX.........XX.....",
  ".XXXX.......XXXX....",
  "....................",
];

// walk frame B — left leg planted, right leg swung forward
const WALK_B = [
  "....................",
  "....................",
  ".............XXXXX..",
  "............XWXXXXX.",
  "............XXXXXXX.",
  "............XXXXX...",
  "...........XXXX.....",
  "......XXXXXXXXX.....",
  "....XXXXXXXXXXX.....",
  "...XXXXXXXXXXX......",
  "....XXXXXXXX........",
  "......XX.X.XX.......",
  "......XX...XX.......",
  "......XX....XX......",
  ".....XXX.....XX.....",
  ".....XX.......XXX...",
  "....XXXX......XXXX..",
  "....................",
];

// looking up — head tilts so snout points up-right and the eye sits high
const LOOK_UP = [
  "....................",
  ".............XXXX...",
  "............XXWXXX..",
  "............XXXXXX..",
  "............XXXXX...",
  "...........XXXX.....",
  "..........XXXX......",
  "......XXXXXXXXX.....",
  "....XXXXXXXXXXX.....",
  "...XXXXXXXXXXX......",
  "....XXXXXXXX........",
  "......XX.X.XX.......",
  "....XX.....XX.......",
  "....XX....XXX.......",
  "...XXX.....XX.......",
  "...XX........XX.....",
  "..XXXX.....XXXX.....",
  "....................",
];

// happy — bright eye, lifted snout, and a tiny open grin cut into the jaw
const HAPPY = [
  "....................",
  "....................",
  ".............XXXXX..",
  "............XWXXXXX.",
  "............XXXXWXX.",
  "............XXXXX...",
  "...........XXXX.....",
  "......XXXXXXXXX.....",
  "....XXXXXXXXXXX.....",
  "...XXXXXXXXXXX......",
  "....XXXXXXXX........",
  "......XX.X.XX.......",
  "....XX.....XX.......",
  "....XX....XXX.......",
  "...XXX.....XX.......",
  "...XX........XX.....",
  "..XXXX.....XXXX.....",
  "....................",
];

// sad — drooped head and tail, with the body sitting lower in the frame
const SAD = [
  "....................",
  "....................",
  "....................",
  "............XXXXX...",
  "...........XWXXXXX..",
  "...........XXXXWXX..",
  "...........XXXXX....",
  "..........XXXX......",
  "......XXXXXXXX......",
  "....XXXXXXXXXXX.....",
  "...XXXXXXXXXXX......",
  "....XXXXXXXX........",
  "......XX.X.XX.......",
  "....XX.....XX.......",
  "....XX....XXX.......",
  "...XXX.....XX.......",
  "..XXXX.....XXXX.....",
  "....................",
];

// blink — eye pixel filled in
const BLINK = [
  "....................",
  "....................",
  ".............XXXXX..",
  "............XXXXXXX.",
  "............XXXXXXX.",
  "............XXXXX...",
  "...........XXXX.....",
  "......XXXXXXXXX.....",
  "....XXXXXXXXXXX.....",
  "...XXXXXXXXXXX......",
  "....XXXXXXXX........",
  "......XX.X.XX.......",
  "....XX.....XX.......",
  "....XX....XXX.......",
  "...XXX.....XX.......",
  "...XX........XX.....",
  "..XXXX.....XXXX.....",
  "....................",
];

// sleeping — lying down: head resting low on the right (eye closed), back
// rising into a gentle mound, tail stretched out to the left on the ground.
const SLEEP = [
  "....................",
  "....................",
  "....................",
  "....................",
  "....................",
  "....................",
  "....................",
  "....................",
  "....................",
  "....................",
  "....................",
  ".............XXXXX..",
  "........XXXXXXXXXXX.",
  "......XXXXXXXXXXXXX.",
  ".XX..XXXXXXXXXXXX...",
  "..XXXXXXXXXXXXXXX...",
  "...XXXXXXXXXXXXX....",
  "....................",
];

// sitting — upright on his haunches, tail resting on the ground, legs
// folded. His "at home" pose.
const SIT = [
  "....................",
  "....................",
  "....................",
  "....................",
  "....................",
  "....................",
  "..........XXXXX.....",
  ".........XWXXXXX....",
  ".........XXXXXX.....",
  "..........XXXX......",
  ".........XXXXX......",
  "........XXXXXX......",
  ".......XXXXXXX......",
  "..XX..XXXXXXXX......",
  "...XXXXXXXXXXXX.....",
  "....XXXXXXXXXXX.....",
  "....XX....XXXX......",
  "....................",
];

// surprise — head jolts up, two wide eyes, body slightly recoiled left so
// the stance reads as "what was that?!" rather than the calmer LOOK_UP.
const SURPRISE = [
  "....................",
  ".............XXXX...",
  "............XWXWXX..",
  "............XXXXXXX.",
  "............XXXXX...",
  "...........XXXX.....",
  "..........XXX.......",
  ".....XXXXXXXXX......",
  "...XXXXXXXXXXX......",
  "..XXXXXXXXXXX.......",
  "...XXXXXXXX.........",
  ".....XX.X.XX........",
  ".....XX...XX........",
  "....XXX...XXX.......",
  "...XXX.....XX.......",
  "...XX........XX.....",
  "..XXXX.....XXXX.....",
  "....................",
];



export type FrameId =
  | "idle"
  | "walk_a"
  | "walk_b"
  | "look_up"
  | "happy"
  | "sad"
  | "blink"
  | "sleep"
  | "sit"
  | "surprise";

export const SPRITE_FRAMES: Record<FrameId, string[]> = {
  idle: IDLE,
  walk_a: WALK_A,
  walk_b: WALK_B,
  look_up: LOOK_UP,
  happy: HAPPY,
  sad: SAD,
  blink: BLINK,
  sleep: SLEEP,
  sit: SIT,
  surprise: SURPRISE,
};



export const SPRITE_GRID_W = 20;
export const SPRITE_GRID_H = 18;

/** Default dino body color (dinosaurus ink). */
export const ZAUR_INK = '#e8e4d8';
