<div align="center">
  <img src="https://img.shields.io/badge/PayFlux-Invoice_Generator-8B5CF6?style=for-the-badge&logoColor=white" alt="PayFlux" />
  <h1>✨ PayFlux ✨<br/>Modern Invoice Management System</h1>
  <p>A beautiful, fully-featured invoice generator built for freelancers and small businesses.</p>

  <p>
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
    <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
    <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
    <img src="https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase&logoColor=3ECF8E" alt="Supabase" />
  </p>
</div>

<br/>

## 🚀 Key Features

* **🎨 Beautiful & Intuitive UI**: Designed with TailwindCSS and Framer Motion for a seamless, modern, responsive experience. Dark mode included.
* **👁️ Live Real-time Preview**: See your invoice exactly as it will appear while you type! A powerful split-screen editor provides immediate visual feedback.
* **💰 Flexible Financials**: Comprehensive support for global tax configurations, customizable line-item discounts (fixed or percentage), and intuitive subtotal summaries.
* **💳 Partial Payments System**: Robust tracking of customer payments, dynamically calculated remaining balances, and automated invoice statuses (Draft, Sent, Unpaid, Partially Paid, Paid).
* **📊 Deep Analytics**: Dedicated dashboard and detail views for Customer and Item performance, visualized beautifully using Recharts.
* **📄 Instant PDF Generation**: Pixel-perfect, high-quality PDF exports powered seamlessly on the server by Puppeteer.
* **🔢 Smart Numbering**: Automatically sequencing invoice numbers or configured random identifier generation.

<br/>

## 🛠️ Technology Stack

### **Frontend App** (`payflux-web`)
* **Core:** React 18 & Vite
* **Styling:** TailwindCSS
* **Animations:** Framer Motion
* **Visualizations:** Recharts
* **UI Components:** Radix UI primitives & Lucide React icons

### **Backend Server** (`payflux-api`)
* **Core:** Node.js & Express.js
* **Database:** PostgreSQL (Schema versioning in `supabase/`)
* **Auth:** JWT (JSON Web Tokens) & bcrypt for payload security
* **Utilities:** Puppeteer for PDF rendering

<br/>

## 📂 Project Structure

```text
payflux/
├── frontend/          # React Single Page Application (SPA)
│   ├── src/           # Components, Hooks, Pages, Utility functions
│   └── public/        # Static assets
├── backend/           # Node.js/Express API Server
│   ├── routes/        # Route declarations & Endpoint mapping
│   ├── controllers/   # Core API business logic
│   └── server.js      # Express initialization and configuration
├── supabase/          # Database definition, setup and migrations
└── PROJECT_RULES.md   # General guidelines and architectural rules
```

<br/>

## 🏁 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18+ recommended)
* PostgreSQL Database locally, or a remote Provider like [Supabase](https://supabase.com/)

### 1. Clone & Install Libraries
```bash
# Setup the Frontend app
cd frontend
npm install

# Setup the Backend server
cd ../backend
npm install
```

### 2. Environment Configuration
Create a `.env` file in the `backend/` directory:
```env
PORT=5000
DATABASE_URL="postgresql://postgres:password@localhost:5432/payflux"
JWT_SECRET="your_secure_development_secret"
```

Create a `.env` file in the `frontend/` directory (if required for API overriding):
```env
VITE_API_URL="http://localhost:5000/api"
```

### 3. Spin Up Development Servers

**Boot Backend** (Terminal 1)
```bash
cd backend
npm run dev
```

**Boot Frontend** (Terminal 2)
```bash
cd frontend
npm run dev
```

🚀 Open your browser to `http://localhost:5173/` and start billing!

<br/>

