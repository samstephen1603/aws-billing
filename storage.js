// Storage adapter: replace this module's functions with API calls when the AWS backend is ready.
const STORAGE_KEY = "billwise-bills-v1";

const dateOffset = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
};

const sampleBills = [
  { id: "sample-1", category: "Rent", description: "Monthly house rent", amount: 18000, dueDate: dateOffset(-2), status: "Paid" },
  { id: "sample-2", category: "Electricity", description: "Electricity bill", amount: 1850, dueDate: dateOffset(2), status: "Pending" },
  { id: "sample-3", category: "Water", description: "Water supply charges", amount: 450, dueDate: dateOffset(5), status: "Pending" },
  { id: "sample-4", category: "Other", description: "Internet connection", amount: 999, dueDate: dateOffset(7), status: "Paid" },
  { id: "sample-5", category: "Electricity", description: "Previous meter adjustment", amount: 320, dueDate: dateOffset(-5), status: "Paid" }
];

function readBills() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) return JSON.parse(saved);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleBills));
  } catch (error) {
    console.warn("Local storage unavailable; using sample bills.", error);
  }
  return [...sampleBills];
}

function writeBills(bills) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bills));
}

export const billStore = {
  async getAll() { return readBills(); },
  async create(bill) {
    const bills = readBills();
    const created = { ...bill, id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) };
    writeBills([created, ...bills]);
    return created;
  },
  async update(id, updates) {
    const bills = readBills().map(bill => bill.id === id ? { ...bill, ...updates } : bill);
    writeBills(bills);
    return bills.find(bill => bill.id === id);
  },
  async remove(id) {
    writeBills(readBills().filter(bill => bill.id !== id));
  },
  async resetDemo() {
    writeBills([...sampleBills]);
    return readBills();
  }
};
