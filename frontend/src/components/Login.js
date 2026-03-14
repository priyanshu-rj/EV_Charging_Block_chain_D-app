import React, { useState } from "react";
import axios from "axios";
import "../CSS/Login.css";

function Login({ setUser }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const handleAuth = async () => {
    if (!username.trim() || !password.trim()) {
      alert("Please fill in both username and password.");
      return;
    }

    const endpoint = isRegistering
      ? "http://127.0.0.1:5000/api/register"
      : "http://127.0.0.1:5000/api/login";

    try {
      const res = await axios.post(endpoint, { username, password });
      if (isRegistering) {
        alert("✅ Registration successful! You can now log in.");
        setIsRegistering(false);
      } else {
        setUser(res.data);
      }
    } catch (err) {
      console.error("Error:", err);
      alert(err.response?.data?.error || "Something went wrong!");
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className={`face ${isPasswordFocused ? "password-focus" : ""}`}>
          <div className="eye left"></div>
          <div className="eye right"></div>
          <div className="hand left"></div>
          <div className="hand right"></div>
        </div>

        <h2>{isRegistering ? "📝 Register New User" : "🔐 EV Charging Login"}</h2>

        <input
          type="text"
          placeholder="Enter username"
          value={username}
          onFocus={() => setIsPasswordFocused(true)}
          onBlur={() => setIsPasswordFocused(false)}
          onChange={(e) => setUsername(e.target.value)}
          className="login-input"
        />

        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="login-input"
        />

        <button onClick={handleAuth} className="login-btn primary-btn">
          {isRegistering ? "Register" : "Login"}
        </button>

        <button
          onClick={() => setIsRegistering(!isRegistering)}
          className="login-btn secondary-btn"
        >
          {isRegistering
            ? "Already have an account? Login"
            : "New user? Register"}
        </button>
      </div>
    </div>
  );
}

export default Login;
