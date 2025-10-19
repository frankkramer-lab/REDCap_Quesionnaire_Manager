import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import redcapIcon from "../assets/redcap.png";
import "./Sidebar.css";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  return (
    <div className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <img src={redcapIcon} alt="Redcap Icon" className="sidebar-logo" />
        {!collapsed && <span className="sidebar-title">REDCap Manager</span>}
        <button className="toggle-button" onClick={toggleSidebar}>
          ☰
        </button>
      </div>

      <ul className="sidebar-links">
        <li>
          <Link to="/dashboard" className={location.pathname === "/dashboard" ? "active" : ""}>
            <span className="icon">📊</span> {!collapsed && "Dashboard"}
          </Link>
        </li>
        <li>
          <Link
            to="/fragebogen-erstellen"
            className={location.pathname === "/fragebogen-erstellen" ? "active" : ""}
          >
            <span className="icon">🛠️</span> {!collapsed && "Create Questionnaire"}
          </Link>
        </li>
        <li>
          <Link to="/fragen" className={location.pathname === "/fragen" ? "active" : ""}>
            <span className="icon">❓</span> {!collapsed && "Questions"}
          </Link>
        </li>
        <li>
          <Link to="/profil" className={location.pathname === "/profil" ? "active" : ""}>
            <span className="icon">👤</span> {!collapsed && "Profile"}
          </Link>
        </li>
        <li className="logout-link">
          <a
            href="#"
            onClick={() => {
              localStorage.removeItem("token");
              window.location.href = "/";
            }}
          >
            <span className="icon">🚪</span> {!collapsed && "Logout"}
          </a>
        </li>
      </ul>
    </div>
  );
}
