# Final Lab Report: PayFlux Invoice Generator System

This document provides a comprehensive technical overview of the **PayFlux Invoice Management System**. It breaks down the architecture, data structures, module responsibilities, and the rationale behind the chosen technology stack, suitable for academic lab submissions or technical evaluations.

---

## 1. System Overview & Technology Stack

PayFlux is a full-stack, data-driven web application designed to help freelancers and small businesses manage customers, catalog items, create invoices, track partial payments, and generate PDF bills.

### Technology Stack & Rationale

**Frontend (Client-Side)**
* **React.js**: Chosen for its component-based architecture and Virtual DOM, which allows for efficient updates. Essential for the "Live Real-Time Invoice Preview" feature where state changes constantly as the user types.
* **Vite**: Used instead of Create React App as the build tool due to its lightning-fast Hot Module Replacement (HMR) and optimized rollup production build.
* **Tailwind CSS**: A utility-first CSS framework that drastically reduces the time spent switching between CSS files and JS files. It allowed for the rapid creation of a highly modern and responsive UI.
* **Framer Motion**: Incorporated to handle complex UI animations (like modal pop-ups, page transitions, and toast notifications) smoothly, giving the application a premium feel.
* **Recharts**: A composable charting library built on React components used for the Customer and Item Analytics dashboards.

**Backend (Server-Side)**
* **Node.js & Express.js**: Node offers an asynchronous, event-driven runtime ideal for Handling RESTful API requests. Express provides a minimalistic routing framework and robust middleware integrations.
* **Puppeteer**: A headless browser Node API. It is used to render the invoice data into an HTML template and print it as a high-fidelity PDF document on the server side.

**Database & Authentication**
* **PostgreSQL (Supabase)**: A robust, ACID-compliant relational database. Given that the system deals with structured financial data (Invoices mapped to Customers, Invoices mapped to Items/Payments), a relational structure (SQL) was the safest and most normalized choice.
* **JWT (JSON Web Tokens) & bcrypt**: Utilized for stateless user authentication. Bcrypt securely hashes passwords before DB insertion, while JWT manages session securely.

---

## 2. System Flow

The system operates on an event-driven Request/Response lifecycle.

1. **Authentication Flow**: The user enters their credentials. The React frontend sends an HTTP `POST` request to the backend. The backend verifies the hash, generates a JWT, and sends it back. The frontend stores this JWT and the `authContext` marks the user as "logged in".
2. **Navigation Flow**: React Router DOM handles client-side routing. Navigating to `/invoices` fetches a list of invoices asynchronously via `api.js()`, displaying a loading skeleton until data resolves from the backend.
3. **Creation Flow (Live Editor)**: When a user builds a new invoice, the React component stores the data in local state (`useState`). It computes totals, taxes, and layouts the preview pane simultaneously. 
4. **Persistence Flow**: When the user clicks "Save", a payload is finalized. `api.js` attaches the JWT as a Bearer token and triggers a `POST /api/invoices` request.
5. **PDF Generation Flow**: To print an invoice, the frontend requests a PDF blob from the backend. The server controller triggers `browserPool.js`, loading a Puppeteer headless tab. The tab hydrates the invoice data into CSS and HTML, generates a PDF buffer, and streams it back to the client.

---

## 3. Data Flow Architecture

A typical data cycle (e.g., retrieving analytics or saving an invoice) traverses the following path:

**Client → Network → Server → Database → Server → Network → Client**

1. **Client (UI Component)**: User clicks "Save". React state compiles the JSON Object.
2. **Client (API Layer - `src/api.js`)**: Intercepts the request, attaches the `Authorization: Bearer <token>` header, and executes the `fetch()`.
3. **Server (Router - `backend/routes/`)**: The Express router matches the URL path (e.g., `/api/invoices`) and HTTP Method.
4. **Server (Middleware - `backend/middleware/`)**: The `authMiddleware` intercepts. It decrypts the JWT. If valid, it attaches `req.user` and passes the request to the controller.
5. **Server (Controller - `backend/controllers/`)**: The controller contains the business logic. It validates the data payloads and formulates an SQL query.
6. **Server (Database Layer - `backend/db.js`)**: Connects to PostgreSQL using `pg` connection pools. The query is executed.
7. **Return Trip**: The database returns the newly created row. The Controller wraps it in a standard HTTP 200/201 JSON response. The React UI unwraps the response and pushes a success notification.

---

## 4. File Structure & Module Breakdown

### The Backend (`/backend`)
* **`server.js`**: The foundational entry point. It initializes Express, sets up CORS (Cross-Origin Resource Sharing) policies, mounts the core routers onto path prefixes (like `/api`), and boots the HTTP listener port.
* **`db.js`**: Manages PostgreSQL database connectivity through connection pooling (`pg` library) to ensure the server doesn't exhaust DB connection limits under load.
* **`schema.js`**: Contains initialization schemas, defining the structural tables like `users`, `invoices`, `customers`, `items`, and `payments`.
* **`browserPool.js`**: A performance-optimized module. Instead of spinning up a heavy Chrome instance every time a PDF is requested, this maintains a "pool" of ready-to-go Puppeteer browser tabs, dramatically speeding up PDF export times.
* **`/routes/` directory**: Maps URI endpoints to specific controller functions (e.g., `routes/invoices.js` handles `/api/invoices`, sorting `GET`, `POST`, `PUT`, `DELETE` methods).
* **`/controllers/` directory**: The brain of the API. Files like `paymentController.js` or `analyticsController.js` retrieve data from `req.body`, execute complex SQL logic, compute analytics mathematics, and output JSON.
* **`/middleware/` directory**: Functions that run "in the middle" of a request before the controller. Mainly houses `authMiddleware.js` for guarding secure API endpoints.

### The Frontend (`/frontend/src`)
* **`App.jsx` & `main.jsx`**: The core React wrappers. `main.jsx` injects React into the HTML DOM. `App.jsx` handles global layout structures (like the Sidebar) and Maps URL paths to distinct Page components.
* **`authContext.jsx`**: A React Context Provider. It provides 'global state' accessible to any component in the tree, specifically tracking if a user is currently logged in, their user ID, and handling global logout functionality.
* **`api.js`**: A centralized library for making HTTP calls. It means components don't need to manually configure headers or handle base URLs on every request.
* **`/pages/` directory**: View-level container components. (e.g., `Invoices.jsx`, `Customers.jsx`, `Profile.jsx`). Pages fetch initial data and distribute it down to smaller components.
* **`/components/` directory**: Reusable UI blocks. Features complex domain components (like `InvoiceForm` or `AnalyticsCharts`) and foundational UI elements inside `/ui/` (like `dialog.jsx`, `button.jsx` patterned from Radix Primitives).
* **`/lib/` & `/utils/` directory**: General utility functions like `utils.js` for formatting currency, parsing SQL dates into human-readable strings, or merging Tailwind CSS classes (`clsx`, `tailwind-merge`).
* **`index.css`**: The global stylesheet file responsible for injecting Tailwind’s base styles, component classes, and customized CSS variables for root thematic colors.
