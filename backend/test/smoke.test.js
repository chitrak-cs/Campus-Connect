const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.setup);
after(h.teardown);

describe('registration', () => {
  test('a "faculty" signup is stored as a student with requested_role', async () => {
    const email = `fac-${h.RUN}@example.test`;
    const res = await h.api().post('/api/auth/register').send({ name: 'Fac Tester', email, password: 'Passw0rd!x', role: 'faculty' });
    assert.equal(res.status, 201);
    assert.equal(res.body.facultyPending, true);
    const { rows } = await h.pool.query('SELECT id, role, requested_role FROM users WHERE email = $1', [email]);
    h.trackUser(rows[0].id);
    assert.equal(rows[0].role, 'student');
    assert.equal(rows[0].requested_role, 'faculty');
  });

  test('registration email is case-insensitive unique', async () => {
    const email = `Case-${h.RUN}@Example.test`;
    const a = await h.api().post('/api/auth/register').send({ name: 'A', email, password: 'Passw0rd!x' });
    assert.equal(a.status, 201);
    const { rows } = await h.pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [email.toLowerCase()]);
    h.trackUser(rows[0].id);
    const b = await h.api().post('/api/auth/register').send({ name: 'B', email: email.toUpperCase(), password: 'Passw0rd!x' });
    assert.equal(b.status, 409);
  });
});

describe('login', () => {
  test('wrong password -> 401 JSON, and a disabled account does not leak', async () => {
    const disabled = await h.makeUser({ active: false });
    const res = await h.api().post('/api/auth/login').send({ email: disabled.email, password: 'definitely-wrong' });
    assert.equal(res.status, 401);
    assert.match(res.headers['content-type'], /json/);
    assert.equal(res.body.message, 'Invalid credentials');
    // only the correct password reveals the account state
    const right = await h.api().post('/api/auth/login').send({ email: disabled.email, password: disabled.password });
    assert.equal(right.status, 403);
  });
});

describe('one-time codes', () => {
  async function startRegistration(tag) {
    const email = `otp-${tag}-${h.RUN}@example.test`;
    const res = await h.api().post('/api/auth/register').send({ name: 'Otp Tester', email, password: 'Passw0rd!x' });
    const { rows } = await h.pool.query('SELECT id FROM users WHERE email = $1', [email]);
    h.trackUser(rows[0].id);
    return { email, registerId: res.body.registerId };
  }

  test('the 6th attempt is rejected even with the right code', async () => {
    const { email, registerId } = await startRegistration('attempts');
    const code = h.lastOtpFor(email);
    const wrong = code === '111111' ? '222222' : '111111';
    for (let i = 0; i < 5; i++) {
      const r = await h.api().post('/api/auth/verify-otp').send({ registerId, code: wrong });
      assert.equal(r.status, 400);
    }
    const sixth = await h.api().post('/api/auth/verify-otp').send({ registerId, code });
    assert.equal(sixth.status, 400);
    assert.match(sixth.body.message, /too many/i);
  });

  test('a used code cannot be reused', async () => {
    const { email, registerId } = await startRegistration('reuse');
    const code = h.lastOtpFor(email);
    const first = await h.api().post('/api/auth/verify-otp').send({ registerId, code });
    assert.equal(first.status, 200);
    assert.ok(first.body.token);
    const again = await h.api().post('/api/auth/verify-otp').send({ registerId, code });
    assert.equal(again.status, 400);
  });

  test('a reset code is not accepted by verify-otp', async () => {
    const user = await h.makeUser();
    const forgot = await h.api().post('/api/auth/forgot-password').send({ email: user.email });
    const code = h.lastOtpFor(user.email);
    assert.ok(code, 'a reset code was emailed');
    const res = await h.api().post('/api/auth/verify-otp').send({ id: forgot.body.resetId, code });
    assert.equal(res.status, 400);
  });

  test('forgot-password answers identically for unknown emails', async () => {
    const known = await h.makeUser();
    const a = await h.api().post('/api/auth/forgot-password').send({ email: known.email });
    const b = await h.api().post('/api/auth/forgot-password').send({ email: `nobody-${h.RUN}@example.test` });
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(a.body.message, b.body.message);
    assert.deepEqual(Object.keys(a.body).sort(), Object.keys(b.body).sort());
  });
});

describe('files', () => {
  test('?limit=999&page=-3 is clamped: 200 with at most 50 results', async () => {
    const u = await h.makeUser();
    const res = await h.api().get('/api/files?limit=999&page=-3').set(h.auth(u));
    assert.equal(res.status, 200);
    assert.ok(res.body.files.length <= 50);
    assert.equal(res.body.page, 1);
  });

  test('a .exe renamed .pdf with a non-PDF mime type is rejected with 400', async () => {
    const u = await h.makeUser();
    const res = await h.api().post('/api/files/upload').set(h.auth(u))
      .field('title', 'evil')
      .attach('file', Buffer.from('MZ'), { filename: 'evil.pdf', contentType: 'application/x-msdownload' });
    assert.equal(res.status, 400);
    assert.match(res.headers['content-type'], /json/);
  });

  test('protected routes return 401 without a token', async () => {
    for (const [method, path] of [['get', '/api/files'], ['get', '/api/groups'], ['get', '/api/admin/stats'], ['get', '/api/search?q=a'], ['get', '/api/announcements']]) {
      const res = await h.api()[method](path);
      assert.equal(res.status, 401, `${method.toUpperCase()} ${path}`);
    }
  });
});

describe('private groups', () => {
  test('non-members cannot join, list members, or read history', async () => {
    const owner = await h.makeUser();
    const outsider = await h.makeUser();
    const created = await h.api().post('/api/groups').set(h.auth(owner)).send({ name: 'Secret club', is_private: true });
    assert.equal(created.status, 201);
    const gid = created.body.group.id;
    h.trackGroup(gid);
    assert.ok(created.body.group.invite_code, 'creator receives the invite code');

    assert.equal((await h.api().post(`/api/groups/${gid}/join`).set(h.auth(outsider))).status, 403);
    assert.equal((await h.api().get(`/api/groups/${gid}/members`).set(h.auth(outsider))).status, 403);
    assert.equal((await h.api().get(`/api/messages/group/${gid}`).set(h.auth(outsider))).status, 403);

    const list = await h.api().get('/api/groups').set(h.auth(outsider));
    assert.ok(!list.body.groups.some((g) => g.id === gid), 'private group is hidden from non-members');
    const mine = await h.api().get('/api/groups').set(h.auth(owner));
    assert.ok(mine.body.groups.find((g) => g.id === gid).invite_code, 'owner still sees the code');
  });

  test('a socket that is not a member never receives group messages', async () => {
    const owner = await h.makeUser();
    const outsider = await h.makeUser();
    const created = await h.api().post('/api/groups').set(h.auth(owner)).send({ name: 'Socket club', is_private: true });
    const gid = created.body.group.id;
    h.trackGroup(gid);

    const so = await h.connectSocket(owner);
    const si = await h.connectSocket(outsider);
    let ownerGot = 0, leaked = 0;
    so.on('new_group_message', () => ownerGot++);
    si.on('new_group_message', () => leaked++);

    si.emit('join_groups', [gid]);                         // the old attack: ask to join any room
    si.emit('send_group_message', { group_id: gid, content: 'intruder' });
    // Send immediately after connecting: handlers must already be registered (regression test)
    so.emit('send_group_message', { group_id: gid, content: 'hello members' });
    await h.waitFor(() => ownerGot >= 1);
    await h.sleep(1500);                                   // then give any (forbidden) leak time to show up
    so.close(); si.close();

    assert.equal(ownerGot, 1, 'only the legitimate message was delivered');
    assert.equal(leaked, 0, 'the outsider received nothing');
    const { rows } = await h.pool.query('SELECT content FROM messages WHERE group_id = $1', [gid]);
    assert.deepEqual(rows.map((r) => r.content), ['hello members']);
  });

  test('removing a member stops live delivery to them', async () => {
    const owner = await h.makeUser();
    const member = await h.makeUser();
    const created = await h.api().post('/api/groups').set(h.auth(owner)).send({ name: 'Removal club', is_private: true });
    const gid = created.body.group.id;
    h.trackGroup(gid);
    await h.api().post('/api/groups/join-by-code').set(h.auth(member)).send({ code: created.body.group.invite_code }).expect(200);

    const so = await h.connectSocket(owner);
    const sm = await h.connectSocket(member);
    let got = 0;
    sm.on('new_group_message', () => got++);
    so.emit('send_group_message', { group_id: gid, content: 'one' });
    assert.ok(await h.waitFor(() => got >= 1), 'member receives while in the group');
    assert.equal(got, 1);

    await h.api().delete(`/api/groups/${gid}/members/${member.id}`).set(h.auth(owner)).expect(200);
    let ownerSaw = 0;
    so.on('new_group_message', () => ownerSaw++);
    so.emit('send_group_message', { group_id: gid, content: 'two' });
    await h.waitFor(() => ownerSaw >= 1);                  // the message was delivered to the owner...
    await h.sleep(1000);                                    // ...so a removed member would have received it by now
    so.close(); sm.close();
    assert.equal(got, 1, 'no delivery after removal');
  });
});

describe('admin safety', () => {
  test('an admin cannot demote or deactivate themselves', async () => {
    // a second admin exists so the "last admin" rule is not what blocks this
    const admin = await h.makeUser({ role: 'admin' });
    await h.makeUser({ role: 'admin' });
    const demote = await h.api().put(`/api/admin/users/${admin.id}`).set(h.auth(admin)).send({ role: 'student' });
    assert.equal(demote.status, 400);
    const deactivate = await h.api().put(`/api/admin/users/${admin.id}`).set(h.auth(admin)).send({ is_active: false });
    assert.equal(deactivate.status, 400);
  });

  test('students are forbidden from admin routes', async () => {
    const s = await h.makeUser();
    for (const [method, path] of [['get', '/api/admin/stats'], ['get', '/api/admin/users'], ['get', '/api/admin/role-requests'], ['get', '/api/files/pending']]) {
      const res = await h.api()[method](path).set(h.auth(s));
      assert.equal(res.status, 403, `${method.toUpperCase()} ${path}`);
    }
  });

  test('approving a role request promotes the user to faculty', async () => {
    const admin = await h.makeUser({ role: 'admin' });
    const reg = await h.api().post('/api/auth/register').send({ name: 'Wants Faculty', email: `wf-${h.RUN}@example.test`, password: 'Passw0rd!x', role: 'faculty' });
    assert.equal(reg.status, 201);
    const { rows } = await h.pool.query('SELECT id FROM users WHERE email = $1', [`wf-${h.RUN}@example.test`]);
    h.trackUser(rows[0].id);
    await h.api().post(`/api/admin/role-requests/${rows[0].id}/approve`).set(h.auth(admin)).expect(200);
    const after = await h.pool.query('SELECT role, requested_role FROM users WHERE id = $1', [rows[0].id]);
    assert.equal(after.rows[0].role, 'faculty');
    assert.equal(after.rows[0].requested_role, null);
  });
});

describe('sessions', () => {
  test('changing the password signs out other sessions', async () => {
    const u = await h.makeUser();
    const other = u.token;
    const change = await h.api().put('/api/auth/password').set(h.auth(u)).send({ currentPassword: u.password, newPassword: 'BrandNewPassw0rd!' });
    assert.equal(change.status, 200);
    assert.equal((await h.api().get('/api/auth/me').set({ Authorization: `Bearer ${other}` })).status, 401, 'old token rejected');
    assert.equal((await h.api().get('/api/auth/me').set({ Authorization: `Bearer ${change.body.token}` })).status, 200, 'fresh token works');
  });
});

describe('search', () => {
  test('wildcard characters are matched literally', async () => {
    const u = await h.makeUser();
    const res = await h.api().get('/api/search').query({ q: '%' }).set(h.auth(u));
    assert.equal(res.status, 200);
    assert.equal(res.body.files.length, 0);
    assert.equal(res.body.groups.length, 0);
    assert.equal((await h.api().get('/api/search').query({ q: '' }).set(h.auth(u))).status, 400);
  });
});

describe('chat ordering', () => {
  test('messages sent back-to-back are stored and returned in send order', async () => {
    const owner = await h.makeUser();
    const created = await h.api().post('/api/groups').set(h.auth(owner)).send({ name: 'Order club' });
    const gid = created.body.group.id;
    h.trackGroup(gid);

    const s = await h.connectSocket(owner);
    const received = [];
    s.on('new_group_message', (m) => received.push(m.content));
    for (let i = 1; i <= 6; i++) s.emit('send_group_message', { group_id: gid, content: `msg ${i}` });
    await h.waitFor(() => received.length >= 6, { timeout: 20000 });
    s.close();

    const expected = [1, 2, 3, 4, 5, 6].map((i) => `msg ${i}`);
    assert.deepEqual(received, expected, 'broadcast order');
    const hist = await h.api().get(`/api/messages/group/${gid}`).set(h.auth(owner));
    assert.deepEqual(hist.body.messages.map((m) => m.content), expected, 'history order');
  });
});
