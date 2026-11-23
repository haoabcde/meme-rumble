import type { CombatEvent } from '../core/types.js';

export const turretEffectLife = {
  'turret-land': 15, 'turret-ready': 18, 'turret-fire': 7, 'turret-burst': 24, 'grenade-impact': 26
};
type TurretEffect = CombatEvent & { kind: keyof typeof turretEffectLife };

export function isTurretEffect(event: CombatEvent): event is TurretEffect {
  return Object.hasOwn(turretEffectLife, event.kind);
}

function drawShockwave(ctx: CanvasRenderingContext2D, reach: number, progress: number, hot: boolean) {
  const width = reach * (.18 + .82 * (1 - (1 - progress) ** 2));
  ctx.strokeStyle = hot ? '#ffb56a' : '#95eaff';
  ctx.lineWidth = 5 - 3 * progress;
  ctx.globalAlpha *= (1 - progress) ** .7;
  ctx.beginPath();
  ctx.ellipse(0, -3, width, 4 + width * .15, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = hot ? '#fff2bd' : '#dcf6ff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, -3, width * .9, 2 + width * .11, 0, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawTurretEffect(ctx: CanvasRenderingContext2D, event: TurretEffect, age: number) {
  const { kind, facing = 1, turretKind, radius = 0 } = event;
  const hot = turretKind === 'howitzer';
  if (kind === 'turret-land') {
    ctx.globalAlpha *= Math.max(0, 1 - age / 15);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const x = side * (11 + i * (8 + age * .48));
        const y = -1 - age * (.14 + i * .08);
        ctx.fillStyle = i % 2 ? '#dccbad' : '#9d897e';
        ctx.fillRect(Math.round(x), Math.round(y), 8 + age * .34, 3 + i * 1.5);
      }
    }
  } else if (kind === 'turret-ready') {
    drawShockwave(ctx, radius, age / turretEffectLife[kind], hot);
    ctx.fillStyle = hot ? '#ffc785' : '#b0f1ff';
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const x = side * (9 + i * 9 + age * (1.4 + i * .2));
        ctx.fillRect(x, -4 - age * (.5 + i % 3 * .35), 5 + i, 2.6);
      }
    }
  } else if (kind === 'turret-fire') {
    ctx.scale(facing, 1);
    ctx.globalAlpha *= Math.max(0, 1 - age / 7);
    ctx.fillStyle = hot ? '#ff9f49' : '#55cfff';
    ctx.fillRect(-5, -6, 17 + age, 12);
    ctx.fillStyle = hot ? '#fff0aa' : '#d1faff';
    ctx.fillRect(0, -2, 16 + age * 2, 4);
  } else if (kind === 'grenade-impact') {
    drawShockwave(ctx, radius, age / turretEffectLife[kind], true);
    if (age < 9) {
      ctx.fillStyle = '#ffc479';
      ctx.globalAlpha *= 1 - age / 11;
      const width = 18 + age * 3;
      ctx.fillRect(-width, -27 - age, width * 2, 22 + age);
      ctx.fillStyle = '#fff0ba';
      ctx.fillRect(-width * .65, -21 - age, width * 1.3, 14 + age);
    }
    for (let i = 0; i < 13; i++) {
      const x = (i % 2 ? 1 : -1) * (i * 3 + age * (1.5 + i * .25));
      const y = -5 - age * (2 + i % 5 * .83) + age ** 2 * .16;
      if (y >= 0) continue;
      ctx.fillStyle = i % 3 ? '#eb8f43' : '#6c5360';
      ctx.fillRect(Math.round(x), Math.round(y), 5 + i % 4 * 2, 4 + i % 3 * 2);
    }
  } else if (kind === 'turret-burst') {
    const fade = Math.max(0, 1 - age / 24);
    ctx.globalAlpha *= fade;
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (5 + (1.5 + i * .34) * age);
      const y = -26 - i * 4 - age * (1 + i % 3) + .12 * age * age;
      const size = 5 + i % 4 * 3;
      ctx.fillStyle = i % 3 ? '#ffc061' : '#72d9ff';
      ctx.fillRect(Math.round(x), Math.round(y), size, size);
      ctx.fillStyle = '#4a4454';
      ctx.fillRect(Math.round(x) - 3, Math.round(y) + size, size + 6, 4);
    }
    if (age < 8) {
      ctx.fillStyle = '#fff0b8';
      ctx.globalAlpha *= 1 - age / 8;
      ctx.fillRect(-24 - age, -82 - age, 48 + age * 2, 51);
      ctx.fillRect(-39 - age, -68, 78 + age * 2, 24);
    }
  }
}
