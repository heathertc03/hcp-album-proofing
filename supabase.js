// Supabase configuration — Heather Carraway Photography
const SUPABASE_URL = 'https://tqncfyijpqzmauwbvemm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxbmNmeWlqcHF6bWF1d2J2ZW1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3OTcyNzIsImV4cCI6MjA5NTM3MzI3Mn0.2aD-7dUxMu_BvWpU4xsJCcTxZUTDnmYxWGMNjY2pWLw';

// Simple fetch wrapper for Supabase REST API
const db = {
  async get(table, params = '') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async post(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async patch(table, id, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async delete(table, id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  },

  async uploadImage(path, file) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/spreads/${path}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': file.type,
        'x-upsert': 'true'
      },
      body: file
    });
    if (!res.ok) throw new Error(await res.text());
    return `${SUPABASE_URL}/storage/v1/object/public/spreads/${path}`;
  }
};

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}
