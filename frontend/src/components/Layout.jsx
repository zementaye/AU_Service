import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationsBell from "./NotificationsBell";

const NAV_ITEMS = [
  { to: "/", label: "Requests", icon: "☰" },
  { to: "/new", label: "New request", icon: "＋" },
];

const ADMIN_NAV_ITEMS = [
  { to: "/reports", label: "Reports", icon: "▤" },
  { to: "/admin", label: "Admin", icon: "⚙" },
];

function initials(name = "") {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/au-emblem.png" alt="African Union" className="brand-mark" />
          <div className="brand-title">Service Requests</div>
          <div className="brand-sub">African Union</div>
        </div>

        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          {user?.role === "Super Admin" && (
            <>
              <div className="nav-divider" />
              {ADMIN_NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{initials(user?.name)}</div>
            <div>
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{user?.role}</div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <NavLink to="/settings" className="notif-bell settings-btn" title="Settings" aria-label="Settings">
                <span className="settings-icon" aria-hidden="true">⚙</span>
              </NavLink>
              <NotificationsBell />
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <div>
        <div className="mobile-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/au-emblem.png" alt="African Union" className="brand-mark-sm" />
            <div className="brand-title">AU Service Requests</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <NavLink to="/settings" className="notif-bell settings-btn" title="Settings" aria-label="Settings">
              <span className="settings-icon" aria-hidden="true">⚙</span>
            </NavLink>
            <NotificationsBell />
            <button className="logout-btn" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </div>
        <main className="main">{children}</main>
        <nav className="mobile-tabbar">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `mobile-tab${isActive ? " active" : ""}`}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          {user?.role === "Super Admin" &&
            ADMIN_NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `mobile-tab${isActive ? " active" : ""}`}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
        </nav>
      </div>
    </div>
  );
}
