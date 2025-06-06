"use client";

import React, { useEffect, useState, useContext } from 'react';
import { AuthContext, apiService } from '../layout';
import { useRouter } from 'next/navigation';

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
        console.log('Response:', response);
        if (response.status !== 200) {
          setUsers([])
          return;
        }
        console.log('Users data:', response.data);
        setUsers(response.data)
      })
      .catch(error => {
        console.error('Error fetching health:', error)
      });
  }, [apiUrl, loading]);

 return (
    <main className="main">
      <h3>Cache status</h3>
      <p>Server health state: {serverState}</p>
      <h3>Component Status</h3>
      <p>System version: {comState?.version || 'unknown'}</p>
      <p>Database: { (comState?.db)? 'Connected' : 'Not available' }</p>
      <p>Cache service: { (comState?.cache)? 'Connected':'Not available' }</p>
      <h3>Statistics</h3>
      <h3>Top 10 popular url</h3>
      <ul>
        {urls?.mostFrequent?.map((url, index) => (
          <li key={index}>
            {url.item} - {url.count}
          </li>
        ))}
      </ul>
      <h3>Slowest 10 url</h3>
      <ul>
        {urls?.slowest?.map((url, index) => (
          <li key={index}>
            {url.item} - {url.count}
          </li>
        ))}
      </ul>
      <h3>Top 10 active users in last 7 days</h3>
      <ul>
        {users?.map((user, index) => (
          <li key={index}>
            {user.item} - {user.count}
          </li>
        ))}
      </ul>
    </main>
  );
}

export default Health;


