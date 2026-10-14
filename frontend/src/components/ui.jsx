import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";

export function Logo({ size = 44, className = "" }) {
  return (
    <img
      src="/keen-logo.png"
      alt="Keen Evening Coaching"
      width={size}
      height={size}
      className={`rounded-full shrink-0 ${className}`}
    />
  );
}

const NAV = [
  {
    to: "/hod",
    label: "Admin Panel",
    roles: ["hod", "admin", "staff"],
    icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
  },
  {
    to: "/hod/teachers/new",
    label: "Teachers",
    roles: ["hod", "admin", "staff"],
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7zM19 8v6M22 11h-6",
  },
  {
    to: "/hod/students",
    label: "Students",
    roles: ["hod", "admin", "staff"],
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  },
  {
    to: "/teacher",
    label: "Teacher Dashboard",
    roles: ["teacher"],
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
  {
    to: "/academics/classes",
    label: "Classes & Subjects",
    roles: ["hod", "admin", "staff"],
    icon: "M12 14l9-5-9-5-9 5 9 5zM12 14l6.16-3.42A12.083 12.083 0 0112 20a12.083 12.083 0 01-6.16-9.42L12 14z",
  },
  {
    to: "/student",
    label: "Student Dashboard",
    roles: ["student"],
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  },
  {
    to: "/exams",
    label: "Exams & Results",
    roles: ["hod", "admin", "staff"],
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    to: "/fees",
    label: "Fee Management",
    roles: ["hod", "admin", "staff"],
    icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  },
  {
    to: "/expenses",
    label: "Expenses",
    roles: ["hod", "admin", "staff"],
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    to: "/daily",
    label: "Daily Queries",
    roles: ["hod", "admin", "staff"],
    icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  },
  {
    to: "/attendance",
    label: "Attendance",
    roles: ["hod", "admin", "staff", "student"],
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    to: "/timetable",
    label: "Timetables",
    roles: ["hod", "admin", "staff", "teacher", "student"],
    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  },
  {
    to: "/settings",
    label: "Settings",
    roles: ["teacher"],
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z",
  },
];

const SIGN_OUT_ICON =
  "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1";

function Icon({ d, className = "w-5 h-5" }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d={d}
      />
    </svg>
  );
}

export function Button({
  variant = "default",
  className = "",
  children,
  ...props
}) {
  const styles = {
    default:
      "bg-keen-cyan text-keen-darkest hover:bg-keen-cyanDark",
    secondary:
      "border border-keen-border bg-white text-keen-charcoal hover:bg-slate-50",
    danger:
      "bg-red-600 text-white hover:bg-red-700",
  };

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs transition-colors disabled:cursor-not-allowed ${
        styles[variant] || styles.default
      } ${className}`}
    >
      {children}
    </button>
  );
}

const BELL_ICON =
  "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9";

function timeAgo(iso) {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return mins + " min ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + " hr ago";
  const days = Math.floor(hrs / 24);
  return days === 1 ? "Yesterday" : days + " days ago";
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const boxRef = useRef(null);

  const load = async () => {
    if (typeof api.listAnnouncements !== "function") return;
    try {
      const data = await api.listAnnouncements();
      setItems(Array.isArray(data) ? data : data?.results ?? []);
    } catch {
      /* keep the bell quiet if the request fails */
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const unread = items.filter((n) => !n.is_read).length;
  const shown = showAll ? items : items.slice(0, 5);

  const markOne = async (n) => {
    if (n.is_read) return;
    setItems((list) => list.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    try {
      if (typeof api.markAnnouncementRead === "function") await api.markAnnouncementRead(n.id);
    } catch {
      load();
    }
  };

  const markAll = async () => {
    setItems((list) => list.map((x) => ({ ...x, is_read: true })));
    try {
      if (typeof api.markAllAnnouncementsRead === "function") await api.markAllAnnouncementsRead();
    } catch {
      load();
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-keen-border bg-white text-keen-charcoal shadow-sm transition hover:bg-slate-50"
      >
        <Icon d={BELL_ICON} className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-14 z-50 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-keen-border bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-keen-border bg-slate-50/60 px-4 py-3">
            <div>
              <p className="text-sm font-extrabold text-keen-charcoal">Announcements</p>
              <p className="text-[11px] text-keen-muted">
                {unread ? unread + " unread" : "You're all caught up"}
              </p>
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="text-xs font-bold text-[#0AA9D4] hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {shown.length === 0 ? (
              <p className="p-8 text-center text-xs font-medium text-keen-muted">
                No announcements yet.
              </p>
            ) : (
              shown.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => markOne(n)}
                  className={
                    "flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-keen-cyanSoft/40 " +
                    (n.is_read ? "" : "bg-keen-cyanSoft/30")
                  }
                >
                  <span
                    className={
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full " +
                      (n.is_read ? "bg-transparent" : "bg-[#0AA9D4]")
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-keen-charcoal">
                      {n.title}
                    </span>
                    {(n.body || n.message) && (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-keen-muted">
                        {n.body || n.message}
                      </span>
                    )}
                    <span className="mt-1 block text-[11px] text-keen-muted">
                      {n.sender_name ? n.sender_name + " · " : ""}
                      {timeAgo(n.created_at)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          {items.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="w-full border-t border-keen-border px-4 py-3 text-center text-xs font-bold text-[#0AA9D4] hover:bg-slate-50"
            >
              {showAll ? "Show fewer" : "View all announcements"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function AppShell({ badge, title, subtitle, action, children }) {
  const { session, logout, role } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const initials = (session?.username || "?").slice(0, 2).toUpperCase();
  const showBell = role === "teacher" || role === "student";
  const items = NAV.filter(
    (item) => !item.roles || item.roles.includes(role)
  );

  const navRef = useRef(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("keen-nav-scroll");

    if (navRef.current && saved) {
      navRef.current.scrollTop = parseInt(saved, 10) || 0;
    }
  }, []);

  const handleNavScroll = (e) => {
    sessionStorage.setItem(
      "keen-nav-scroll",
      String(e.currentTarget.scrollTop)
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col bg-keen-charcoal text-white shadow-2xl transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 " +
          (sidebarOpen ? "translate-x-0" : "-translate-x-full")
        }
      >
        {/* Sidebar header */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <Logo
            size={46}
            className="border-2 border-keen-cyan"
          />

          <div className="min-w-0">
            <p className="text-lg font-extrabold leading-tight tracking-tight text-white">
              Keen Academy
            </p>

            <p className="min-w-0 text-[10px] font-bold uppercase tracking-widest text-keen-cyan">
              <span
                style={{
                  display: "block",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  maxWidth: "100%",
                }}
              >
                <style>{`
                  @keyframes keenScroll {
                    from {
                      transform: translateX(0);
                    }
                    to {
                      transform: translateX(-50%);
                    }
                  }
                `}</style>

                <span
                  style={{
                    display: "inline-block",
                    whiteSpace: "nowrap",
                    animation: "keenScroll 10s linear infinite",
                  }}
                >
                  <span style={{ paddingRight: 32 }}>
                    Keep Education Ever Noble
                  </span>

                  <span
                    style={{ paddingRight: 32 }}
                    aria-hidden="true"
                  >
                    Keep Education Ever Noble
                  </span>
                </span>
              </span>
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav
          ref={navRef}
          onScroll={handleNavScroll}
          className="flex-1 overflow-y-auto px-3 py-5"
        >
          <p className="mb-3 px-3 text-xs font-bold uppercase tracking-widest text-slate-500">
            Main Menu
          </p>

          <div className="space-y-1">
            {items.map((item) =>
              item.soon ? (
                <span
                  key={item.to}
                  title="Not built yet"
                  className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3.5 py-3 text-[15px] font-semibold text-slate-500"
                >
                  <Icon d={item.icon} />

                  <span className="flex-1">
                    {item.label}
                  </span>

                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    Soon
                  </span>
                </span>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={NAV.some(
                    (o) =>
                      o.to !== item.to &&
                      o.to.startsWith(item.to + "/")
                  )}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    "relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-[15px] font-semibold transition-colors " +
                    (isActive
                      ? "bg-keen-cyan text-keen-darkest shadow-md shadow-keen-cyan/20"
                      : "text-slate-300 hover:bg-white/5 hover:text-keen-cyan")
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-keen-darkest" />
                      )}

                      <Icon
                        d={item.icon}
                        className="h-5 w-5 shrink-0"
                      />

                      <span className="flex-1">
                        {item.label}
                      </span>

                      {isActive && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-keen-darkest" />
                      )}
                    </>
                  )}
                </NavLink>
              )
            )}
          </div>
        </nav>

        {/* User section */}
        <div className="space-y-3 border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-keen-cyan/40 bg-white/10 text-sm font-extrabold text-keen-cyan">
              {initials}
            </div>

            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold text-white">
                {session?.username}
              </p>

              <p className="truncate text-xs capitalize text-slate-400">
                {session?.role}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition-colors hover:bg-white/10"
          >
            <Icon
              d={SIGN_OUT_ICON}
              className="h-5 w-5"
            />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex items-center border-b border-keen-border bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-keen-border text-keen-charcoal transition-colors hover:bg-slate-50"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <span className="ml-3 text-sm font-extrabold text-keen-charcoal">
            Keen Academy
          </span>

          {showBell && (
            <div className="ml-auto">
              <NotificationBell />
            </div>
          )}
        </div>

        <main className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-5 md:space-y-6 md:p-6 lg:p-8">
          {showBell && (
            <div className="hidden justify-end lg:flex">
              <NotificationBell />
            </div>
          )}

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              {badge ? (
                <span className="inline-block rounded-full border border-keen-cyan/40 bg-keen-cyanSoft px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-keen-charcoal">
                  {badge}
                </span>
              ) : null}

              <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-keen-charcoal sm:text-3xl">
                {title}
              </h1>

              {subtitle ? (
                <p className="mt-1 text-sm text-keen-muted sm:text-base">
                  {subtitle}
                </p>
              ) : null}
            </div>

            {action}
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}

// keen-modal-v1
export const INPUT_CLS =
  "w-full rounded-lg border border-keen-border bg-slate-50 px-3 py-2.5 text-sm text-keen-charcoal outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200";

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide = false,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={
          "flex max-h-[90vh] w-full flex-col rounded-2xl bg-white shadow-2xl " +
          (wide ? "max-w-3xl" : "max-w-xl")
        }
      >
        <div className="flex items-start justify-between gap-4 border-b border-keen-border px-5 py-5 sm:px-8 sm:py-6">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-keen-charcoal">
              {title}
            </h2>

            {subtitle ? (
              <p className="mt-1 text-sm text-keen-muted">
                {subtitle}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-2xl leading-none text-keen-muted hover:text-keen-charcoal"
          >
            &times;
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
          {children}
        </div>

        {footer ? (
          <div className="flex flex-wrap justify-end gap-3 border-t border-keen-border px-5 py-4 sm:px-8">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function FormItem({
  label,
  required,
  error,
  hint,
  wide,
  children,
}) {
  return (
    <label className={"block " + (wide ? "sm:col-span-2" : "")}>
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-keen-muted">
        {label}

        {required && (
          <span className="text-red-500"> *</span>
        )}
      </span>

      {children}

      {hint && (
        <span className="mt-1 block text-[11px] font-medium text-keen-muted">
          {hint}
        </span>
      )}

      {error && (
        <span className="mt-1 block text-[11px] font-medium text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

export function Field({ label, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-keen-muted">
        {label}
      </span>

      <input
        {...props}
        className="w-full rounded-lg border border-keen-border bg-white px-3 py-2 text-xs font-medium text-keen-charcoal placeholder:text-keen-muted/60 focus:border-keen-cyan focus:outline-none"
      />
    </label>
  );
}

export function Select({
  label,
  children,
  ...props
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-keen-muted">
        {label}
      </span>

      <select
        {...props}
        className="w-full rounded-lg border border-keen-border bg-white px-3 py-2 text-xs font-medium text-keen-charcoal focus:border-keen-cyan focus:outline-none"
      >
        {children}
      </select>
    </label>
  );
}

export function Pill({
  tone = "ok",
  children,
}) {
  const tones = {
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
    wait: "bg-amber-50 text-amber-700 border-amber-200",
    brand:
      "bg-keen-cyanSoft text-keen-charcoal border-keen-cyan/40",
  };

  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
        tones[tone] || tones.ok
      }`}
    >
      {children}
    </span>
  );
}

export function Notice({
  tone = "error",
  children,
}) {
  if (!children) return null;

  const tones = {
    error: "border-red-200 bg-red-50 text-red-700",
    success:
      "border-keen-cyan/40 bg-keen-cyanSoft text-keen-charcoal",
  };

  return (
    <p
      role="status"
      className={`rounded-lg border px-3.5 py-2.5 text-xs font-medium ${
        tones[tone] || tones.error
      }`}
    >
      {children}
    </p>
  );
}

export function Panel({
  title,
  action,
  footer,
  children,
}) {
  return (
    <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-keen-border bg-white shadow-sm">
      <div>
        <div className="flex items-center justify-between gap-3 border-b border-keen-border bg-slate-50/60 p-4">
          <h3 className="font-bold text-sm text-keen-charcoal">
            {title}
          </h3>

          {action}
        </div>

        {children}
      </div>

      {footer ? (
        <div className="border-t border-keen-border bg-slate-50/40 p-3">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

function ActionIcon({ paths }) {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

const EDIT_PATHS = [
  "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7",
  "M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
];

const DELETE_PATHS = [
  "M3 6h18",
  "M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6",
  "M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2",
  "M10 11v6",
  "M14 11v6",
];

export function AddButton({
  onClick,
  children,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl bg-keen-cyan px-5 py-3 text-sm font-bold text-keen-darkest shadow-sm shadow-keen-cyan/25 hover:bg-keen-cyanDark"
    >
      {children}
    </button>
  );
}

export function EditButton({
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md bg-blue-500 px-3.5 py-2 text-sm font-bold text-white hover:bg-blue-600"
    >
      <ActionIcon paths={EDIT_PATHS} />
      Edit
    </button>
  );
}

export function DeleteButton({
  onClick,
  busy = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
    >
      <ActionIcon paths={DELETE_PATHS} />

      {busy ? "Deleting..." : "Delete"}
    </button>
  );
}