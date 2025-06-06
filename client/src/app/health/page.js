"use client";

import React, { useEffect, useState, useContext } from 'react';
import { AuthContext, apiService } from '../layout';

function Health() {
  const { loading, apiUrl } = useContext(AuthContext);

  const [serverState, setServerState] = useState('Down');
  const [comState, setComState] = useState({});
  const [urls, setUrls] = useState([]);
  const [users, setUsers] = useState([]);

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
  }, [apiUrl, loading]);

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
    </main>
  );
}

export default Health;


