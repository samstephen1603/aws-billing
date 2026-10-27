// Budget storage adapter. Replace these methods with API calls when the AWS backend is ready.
const KEY = "smartbill-budgets-v1";
function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch (error) { console.warn("Could not read budgets from localStorage", error); return []; }
}
function write(items) { localStorage.setItem(KEY, JSON.stringify(items)); }
export const budgetStore = {
  async getAll() { return read(); },
  async create(budget) { const items = read(); const created = { ...budget, id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) }; write([created, ...items]); return created; },
  async update(id, updates) { const items = read().map(item => item.id === id ? { ...item, ...updates } : item); write(items); return items.find(item => item.id === id); },
  async remove(id) { write(read().filter(item => item.id !== id)); }
};
