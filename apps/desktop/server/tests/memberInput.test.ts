import { describe, expect, it } from 'vitest';
import { contactProblem, nameProblem } from '../src/util/validate';
import { TestServer } from './helpers';

const PLAN = 'Regular Plan - Monthly (No Treadmill)';

describe('name rule', () => {
  it.each(['Ian', 'Rose Garcia', 'Juan Dela Cruz Jr.', "Shaquille O'Neil", 'Ma-an Reyes', 'Dr. Niño Peña', 'Zoë Müller'])('accepts %s', (name) => {
    expect(nameProblem(name)).toBeNull();
  });

  it.each(['123425', 'Ian 2', 'R0se', 'A', '..', '12', 'Rose@home', 'Rose_Garcia', '-Ian', "'Ian"])('refuses %s', (name) => {
    expect(nameProblem(name)).not.toBeNull();
  });
});

describe('contact number rule', () => {
  it.each(['09171234567', '+63 917 123 4567', '(082) 123-4567', '0917-123-4567', '1234567'])('accepts %s', (contact) => {
    expect(contactProblem(contact)).toBeNull();
  });

  it.each(['asdfad', '0917abc4567', '0917', '+', '123456', '12345678901234567', 'call me', '09171234567 ext 2', '+63+917'])('refuses %s', (contact) => {
    expect(contactProblem(contact)).not.toBeNull();
  });
});

describe('members: an email is required', () => {
  it('refuses a new member without one, and refuses clearing it later', async () => {
    const api = await TestServer.start();
    try {
      const token = await api.login();
      const member = { name: 'Rose Garcia', contact: '09171234567', plan: PLAN };
      for (const email of [undefined, '', '   ']) {
        const res = await api.request('POST', '/api/members', { ...member, email }, token);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/email/i);
      }
      expect((await api.request('GET', '/api/members', undefined, token)).body).toEqual([]);

      const created = await api.request('POST', '/api/members', { ...member, email: 'rose@example.com' }, token);
      expect(created.status).toBe(201);
      const id = created.body.member.id;
      expect((await api.request('PUT', `/api/members/${id}`, { email: '' }, token)).status).toBe(400);
      expect((await api.request('PUT', `/api/members/${id}`, { name: 'Rose G. Santos' }, token)).status).toBe(200);
    } finally {
      await api.stop();
    }
  });
});

describe('members: each email address belongs to one member', () => {
  it('refuses a second member with the same address, whatever the capital letters', async () => {
    const api = await TestServer.start();
    try {
      const token = await api.login();
      const add = (name: string, email: string) => api.request('POST', '/api/members', { name, email, plan: PLAN }, token);
      expect((await add('Rose Garcia', 'family@example.com')).status).toBe(201);
      const again = await add('Ian Garcia', 'Family@Example.com');
      expect(again.status).toBe(400);
      expect(again.body.error).toMatch(/Rose Garcia \(M-001\) already uses this email/);

      const ian = await add('Ian Garcia', 'ian@example.com');
      const id = ian.body.member.id;
      expect((await api.request('PUT', `/api/members/${id}`, { email: 'FAMILY@example.com' }, token)).status).toBe(400);
      // Saving a member's own address again is not a clash.
      expect((await api.request('PUT', `/api/members/${id}`, { email: 'ian@example.com', name: 'Ian G. Cruz' }, token)).status).toBe(200);
    } finally {
      await api.stop();
    }
  });
});

describe('members: the contact number is optional', () => {
  it('saves a member without one, lets it be cleared, and still checks one that is given', async () => {
    const api = await TestServer.start();
    try {
      const token = await api.login();
      const member = { name: 'Rose Garcia', email: 'rose@example.com', plan: PLAN };
      const created = await api.request('POST', '/api/members', member, token);
      expect(created.status).toBe(201);
      expect(created.body.member.contact).toBe('');
      const id = created.body.member.id;
      expect((await api.request('PUT', `/api/members/${id}`, { contact: '09171234567' }, token)).body.contact).toBe('09171234567');
      expect((await api.request('PUT', `/api/members/${id}`, { contact: '' }, token)).body.contact).toBe('');
      expect((await api.request('PUT', `/api/members/${id}`, { contact: '0917' }, token)).status).toBe(400);
    } finally {
      await api.stop();
    }
  });
});

describe('members: name and contact are checked by the API', () => {
  it('refuses a name with digits and a contact with letters (the case seen on screen)', async () => {
    const api = await TestServer.start();
    try {
      const token = await api.login();
      const bad = await api.request('POST', '/api/members', { name: '123425', contact: 'asdfad', plan: PLAN }, token);
      expect(bad.status).toBe(400);
      const badName = await api.request('POST', '/api/members', { name: '123425', contact: '09171234567', plan: PLAN }, token);
      expect(badName.status).toBe(400);
      expect(badName.body.error).toMatch(/name/i);
      const badContact = await api.request('POST', '/api/members', { name: 'Rose Garcia', contact: 'asdfad', plan: PLAN }, token);
      expect(badContact.status).toBe(400);
      expect(badContact.body.error).toMatch(/contact/i);
      expect((await api.request('GET', '/api/members', undefined, token)).body).toEqual([]);

      const ok = await api.request('POST', '/api/members', { name: '  Rose   Garcia ', contact: '+63 917 123 4567', email: 'rose@example.com', plan: PLAN }, token);
      expect(ok.status).toBe(201);
      expect(ok.body.member.name).toBe('Rose Garcia'); // extra spaces are tidied
    } finally {
      await api.stop();
    }
  });

  it('applies the same rules when editing a member', async () => {
    const api = await TestServer.start();
    try {
      const token = await api.login();
      const created = await api.request('POST', '/api/members', { name: 'Rose Garcia', contact: '09171234567', email: 'rose@example.com', plan: PLAN }, token);
      const id = created.body.member.id;
      expect((await api.request('PUT', `/api/members/${id}`, { name: 'Rose 99' }, token)).status).toBe(400);
      expect((await api.request('PUT', `/api/members/${id}`, { contact: 'abc' }, token)).status).toBe(400);
      expect((await api.request('PUT', `/api/members/${id}`, { name: 'Rose G. Santos', contact: '0918 123 4567' }, token)).status).toBe(200);
    } finally {
      await api.stop();
    }
  });
});
