// AWS API Gateway bill storage adapter.
const API_BASE = "https://umasb48wm0.execute-api.us-east-1.amazonaws.com";
const BILLS_URL = `${API_BASE}/bills`;

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
    });
  } catch (error) {
    throw new Error(`Could not reach AWS API. Check API Gateway CORS and network access. ${error.message}`);
  }
  const raw = await response.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); }
    catch { throw new Error(`AWS returned non-JSON data (HTTP ${response.status}).`); }
  }
  if (!response.ok) {
    const message = data?.message || data?.error || `HTTP ${response.status} ${response.statusText}`;
    throw new Error(`AWS API error: ${message}`);
  }
  if (data && data.statusCode && Number(data.statusCode) >= 400) {
    throw new Error(`AWS Lambda error: ${data.body || data.message || data.statusCode}`);
  }
  // Support Lambda proxy responses where the JSON payload is wrapped in body.
  if (data && typeof data.body === "string") {
    try { data = JSON.parse(data.body); } catch { /* keep original body if not JSON */ }
  }
  return data;
}

function normalizeBill(bill) {
  return {
    ...bill,
    id: String(bill.id ?? bill.billId ?? bill.billID ?? crypto.randomUUID()),
    category: bill.category ?? "Other",
    description: bill.description ?? bill.name ?? "Untitled bill",
    amount: Number(bill.amount ?? 0),
    dueDate: bill.dueDate ?? bill.due_date ?? "",
    status: bill.status ?? "Pending"
  };
}

export const billStore = {
  async getAll() {
    const data = await request(BILLS_URL, { method: "GET" });
    const list = Array.isArray(data) ? data : (data?.bills ?? data?.items ?? data?.data ?? []);
    if (!Array.isArray(list)) throw new Error("GET /bills must return an array or an object containing a bills array.");
    return list.map(normalizeBill);
  },
  async create(bill) {
    const data = await request(BILLS_URL, { method: "POST", body: JSON.stringify(bill) });
    const created = data?.bill ?? data?.data ?? data;
    // If Lambda returns no created object, refresh from GET to obtain server-generated ID.
    if (!created || typeof created !== "object" || Array.isArray(created)) {
      const latest = await this.getAll();
      return latest[0] ?? bill;
    }
    return normalizeBill(created);
  },
  async update() {
    throw new Error("Editing bills needs a backend update endpoint (for example PUT /bills/{id}); only GET and POST are configured currently.");
  },
  async remove() {
    throw new Error("Deleting bills needs a backend delete endpoint (for example DELETE /bills/{id}); only GET and POST are configured currently.");
  },
  async resetDemo() {
    throw new Error("Demo reset is disabled when bills are stored in AWS.");
  }
};
