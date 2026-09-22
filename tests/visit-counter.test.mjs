import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker, { koreaDate } from '../cloudflare/visit-counter/worker.js';
import { planVisit } from '../src/ui/visit-counter.js';

test('업데이트 확인이 먼저 URL을 기억하고 방문 집계가 바로 이어서 실행된다', () => {
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const updater = index.indexOf('src/ui/update-check.js');
  const counter = index.indexOf('src/ui/visit-counter.js');
  assert.ok(updater >= 0 && counter > updater);
  const endpoint = index.match(/name="hhjcon-visit-counter-endpoint" content="([^"]+)"/)?.[1];
  assert.equal(new URL(endpoint).origin, 'https://hhjcon-counter.hhjmods2.workers.dev');
});

test('일반 진입만 집계하고 새로고침과 버전 갱신 재진입은 제외한다', () => {
  assert.deepEqual(planVisit('https://hhjmods.github.io/HhjConNovel/', 'navigate'), {
    shouldCount: true,
    cleanUrl: ''
  });
  assert.equal(planVisit('https://hhjmods.github.io/HhjConNovel/', 'reload').shouldCount, false);
  assert.deepEqual(
    planVisit('https://hhjmods.github.io/HhjConNovel/?tab=1&hhjcon-version=2#story', 'navigate'),
    {
      shouldCount: false,
      cleanUrl: 'https://hhjmods.github.io/HhjConNovel/?tab=1#story'
    }
  );
  assert.equal(planVisit('https://hhjmods.github.io/HhjConNovel/?tab=1#story', 'navigate').shouldCount, true);
});

test('Worker는 한국 날짜를 한 행에 원자적으로 더하고 다른 출처를 거절한다', async () => {
  assert.equal(koreaDate(Date.parse('2026-09-21T15:00:00Z')), '2026-09-22');

  let query = '';
  let date = '';
  let runs = 0;
  const env = {
    DB: {
      prepare(sql) {
        query = sql;
        return {
          bind(value) {
            date = value;
            return { run: async () => { runs += 1; } };
          }
        };
      }
    }
  };

  const accepted = await worker.fetch(new Request('https://counter.example/', {
    method: 'POST',
    headers: { Origin: 'https://hhjmods.github.io' }
  }), env);
  const rejected = await worker.fetch(new Request('https://counter.example/', {
    method: 'POST',
    headers: { Origin: 'https://example.com' }
  }), env);

  assert.equal(accepted.status, 204);
  assert.equal(rejected.status, 404);
  assert.equal(runs, 1);
  assert.match(query, /ON CONFLICT\(date\) DO UPDATE SET count = count \+ 1/);
  assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
});
