"use client";

import React, { useEffect, useState, useContext } from 'react';
import { AuthContext, apiService } from '../layout';
import { useRouter } from 'next/navigation';

// https://github.com/trandainhan/next.js-example-authentication-with-jwt/blob/master/server.js
function Posts() {
  const { isLoggedIn, setIsLoggedIn, loading, apiUrl } = useContext(AuthContext);
  const [showPopup, setShowPopup] = useState(false);
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const router = useRouter();
  useEffect(() => {
    if (loading) return; // Wait for loading to finish
    if (!isLoggedIn) {
      setShowPopup(true); // Show the popup if the user is not logged in
      return;
    }
    const response = apiService.get('/api/profile', {
      Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
    }, {})
      .then(response => {
        if (response.status === 401 || response.status === 400 || response.status === 403) {
          setShowPopup(true);
          setIsLoggedIn(false);
          return []
        }
        // return response.json()
        return response?.data || {};
      })
      .then(data => {
        setContent(data.content ?? data)
      })
      .catch(error => {
        console.error('Error fetching posts:', error)
      });
  }, [apiUrl, isLoggedIn, setIsLoggedIn, loading, refreshKey]);

  const handlePopupClose = () => {
    setShowPopup(false);
    router.push("/"); // Redirect to the main page
  };

  if (showPopup) {
    return (
      <div className="popup">
        <div className="popup-content">
          <p>You must be logged in to view this page.</p>
          <button onClick={handlePopupClose}>Go to Home</button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content) {
      setMessage("Please fill in all fields.");
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const response = await apiService.post('/api/profile', {
        Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
      }, { content });
      const data = response?.data || {};
      if (response.ok && data.success) {
        setToastMessage("Upsert remark request submitted successfully!");
        // setContent("");
      } else {
        setToastMessage("Failed to submit the request.");
      }
    } catch (error) {
      console.error("Error submitting post:", error);
      setToastMessage("Failed to submit the request.");
    } finally {
      setIsSubmitting(false);

      // Automatically hide the toast after 3 seconds
      setTimeout(() => {
        setToastMessage("");
        setRefreshKey((prevKey) => prevKey + 1); // Trigger refresh
      }, 3000);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
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
      const response = await apiService.patch('/api/user/password', {
        Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
      }, { oldPassword, newPassword, confirmPassword });
      const data = response?.data || {};
      if (response.ok && data.success) {
        setToastMessage("Password update request submitted successfully!");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setToastMessage("Failed updating with response:" + data.message);
      }
    } catch (error) {
      console.error("Error submitting post:", error);
      setToastMessage("Failed to submit the request.");
    } finally {
      setIsSubmitting(false);

      // Automatically hide the toast after 3 seconds
      setTimeout(() => {
        setToastMessage("");
        setRefreshKey((prevKey) => prevKey + 1); // Trigger refresh
      }, 3000);
    }
  };
  return (
    <main className="main">
      <h3>User Remark (Upsert)</h3>
      <div className="grid">
        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label htmlFor="content">Content</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows="5"
              required
            ></textarea>
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
      <h3>Change password (Update)</h3>
      <div className="grid">
        <form onSubmit={handlePasswordSubmit} className="form">
          <div className="form-group">
            <label htmlFor="oldPassword">Original Password</label>
            <input
              id="oldPassword"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
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