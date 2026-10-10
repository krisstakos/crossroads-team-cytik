/* Commit — client for the Flask backend. Every call returns the server's JSON or throws an Error with
   { code, details, status }. The server speaks integer cents; the UI works in dollars, so the adapters convert here. */
'use strict';

const API = (function () {
  let csrf = null;
  let onUnauthenticated = () => {};

  async function call(method, url, body) {
    const opts = { method, headers: {}, credentials: 'same-origin' };
    if (csrf) opts.headers['X-CSRF-Token'] = csrf;
    if (body instanceof FormData) opts.body = body;
    else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res;
    try { res = await fetch(url, opts); }
    catch (e) { throw Object.assign(new Error('Cannot reach the server. Check your connection.'), { code: 'NETWORK', details: {}, status: 0 }); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = Object.assign(new Error(data.message || 'Something went wrong.'), { code: data.code || 'ERROR', details: data.details || {}, status: res.status });
      if (res.status === 401 && err.code === 'UNAUTHENTICATED') onUnauthenticated();
      throw err;
    }
    if (data && data.csrf) csrf = data.csrf;
    return data;
  }

  const dollars = c => (c == null ? c : c / 100);
  const cents = d => Math.round(d * 100);

  const task = t => ({
    id: t.id, name: t.name, icon: t.icon, status: t.status, byDate: t.byDate, createdAt: t.createdAt, deadline: t.deadline,
    durationMs: t.durationMs, penalty: dollars(t.penaltyCents), completedAt: t.completedAt, failedAt: t.failedAt,
    charged: dollars(t.chargedCents), charityId: t.charityId, attemptsLeft: t.attemptsLeft,
    proof: t.proof || undefined
  });
  const charity = c => ({
    id: c.id, name: c.name, category: c.category, desc: c.desc, goal: dollars(c.goalCents), raised: dollars(c.raisedCents),
    impact: { per: dollars(c.impact.perCents), text: c.impact.text }
  });

  return {
    cents, dollars,
    setUnauthenticatedHandler: fn => { onUnauthenticated = fn; },
    me: () => call('GET', '/api/me'),
    login: (username, password) => call('POST', '/api/auth/login', { username, password }),
    register: v => call('POST', '/api/auth/register', v),
    logout: () => call('POST', '/api/auth/logout'),
    patchMe: body => call('PATCH', '/api/me', body),
    addFunds: amount => call('POST', '/api/me/funds', { amountCents: cents(amount) }),
    selectCharity: id => call('PUT', '/api/me/charity', { id }),
    tasks: async () => (await call('GET', '/api/tasks')).map(task),
    activity: () => call('GET', '/api/activity'),
    charities: async () => (await call('GET', '/api/charities')).map(charity),
    createTask: body => call('POST', '/api/tasks', body),
    challenge: id => call('POST', `/api/tasks/${id}/challenge`),
    proof: (id, nonce, blob) => {
      const f = new FormData();
      f.append('nonce', nonce);
      f.append('image', blob, 'proof.jpg');
      return call('POST', `/api/tasks/${id}/proof`, f);
    },
    recommended: () => call('GET', '/api/recommended')
  };
})();
