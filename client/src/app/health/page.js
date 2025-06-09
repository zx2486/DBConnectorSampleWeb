"use client";

import React, { useEffect, useState, useContext } from 'react';
import { AuthContext, apiService } from '../layout';

function Health() {
  const { loading, apiUrl } = useContext(AuthContext);

  const [serverState, setServerState] = useState('Down');
  const [comState, setComState] = useState({});
  const [urls, setUrls] = useState([]);
  const [users, setUsers] = useState([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    if (loading) return; // Wait for loading to finish

    apiService.get('/api/health', {
      'Content-Type': 'text/plain',
    }, {})
      .then(response => {
        if (response.status !== 200) {
          setServerState('')
          return;
        }
        setServerState(response?.data || '')
      })
      .catch(error => {
        console.error('Error fetching health:', error)
      });
    apiService.get('/api/health/status', {}, {})
      .then(response => {
        if (response.status !== 200) {
          setComState({})
          return;
        }
        setComState(response.data)
      })
      .catch(error => {
        console.error('Error fetching health:', error)
      });

    apiService.get('/api/health/statistics/url', {}, {})
      .then(response => {
        if (response.status !== 200) {
          setUrls([])
          return;
        }
        setUrls(response.data)
      })
      .catch(error => {
        console.error('Error fetching health:', error)
      });
    apiService.get('/api/health/statistics/users', {}, {})
      .then(response => {
        if (response.status !== 200) {
          setUsers([])
          return;
        }
        setUsers(response.data)
      })
      .catch(error => {
        console.error('Error fetching health:', error)
      });
  }, [apiUrl, loading, refreshKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const response = await apiService.delete('/api/health/all', {}, {});
      const data = response?.data || {};
      if (response.ok && data.success) {
        setToastMessage("All statistics removed successfully!");
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

  return (
    <main className="main">
      <h1 className="title">Cache status</h1>
      <p>Server health state: {serverState}</p>
      <h3>Component Status</h3>
      <p>System version: {comState?.version || 'unknown'}</p>
      <p>Database: {(comState?.db) ? 'Connected' : 'Not available'}</p>
      <p>Cache service: {(comState?.cache) ? 'Connected' : 'Not available'}</p>
      <h1 className="title">Statistics</h1>
      <h3>Top 10 popular url</h3>
      <ul className="url-list">
        {urls?.mostFrequent?.map((url, index) => (
          <li key={index} className="url-item">
            <span className="url-path">{url.item}</span>
            <span className="url-count">{url.count}</span>
          </li>
        ))}
      </ul>
      <h3>Slowest 10 url (in milliseconds)</h3>
      <ul className="url-list">
        {urls?.slowest?.map((url, index) => (
          <li key={index} className="url-item">
            <span className="url-path">{url.item}</span>
            <span className="url-count">{url.count}</span>
          </li>
        ))}
      </ul>
      <h3>Top 10 active users in last 7 days</h3>
      <ul className="url-list">
        {users?.map((url, index) => (
          <li key={index} className="url-item">
            <span className="url-path">{url.item}</span>
            <span className="url-count">{url.count}</span>
          </li>
        ))}
      </ul>
      <div className="grid">
        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label htmlFor="content">Dangerous: Remove all cache data (not working for simple-web and web-with-replica)</label>
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

export default Health;


