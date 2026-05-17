import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import {
  FileText, Zap, Shield, BarChart3, ArrowRight, CheckCircle2,
  Sparkles, Send, CreditCard, Star, ChevronRight, Layers,
  Globe, Clock, Users, Building2, UserCircle, Lock, Download,
  IndianRupee, Eye, ArrowLeftRight
} from 'lucide-react';

/* ─── Animation helpers ──────────────────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: (i = 0) => ({
    opacity: 1,
    transition: { duration: 0.8, delay: i * 0.15 }
  }),
};

const scaleUp = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1, scale: 1,
    transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }
  },
};

function SectionWrapper({ children, className = '', id }) {
  return (
    <motion.section
      id={id}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
      className={`relative ${className}`}
    >
      {children}
    </motion.section>
  );
}

/* ─── Navbar ─────────────────────────────────────────────────────────── */

function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/80 backdrop-blur-xl shadow-sm border-b border-slate-200/60'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40 transition-shadow">
            P
          </div>
          <span className="text-xl font-bold tracking-tight">
            Pay<span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Flux</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Features</a>
          <a href="#how-it-works" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">How it Works</a>
          <a href="#testimonials" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Testimonials</a>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm font-semibold text-slate-700 hover:text-slate-900 px-4 py-2 rounded-lg transition-colors"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-200 hover:-translate-y-0.5"
          >
            Get Started Free
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}

/* ─── Hero ────────────────────────────────────────────────────────────── */

function Hero() {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, -40]);
  const y2 = useTransform(scrollY, [0, 500], [0, 30]);

  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div style={{ y: y2 }} className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 opacity-60 blur-3xl" />
        <motion.div style={{ y: y1 }} className="absolute top-40 -left-32 w-80 h-80 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 opacity-50 blur-3xl" />
        <motion.div style={{ y: y2 }} className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 opacity-40 blur-3xl" />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-medium mb-8 animate-pulse-glow">
              <Sparkles className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '3s' }} />
              Two Portals · Razorpay Payments · Instant PDFs
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.08] mb-6"
          >
            <span className="text-slate-900">One platform.</span>
            <br />
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
              Two powerful portals.
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2}
            className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Businesses create & send invoices. Customers view, pay via Razorpay, and download receipts.
            Role-based access keeps everything secure and seamless.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={3}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              to="/register"
              className="group inline-flex items-center gap-2 text-base font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 px-8 py-4 rounded-2xl shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 hover:-translate-y-0.5"
            >
              Start as Business
              <Building2 className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/register"
              className="group inline-flex items-center gap-2 text-base font-semibold text-slate-700 hover:text-slate-900 px-8 py-4 rounded-2xl border border-slate-200 hover:border-emerald-300 bg-white/50 hover:bg-emerald-50/50 transition-all duration-200 hover:-translate-y-0.5"
            >
              Join as Customer
              <UserCircle className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>

          {/* Trust line */}
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={4}
            className="text-sm text-slate-400 mt-8 flex items-center justify-center gap-4 flex-wrap"
          >
            <span className="flex items-center gap-1"><Lock className="h-3.5 w-3.5 text-emerald-500" /> Role-based access</span>
            <span className="flex items-center gap-1"><IndianRupee className="h-3.5 w-3.5 text-emerald-500" /> Razorpay integrated</span>
            <span className="flex items-center gap-1"><Download className="h-3.5 w-3.5 text-emerald-500" /> PAID receipt PDFs</span>
          </motion.p>
        </div>

        {/* Hero Mockup */}
        <motion.div
          variants={scaleUp}
          initial="hidden"
          animate="visible"
          className="mt-16 md:mt-20 relative max-w-5xl mx-auto"
        >
          {/* Glow behind mockup */}
          <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/10 via-purple-500/5 to-transparent rounded-3xl blur-2xl scale-105" />

          <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/10 border border-slate-200/60 bg-white">
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="bg-white rounded-lg px-4 py-1 text-xs text-slate-400 border border-slate-100 font-mono">
                  app.payflux.com/dashboard
                </div>
              </div>
            </div>
            <img
              src="/images/dashboard-mockup.png"
              alt="PayFlux Dashboard — Invoice management made beautiful"
              className="w-full h-auto"
              loading="eager"
            />
          </div>

          {/* Floating cards */}
          <motion.div
            animate={{ y: [0, -12, 0], rotate: [0, -2, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -left-6 top-1/4 hidden lg:block"
          >
            <div className="bg-white rounded-2xl shadow-xl shadow-indigo-900/10 border border-indigo-100 p-4 w-56 animate-pulse-glow">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-indigo-500" />
                </div>
                <div>
                  <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Business Portal</div>
                  <div className="text-sm font-bold text-slate-900">Create & Send</div>
                </div>
              </div>
              <div className="flex gap-1.5">
                {['Invoice', 'PDF', 'Track'].map(t => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">{t}</span>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            animate={{ y: [0, 10, 0], rotate: [0, 2, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            className="absolute -right-6 top-1/5 hidden lg:block"
          >
            <div className="bg-white rounded-2xl shadow-xl shadow-emerald-900/10 border border-emerald-100 p-4 w-56">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <UserCircle className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Customer Portal</div>
                  <div className="text-sm font-bold text-slate-900">View & Pay</div>
                </div>
              </div>
              <div className="flex gap-1.5">
                {['Razorpay', 'Receipt', 'History'].map(t => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">{t}</span>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            animate={{ y: [0, -6, 0], scale: [1, 1.02, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
            className="absolute -right-4 bottom-1/4 hidden lg:block"
          >
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-xl shadow-emerald-500/20 p-3 w-48 text-white">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-bold">Payment Received!</span>
              </div>
              <div className="text-lg font-extrabold">₹24,500.00</div>
              <div className="text-[10px] opacity-75 mt-0.5">via Razorpay • just now</div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Features ───────────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: Building2,
    title: 'Business Portal',
    desc: 'Full dashboard to create invoices, manage customers & items, track revenue, and generate pixel-perfect PDFs.',
    gradient: 'from-indigo-500 to-blue-500',
    light: 'bg-indigo-50',
    iconColor: 'text-indigo-500',
  },
  {
    icon: UserCircle,
    title: 'Customer Portal',
    desc: 'Customers log in to view invoices, check payment history, and download receipts — all in a dedicated portal.',
    gradient: 'from-emerald-500 to-teal-500',
    light: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
  },
  {
    icon: CreditCard,
    title: 'Razorpay Payments',
    desc: 'Customers pay invoices directly with Razorpay Checkout. Payments auto-verify and update invoice status instantly.',
    gradient: 'from-blue-500 to-cyan-500',
    light: 'bg-blue-50',
    iconColor: 'text-blue-500',
  },
  {
    icon: Download,
    title: 'PAID Receipt PDFs',
    desc: 'Fully paid invoices generate receipt PDFs with a professional "PAID" watermark stamp. Download anytime.',
    gradient: 'from-purple-500 to-pink-500',
    light: 'bg-purple-50',
    iconColor: 'text-purple-500',
  },
  {
    icon: Lock,
    title: 'Role-Based Access',
    desc: 'Admin, Business, and Customer roles with strict RBAC. Each role sees only what they should — nothing more.',
    gradient: 'from-amber-500 to-orange-500',
    light: 'bg-amber-50',
    iconColor: 'text-amber-500',
  },
  {
    icon: BarChart3,
    title: 'Real-time Analytics',
    desc: 'Revenue trends, top customers, payment breakdowns, and overdue tracking — all in beautiful interactive charts.',
    gradient: 'from-rose-500 to-red-500',
    light: 'bg-rose-50',
    iconColor: 'text-rose-500',
  },
];

function Features() {
  return (
    <SectionWrapper id="features" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        {/* Morphing blob background */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-indigo-100 via-purple-100 to-emerald-100 opacity-30 blur-3xl animate-morph pointer-events-none" />

        <motion.div variants={fadeUp} className="text-center max-w-2xl mx-auto mb-16 relative">
          <span className="text-sm font-semibold text-indigo-600 tracking-wide uppercase mb-3 block">Features</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            Built for both sides of the invoice
          </h2>
          <p className="text-lg text-slate-500">
            Two dedicated portals. One seamless payment flow. Zero friction.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 relative">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              custom={i}
              whileHover={{ y: -8, scale: 1.02 }}
              className="group relative bg-white rounded-2xl border border-slate-100 p-8 hover:shadow-2xl hover:shadow-slate-900/8 transition-all duration-500 overflow-hidden"
            >
              {/* Gradient sweep on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-[0.04] transition-opacity duration-500`} />
              <div className={`absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-10 rounded-full blur-2xl transition-all duration-500 group-hover:scale-150`} />

              <div className="relative">
                <motion.div
                  whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className={`h-12 w-12 rounded-2xl ${f.light} flex items-center justify-center mb-5`}
                >
                  <f.icon className={`h-6 w-6 ${f.iconColor}`} />
                </motion.div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}

/* ─── Screenshot / Demo Section ──────────────────────────────────────── */

function DemoSection() {
  const [activePortal, setActivePortal] = useState('business');
  const [autoSwitch, setAutoSwitch] = useState(true);

  useEffect(() => {
    if (!autoSwitch) return;
    const timer = setInterval(() => {
      setActivePortal(p => p === 'business' ? 'customer' : 'business');
    }, 4000);
    return () => clearInterval(timer);
  }, [autoSwitch]);

  const portals = {
    business: {
      icon: Building2,
      title: 'Business Portal',
      subtitle: 'Create, manage, and track everything',
      color: 'indigo',
      features: [
        { icon: FileText, text: 'Create GST-compliant invoices with live preview' },
        { icon: Users, text: 'Manage customer & item catalogs' },
        { icon: Zap, text: 'Generate pixel-perfect PDFs in one click' },
        { icon: BarChart3, text: 'Revenue analytics & payment dashboards' },
        { icon: Send, text: 'Send invoices & track payment status' },
        { icon: Shield, text: 'Configure Razorpay API keys securely' },
      ],
    },
    customer: {
      icon: UserCircle,
      title: 'Customer Portal',
      subtitle: 'View, pay, and download receipts',
      color: 'emerald',
      features: [
        { icon: Eye, text: 'View all invoices from linked businesses' },
        { icon: CreditCard, text: 'Pay instantly via Razorpay Checkout' },
        { icon: Download, text: 'Download invoices & PAID receipt PDFs' },
        { icon: Clock, text: 'Full payment history & transaction log' },
        { icon: ArrowLeftRight, text: 'Link/unlink with multiple businesses' },
        { icon: Lock, text: 'Secure role-based access control' },
      ],
    },
  };

  const p = portals[activePortal];

  return (
    <SectionWrapper className="py-24 md:py-32 bg-gradient-to-b from-slate-50 to-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* Morphing blobs */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-gradient-to-br from-indigo-200 to-purple-200 opacity-20 blur-3xl animate-morph pointer-events-none" />
        <div className="absolute left-0 bottom-0 w-80 h-80 bg-gradient-to-br from-emerald-200 to-teal-200 opacity-20 blur-3xl animate-morph pointer-events-none" style={{ animationDelay: '4s' }} />

        <motion.div variants={fadeUp} className="text-center max-w-2xl mx-auto mb-12 relative">
          <span className="text-sm font-semibold text-indigo-600 tracking-wide uppercase mb-3 block">Dual Portal System</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            Two portals. One seamless experience.
          </h2>
          <p className="text-lg text-slate-500">
            Businesses and customers each get their own powerful interface, connected by Razorpay.
          </p>
        </motion.div>

        {/* Portal Switcher */}
        <motion.div variants={fadeUp} className="flex justify-center mb-12">
          <div className="inline-flex rounded-2xl bg-white border border-slate-200 p-1.5 shadow-lg shadow-slate-900/5">
            {['business', 'customer'].map(key => (
              <button
                key={key}
                onClick={() => { setActivePortal(key); setAutoSwitch(false); }}
                className={`relative px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
                  activePortal === key
                    ? key === 'business'
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {key === 'business' ? <Building2 className="h-4 w-4" /> : <UserCircle className="h-4 w-4" />}
                {key === 'business' ? 'Business' : 'Customer'}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Portal Content */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePortal}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
            >
              <div className="flex items-center gap-3 mb-6">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${
                    activePortal === 'business' ? 'from-indigo-500 to-purple-600' : 'from-emerald-500 to-teal-500'
                  } flex items-center justify-center shadow-lg`}
                >
                  <p.icon className="h-7 w-7 text-white" />
                </motion.div>
                <div>
                  <h3 className="text-2xl font-extrabold text-slate-900">{p.title}</h3>
                  <p className="text-sm text-slate-500">{p.subtitle}</p>
                </div>
              </div>

              <div className="space-y-3">
                {p.features.map((f, i) => (
                  <motion.div
                    key={f.text}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.3 }}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${
                      activePortal === 'business'
                        ? 'border-indigo-100 hover:bg-indigo-50/50 hover:border-indigo-200'
                        : 'border-emerald-100 hover:bg-emerald-50/50 hover:border-emerald-200'
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      activePortal === 'business' ? 'bg-indigo-50' : 'bg-emerald-50'
                    }`}>
                      <f.icon className={`h-4 w-4 ${
                        activePortal === 'business' ? 'text-indigo-500' : 'text-emerald-500'
                      }`} />
                    </div>
                    <span className="text-slate-700 font-medium text-sm">{f.text}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Right: Animated flow visualization */}
          <motion.div variants={scaleUp} className="relative">
            <div className={`absolute inset-0 rounded-3xl blur-2xl transition-colors duration-700 ${
              activePortal === 'business'
                ? 'bg-gradient-to-br from-indigo-200/30 via-purple-200/20 to-pink-200/20'
                : 'bg-gradient-to-br from-emerald-200/30 via-teal-200/20 to-cyan-200/20'
            }`} />
            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/10 border border-slate-200/60 bg-white">
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="flex-1 flex justify-center">
                  <motion.div
                    key={activePortal + '-url'}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-lg px-4 py-1 text-xs text-slate-400 border border-slate-100 font-mono"
                  >
                    {activePortal === 'business' ? 'app.payflux.com/dashboard' : 'app.payflux.com/portal'}
                  </motion.div>
                </div>
              </div>
              <img
                src="/images/dashboard-mockup.png"
                alt={`PayFlux ${p.title} Interface`}
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </SectionWrapper>
  );
}

/* ─── How It Works ───────────────────────────────────────────────────── */

const STEPS = [
  {
    num: '01',
    icon: FileText,
    title: 'Create Invoice',
    desc: 'Business creates a GST-compliant invoice with live preview, auto-numbering, taxes, and discounts.',
    gradient: 'from-indigo-500 to-blue-500',
    portal: 'Business',
  },
  {
    num: '02',
    icon: Send,
    title: 'Send to Customer',
    desc: 'Generate a pixel-perfect PDF and send it. Customer sees it instantly in their portal — no emails needed.',
    gradient: 'from-purple-500 to-indigo-500',
    portal: 'Business',
  },
  {
    num: '03',
    icon: CreditCard,
    title: 'Pay via Razorpay',
    desc: 'Customer clicks "Pay Now" — Razorpay Checkout handles UPI, cards, and netbanking. Payment auto-verifies.',
    gradient: 'from-emerald-500 to-teal-500',
    portal: 'Customer',
  },
  {
    num: '04',
    icon: Download,
    title: 'Download Receipt',
    desc: 'Fully paid? Customer downloads the original invoice PDF with a professional "PAID" watermark stamp.',
    gradient: 'from-rose-500 to-pink-500',
    portal: 'Customer',
  },
];

function HowItWorks() {
  return (
    <SectionWrapper id="how-it-works" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div variants={fadeUp} className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-sm font-semibold text-indigo-600 tracking-wide uppercase mb-3 block">How It Works</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            Four steps. Two portals. Zero friction.
          </h2>
          <p className="text-lg text-slate-500">
            From invoice creation to PAID receipt download — a seamless flow.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {/* Connector line */}
          <div className="hidden lg:block absolute top-24 left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-indigo-200 via-purple-200 via-emerald-200 to-rose-200" />

          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              variants={fadeUp}
              custom={i}
              whileHover={{ y: -5 }}
              className="relative text-center"
            >
              {/* Step icon */}
              <div className="relative mx-auto mb-6">
                <motion.div
                  whileHover={{ rotate: 12, scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className={`h-20 w-20 rounded-3xl bg-gradient-to-br ${step.gradient} flex items-center justify-center mx-auto shadow-lg relative z-10`}
                >
                  <step.icon className="h-8 w-8 text-white" />
                </motion.div>
                <div className={`absolute -inset-2 rounded-3xl bg-gradient-to-br ${step.gradient} opacity-20 blur-lg animate-pulse`} style={{ animationDelay: `${i * 0.5}s` }} />
              </div>

              {/* Portal badge */}
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2 ${
                step.portal === 'Business'
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'bg-emerald-50 text-emerald-600'
              }`}>
                {step.portal === 'Business' ? <Building2 className="h-2.5 w-2.5" /> : <UserCircle className="h-2.5 w-2.5" />}
                {step.portal}
              </div>

              <div className="text-xs font-bold text-slate-400 tracking-widest mb-2 uppercase">Step {step.num}</div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
              <p className="text-slate-500 leading-relaxed text-sm max-w-xs mx-auto">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}

/* ─── Testimonials ───────────────────────────────────────────────────── */

const TESTIMONIALS = [
  {
    name: 'Priya Sharma',
    role: 'Freelance Designer',
    avatar: 'PS',
    text: 'PayFlux cut my invoicing time from 30 minutes to 30 seconds. The PDF output looks so professional that clients started paying faster!',
    color: 'bg-indigo-500',
  },
  {
    name: 'Rahul Mehta',
    role: 'Small Business Owner',
    avatar: 'RM',
    text: 'I was juggling Excel sheets before this. Now everything — customers, payments, analytics — is in one gorgeous dashboard. Game changer.',
    color: 'bg-purple-500',
  },
  {
    name: 'Anita Desai',
    role: 'Chartered Accountant',
    avatar: 'AD',
    text: 'The GST-compliant invoicing and real-time payment tracking saves my clients hours each month. I recommend PayFlux to every business I work with.',
    color: 'bg-emerald-500',
  },
];

function Testimonials() {
  return (
    <SectionWrapper id="testimonials" className="py-24 md:py-32 bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div variants={fadeUp} className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-sm font-semibold text-indigo-600 tracking-wide uppercase mb-3 block">Testimonials</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            Loved by businesses everywhere
          </h2>
          <p className="text-lg text-slate-500">
            See why thousands of freelancers and small businesses trust PayFlux.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              variants={fadeUp}
              custom={i}
              className="bg-white rounded-2xl border border-slate-100 p-8 hover:shadow-xl hover:shadow-slate-900/5 transition-all duration-300 hover:-translate-y-1 flex flex-col"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-5">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>

              <p className="text-slate-600 leading-relaxed flex-1 mb-6 text-[15px]">"{t.text}"</p>

              <div className="flex items-center gap-3 pt-5 border-t border-slate-100">
                <div className={`h-10 w-10 rounded-full ${t.color} flex items-center justify-center text-white text-sm font-bold`}>
                  {t.avatar}
                </div>
                <div>
                  <div className="font-semibold text-slate-900 text-sm">{t.name}</div>
                  <div className="text-slate-400 text-xs">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}

/* ─── CTA Banner ─────────────────────────────────────────────────────── */

function CtaBanner() {
  return (
    <SectionWrapper className="py-24 md:py-32">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div
          variants={scaleUp}
          className="relative rounded-3xl overflow-hidden"
        >
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700" />
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
            backgroundSize: '40px 40px, 60px 60px'
          }} />

          {/* Glow blobs */}
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-purple-400/30 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-indigo-400/30 blur-3xl" />

          <div className="relative px-8 py-16 md:px-16 md:py-20 text-center">
            <motion.div variants={fadeUp}>
              <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
                Ready to transform your invoicing?
              </h2>
              <p className="text-indigo-100 text-lg md:text-xl max-w-xl mx-auto mb-10">
                Business or customer — pick your portal and experience seamless invoicing with Razorpay payments.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/register"
                  className="group inline-flex items-center gap-2 text-base font-semibold bg-white text-indigo-700 hover:bg-indigo-50 px-8 py-4 rounded-2xl shadow-xl transition-all duration-200 hover:-translate-y-0.5"
                >
                  <Building2 className="h-4 w-4" />
                  Start as Business
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 text-base font-semibold text-white/90 hover:text-white px-8 py-4 rounded-2xl border border-white/20 hover:border-white/40 transition-all duration-200 hover:-translate-y-0.5"
                >
                  <UserCircle className="h-4 w-4" />
                  Join as Customer
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

/* ─── Footer ─────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="bg-slate-50 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-6 py-12 md:py-16">
        <div className="grid md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
                P
              </div>
              <span className="text-lg font-bold tracking-tight">
                Pay<span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Flux</span>
              </span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              Beautiful invoicing for modern businesses. Create, send, and get paid — all in one flow.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-slate-900 text-sm mb-4">Product</h4>
            <ul className="space-y-2.5">
              <li><a href="#features" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Features</a></li>
              <li><a href="#how-it-works" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">How it Works</a></li>
              <li><a href="#testimonials" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Testimonials</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-slate-900 text-sm mb-4">Company</h4>
            <ul className="space-y-2.5">
              <li><a href="#" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">About</a></li>
              <li><a href="#" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Blog</a></li>
              <li><a href="#" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Careers</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-slate-900 text-sm mb-4">Legal</h4>
            <ul className="space-y-2.5">
              <li><a href="#" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Terms of Service</a></li>
              <li><a href="#" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Security</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-200 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-400">
            © {new Date().getFullYear()} PayFlux. All rights reserved.
          </p>
          <p className="text-sm text-slate-400">
            Made with ♥ in India
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─── Main Landing Page ──────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Navbar />
      <Hero />
      <Features />
      <DemoSection />
      <HowItWorks />
      <Testimonials />
      <CtaBanner />
      <Footer />
    </div>
  );
}
