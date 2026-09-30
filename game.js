// EPQ Platformer
// A five-level 2D platformer built with Kaboom.js 0.5 and hand-drawn pixel sprites.
// Controls: A / D to move, SPACE to jump. On the menu, 1-5 jumps straight to a level.

kaboom({
  global: true,
  fullscreen: true,
  scale: 2,
  clearColor: [0.42, 0.91, 1, 1], // sky blue; the hidden blocks in level 5 are this exact colour
  plugins: [kbmspritePlugin],
});

// Kaboom 0.5 sizes its canvas from the window once at start-up and never again, and WebGL
// does not update its viewport when the canvas changes size. Keep both in step with the window
// so the game survives being resized, or being loaded before its container has a size.
{
  const canvas = document.querySelector('canvas');
  const gl = canvas.getContext('webgl');
  const fitToWindow = () => {
    if (canvas.width === window.innerWidth && canvas.height === window.innerHeight) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  window.addEventListener('resize', fitToWindow);
  fitToWindow();
}

// ---------- Assets ----------
const SPRITES = [
  'player', 'grass', 'brick', 'darkbrick', 'breakingblock', 'invisibleblock',
  'trampoline', 'spike2', 'lava', 'butterfly', 'boulder', 'finish',
];
for (const name of SPRITES) loadKbmsprite(name, `sprites/${name}.kbmsprite`);

// ---------- Tuning ----------
const SPEED = 120;            // horizontal speed, px/s
const JUMP = 350;             // normal jump force
const TRAMPOLINE_JUMP = 800;  // jump force after touching a trampoline, until you next touch a brick
const FALL_DEATH_Y = 600;     // falling below this line counts as a death
const BUTTERFLY_SPEED = 15;   // butterflies drift left at this speed
const BREAK_DELAY = 0.5;      // seconds a breaking block holds after you touch it

// ---------- Levels ----------
// Map legend:
//   x grass          o brick (slides when pushed, in levels with brickSpeed)
//   d dark brick     b breaking block     t trampoline     v spike     l lava
//   u butterfly      k boulder (falls)    j hidden block   f finish
// Per-level settings: tile size, player spawn, optional butterflyScale and brickSpeed.
const LEVELS = [
  { // Level 1
    tile: 40, spawn: [20, 20],
    map: [
      '                      u ',
      '       u                ',
      '                x  x  f ',
      '            xx          ',
      'xxx  xxxxx              ',
    ],
  },
  { // Level 2
    tile: 40, spawn: [20, 20],
    map: [
      '          v v v                  ',
      '         ooooooooo               ',
      '                                 ',
      '                                 ',
      '                    o            ',
      '                                 ',
      '                        o        ',
      '                     o           ',
      '  ooooot                         ',
      '                          of     ',
      '                                 ',
    ],
  },
  { // Level 3
    tile: 50, spawn: [20, 20],
    map: [
      'd                                                    d',
      'd                                                    d',
      'd                                                    d',
      'd                   b b b b b  b                     d',
      'd       b         b               b                  d',
      'd     b    b    b                   b                d',
      'ddddd         b                       b b  b         d',
      'd                                             ddddddfd',
      'd                                                    d',
      'dlllllllllllllllllllllllllllllllllllllllllllllllllllld',
      'dlllllllllllllllllllllllllllllllllllllllllllllllllllld',
    ],
  },
  { // Level 4
    tile: 50, spawn: [20, 200], butterflyScale: 0.5, brickSpeed: 40,
    map: [
      '  k                                                              ',
      '                                                                 ',
      '                                                                 ',
      '                                                                u',
      '              u        x                    uo                ddf',
      'dddddddd o        d o         d o        d b                     ',
      '                                                                 ',
      '                                                                 ',
      '                                                                 ',
    ],
  },
  { // Level 5
    tile: 40, spawn: [20, 200], butterflyScale: 0.5, brickSpeed: 100,
    map: [
      '                                             v v v                                                            ',
      '  k                                         dddddd                                                            ',
      '                                            d                                                                 ',
      '                                            d                                                                 ',
      '                                            d                                                               j ',
      '      u          j                     u                      u b       b        b                          j ',
      'dddd  j  d j d o      ddd o                t              d  bb       b     b  b       b  b  b         b ddddf',
      'd                                                                  b                 b           b  b         ',
      'd                                                                                                             ',
      'd                                                                                                             ',
      'd                                                                                                             ',
      'd                                                                                                             ',
      'd                                                                                                        ddddf',
    ],
  },
];

// ---------- Scenes ----------

// One scene handles every level; n is the 1-based level number.
scene('level', (n) => {
  const cfg = LEVELS[n - 1];
  const brickSpeed = cfg.brickSpeed || 0;
  const butterflyScale = cfg.butterflyScale || 1;
  let jumpForce = JUMP;

  const player = add([
    sprite('player'),
    scale(1.5),
    pos(...cfg.spawn),
    body(),
    'player',
  ]);

  addLevel(cfg.map, {
    width: cfg.tile,
    height: cfg.tile,
    'x': [sprite('grass'), solid()],
    'o': [sprite('brick'), solid(), scale(2), 'brick'],
    'd': [sprite('darkbrick'), solid(), scale(5), 'darkbrick'],
    'b': [sprite('breakingblock'), solid(), scale(5), 'breaking'],
    'j': [sprite('invisibleblock'), solid(), scale(5)],
    't': [sprite('trampoline'), solid(), scale(2), 'trampoline'],
    'v': [sprite('spike2'), solid(), scale(2), 'evil'],
    'l': [sprite('lava'), solid(), scale(5), 'evil'],
    'u': [sprite('butterfly'), scale(butterflyScale), 'butterfly', 'evil'],
    'k': [sprite('boulder'), solid(), body(), 'evil'],
    'f': [sprite('finish'), solid(), scale(5), 'finish'],
  });

  // Controls
  keyDown('a', () => player.move(-SPEED, 0));
  keyDown('d', () => player.move(SPEED, 0));
  keyPress('space', () => {
    if (player.grounded()) player.jump(jumpForce);
  });

  // Camera follows the player; falling off the map is a death
  player.action(() => {
    camPos(player.pos);
    if (player.pos.y >= FALL_DEATH_Y) go('lose', n);
  });

  // Hazards
  player.collides('evil', () => {
    destroy(player);
    go('lose', n);
  });
  action('butterfly', (b) => b.move(-BUTTERFLY_SPEED, 0));

  // Trampolines boost the jump until you next touch a brick.
  // Note: Kaboom 0.5 only fires the first collides() handler registered per tag on an object,
  // so everything that happens on brick contact lives in one handler.
  player.collides('trampoline', () => { jumpForce = TRAMPOLINE_JUMP; });
  player.collides('darkbrick', () => { jumpForce = JUMP; });
  player.collides('brick', (brick) => {
    jumpForce = JUMP;
    if (brickSpeed > 0) brick.sliding = true;   // later levels: touching a brick sets it sliding
  });

  // Sliding bricks keep going until they hit a dark brick and break
  if (brickSpeed > 0) {
    action('brick', (brick) => {
      if (brick.sliding) brick.move(brickSpeed, 0);
    });
    collides('brick', 'darkbrick', (brick) => destroy(brick));
  }

  // Breaking blocks crumble shortly after you touch them
  player.collides('breaking', (block) => {
    if (block.crumbling) return;
    block.crumbling = true;
    wait(BREAK_DELAY, () => destroy(block));
  });

  // Reaching the finish moves on to the next level, or the end screen
  player.collides('finish', () => {
    if (n < LEVELS.length) go('level', n + 1);
    else go('end');
  });
});

scene('main', () => {
  const lines = [
    'Welcome to my game, use A&D to move and space to jump',
    'Make it to the finish line to get to the next level',
    'Level select: Press 1 for level 1 or 2 for level 2 etc...',
    "PS: The butterflies aren't as friendly as they look!",
  ];
  lines.forEach((line, i) => add([text(line), pos(10, 10 + i * 10)]));

  keyPress('space', () => go('level', 1));
  for (let n = 1; n <= LEVELS.length; n++) {
    keyPress(String(n), () => go('level', n));
  }
});

// Shared game-over screen; n is the level to retry.
scene('lose', (n) => {
  const cx = width() / 2;
  const cy = height() / 2;
  add([text('GAME OVER'), pos(cx, cy - 20), origin('center')]);
  add([text('SPACE TO RETRY LEVEL ' + n), pos(cx, cy), origin('center')]);
  add([text('ENTER TO GO BACK TO LEVEL SELECT'), pos(cx, cy + 12), origin('center')]);

  keyPress('space', () => go('level', n));
  keyPress('enter', () => go('main'));
});

scene('end', () => {
  const cx = width() / 2;
  const cy = height() / 2;
  add([text('CONGRATULATIONS YOU COMPLETED THE GAME'), pos(cx, cy), origin('center')]);
  add([text('ENTER TO GO BACK TO LEVEL SELECT'), pos(cx, cy + 12), origin('center')]);

  keyPress('enter', () => go('main'));
});

start('main');
