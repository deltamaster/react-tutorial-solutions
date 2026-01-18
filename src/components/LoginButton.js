import React, { useState, useEffect } from "react";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import * as Icon from "react-bootstrap-icons";
import { useAuth } from "../contexts/AuthContext";

const LoginButton = () => {
  let authContext;
  try {
    authContext = useAuth();
  } catch (error) {
    console.error("AuthContext error:", error);
    // Fallback if AuthContext is not available
    return (
      <div style={{ display: "inline-block" }}>
        <Button variant="primary" size="sm" disabled style={{ minWidth: "250px" }}>
          <Icon.BoxArrowInRight size={16} className="mr-2" />
          Login with Microsoft account
        </Button>
        <Alert variant="warning" className="mt-2 mb-0" style={{ fontSize: "0.85em" }}>
          Authentication not available
        </Alert>
      </div>
    );
  }

  const { isAuthenticated, user, login, logout, isLoading, isConfigured } = authContext;
  const [error, setError] = useState(null);

  // Debug logging
  useEffect(() => {
    console.log("LoginButton render:", { isAuthenticated, isLoading, isConfigured, user: user?.name });
  }, [isAuthenticated, isLoading, isConfigured, user]);

  const handleLogin = async () => {
    setError(null);
    try {
      await login();
    } catch (error) {
      console.error("Login failed:", error);
      setError(error.message || "Login failed. Please check your Azure AD Client ID configuration.");
    }
  };

  const handleLogout = async () => {
    setError(null);
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
      setError("Logout failed. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: "inline-block" }}>
        <Button variant="outline-primary" disabled style={{ minWidth: "250px" }}>
          <Icon.ArrowRepeat size={16} className="mr-2" />
          Loading...
        </Button>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div style={{ display: "inline-block" }}>
        <Button variant="primary" size="sm" disabled style={{ minWidth: "250px" }}>
          <Icon.BoxArrowInRight size={16} className="mr-2" />
          Login with Microsoft account
        </Button>
        <Alert variant="warning" className="mt-2 mb-0" style={{ fontSize: "0.85em" }}>
          <Icon.ExclamationTriangle size={14} className="mr-2" />
          MSAL not configured. Please set your Azure AD Client ID in <code>src/config/msalConfig.js</code>
        </Alert>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: error ? "10px" : "0" }}>
          <span className="text-muted" style={{ fontSize: "0.9em" }}>
            {user.name || user.username}
          </span>
          <Button variant="outline-danger" size="sm" onClick={handleLogout}>
            <Icon.BoxArrowRight size={16} className="mr-2" />
            Logout
          </Button>
        </div>
        {error && (
          <Alert variant="danger" className="mt-2 mb-0" onClose={() => setError(null)} dismissible>
            {error}
          </Alert>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "inline-block" }}>
      <Button variant="primary" size="sm" onClick={handleLogin} style={{ minWidth: "250px" }}>
        <Icon.BoxArrowInRight size={16} className="mr-2" />
        Login with Microsoft account
      </Button>
      {error && (
        <Alert variant="danger" className="mt-2 mb-0" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}
    </div>
  );
};

export default LoginButton;
