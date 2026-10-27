# Smart Billing and Expense Management System

A responsive dark-themed household bill tracker built with HTML, CSS and vanilla JavaScript. Navigation switches between Dashboard, All bills, Add a bill, Expense summary, and Budget management without requiring users to scroll through one long page.

## Run locally
1. Extract the ZIP and open this folder in VS Code.
2. Open **Terminal → New Terminal**.
3. Run `py -m http.server 8000` (or `python -m http.server 8000` if Python is on PATH).
4. Open `http://localhost:8000` in your browser. Keep the terminal running.

## Features
- Dark, cloud-inspired interface with AWS integration readiness callout.
- Dashboard: total expenses, paid/pending counts, upcoming due dates and category chart.
- Bills: search/filter, mark as paid, edit, delete and export CSV.
- Add bill form and separate category expense summary page.
- Budget management: create, edit and delete monthly overall/category budgets.
- Spending insights: highest-spending category, categories near their limits, and overspending indicators.
- Sample data on first launch and browser localStorage persistence.
- Responsive layout for desktop and mobile.

## AWS integration
Bill operations are centralized in `storage.js`; budget operations are centralized in `budgetStorage.js`. (`getAll`, `create`, `update`, `remove`). Replace those implementations with `fetch()` calls to your API Gateway endpoint when your backend is ready. The UI expects bill records with `id`, `category`, `description`, `amount`, `dueDate` (`YYYY-MM-DD`) and `status` (`Paid` or `Pending`). Configure API Gateway CORS for your local and deployed frontend origins. Never place AWS secret keys in frontend code.

The Chart.js doughnut chart loads from jsDelivr, so an internet connection is required for charts. The rest of the frontend is plain HTML/CSS/JS.

Budget records are stored locally under `smartbill-budgets-v1` and contain `id`, `name`, `category`, `amount`, and `month` (`YYYY-MM`). The budget insights compare the total of bill amounts by due-date month (regardless of Paid/Pending status) against configured limits.


## Insights workspace

The Insights sidebar screen includes a category pie chart, a monthly recorded-expense bar chart, a yearly trend line, year selection, and highlights. Forecasts fill empty future months using the average of months with recorded bills; projected values are estimates and are visually separated from recorded amounts. Chart.js is loaded from jsDelivr, so the charts need an internet connection.
