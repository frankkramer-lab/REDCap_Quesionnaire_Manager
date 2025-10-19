// src/pages/ProfilePage.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({ username: "", email: "" });
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    axios
      .get("http://localhost:5000/api/user/profile", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setProfile(res.data);
        setFormData({ username: res.data.username, email: res.data.email });
      })
      .catch(() => {
        alert("Session expired");
        localStorage.removeItem("token");
        navigate("/login");
      });
  }, [navigate]);

  const handleUpdate = () => {
    const token = localStorage.getItem("token");
    axios
      .put("http://localhost:5000/api/user/profile", formData, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(() => alert("✅ Profile successfully updated"))
      .catch((err) => alert(err.response?.data?.error || "Error while saving"));
  };

  const handleChangePassword = () => {
    const token = localStorage.getItem("token");
    axios
      .put("http://localhost:5000/api/user/password", passwords, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(() => {
        alert("🔒 Password changed");
        setPasswords({ currentPassword: "", newPassword: "" });
      })
      .catch((err) => alert(err.response?.data?.error || "Error while changing password"));
  };

  const handleDeleteAccount = () => {
    if (!window.confirm("Are you sure you want to delete your account?")) return;

    const token = localStorage.getItem("token");
    axios
      .delete("http://localhost:5000/api/user", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(() => {
        alert("🗑️ Account deleted");
        localStorage.removeItem("token");
        navigate("/register");
      })
      .catch((err) => alert(err.response?.data?.error || "Error while deleting account"));
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow-md rounded-md">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">👤 Profile</h1>

      <h2 className="text-xl font-semibold mb-2 text-gray-700">Edit user details</h2>
      <input
        className="border p-2 block mb-2 w-full rounded"
        placeholder="Username"
        value={formData.username}
        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
      />
      <input
        className="border p-2 block mb-4 w-full rounded"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
      />
      <button
        onClick={handleUpdate}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mb-6 transition"
      >
        Save
      </button>

      <h2 className="text-xl font-semibold mb-2 text-gray-700">🔑 Change password</h2>
      <input
        className="border p-2 block mb-2 w-full rounded"
        placeholder="Current password"
        type="password"
        value={passwords.currentPassword}
        onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
      />
      <input
        className="border p-2 block mb-4 w-full rounded"
        placeholder="New password"
        type="password"
        value={passwords.newPassword}
        onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
      />
      <button
        onClick={handleChangePassword}
        className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded mb-6 transition"
      >
        Change password
      </button>

      <h2 className="text-xl font-semibold mb-2 text-red-600">🛑 Delete account</h2>
      <button
        onClick={handleDeleteAccount}
        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition"
      >
        Delete account
      </button>
    </div>
  );
}
