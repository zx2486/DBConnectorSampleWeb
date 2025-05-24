"use client";

import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../layout';
import { useRouter } from 'next/navigation';

// https://github.com/trandainhan/next.js-example-authentication-with-jwt/blob/master/server.js
function Posts() {
  const { isLoggedIn, setIsLoggedIn, loading, apiUrl } = useContext(AuthContext);
  const [showPopup, setShowPopup] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);


  const router = useRouter();
  useEffect(() => {
    if (loading) return; // Wait for loading to finish
    if (isLoggedIn) {
      setShowPopup(true); // Show the popup if the user is logged in
      return;
    }
  }, [apiUrl, isLoggedIn, loading, refreshKey]);

  const handlePopupClose = () => {
    setShowPopup(false);
    console.log("Redirecting to home page...");
    router.push("/"); // Redirect to the main page
  };

  if (showPopup) {
    return (
      <div className="popup">
        <div className="popup-content">
          <p>You are login already.</p>
          <button onClick={handlePopupClose}>Go to Home</button>
        </div>
      </div>
    );
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!username || !newPassword || !confirmPassword) {
      setMessage("Please fill in all fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("New password and confirm password do not match.");
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiUrl}/api/account/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({ username, newPassword, confirmPassword }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setToastMessage("Registered successfully !");
        setUsername("");
        setNewPassword("");
        setConfirmPassword("");
        if (data.accessToken) {
          // set access token in local storage
          localStorage.setItem("accessToken", data.accessToken);
        }
      } else {
        setToastMessage("Failed registering with response:" + data.message);
      }
    } catch (error) {
      console.error("Error submitting registration:", error);
      setToastMessage("Failed to submit the request.");
    } finally {
      setIsSubmitting(false);

      // Automatically hide the toast after 3 seconds
      setTimeout(() => {
        setToastMessage("");
        if (localStorage.getItem("accessToken")) {
          setIsLoggedIn(true);
        }
        setRefreshKey((prevKey) => prevKey + 1); // Trigger refresh
      }, 3000);
    }
  };
  return (
    <main className="main">
      <h3>Registration (Transactional db write)</h3>
      <div className="grid">
        <form onSubmit={handlePasswordSubmit} className="form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="newPassword">Password</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="loading-icon">⏳ Submitting...</span>
            ) : (
              "Submit"
            )}
          </button>
        </form>
      </div>
      {toastMessage && <div className="toast">{toastMessage}</div>}
    </main>
  );
}

export default Posts;