"use client";

import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../layout';
import { useRouter } from 'next/navigation';

// https://github.com/trandainhan/next.js-example-authentication-with-jwt/blob/master/server.js
function Posts() {
  const { isLoggedIn, setIsLoggedIn, loading, apiUrl } = useContext(AuthContext);
  const [posts, setPosts] = useState([]);
  const [showPopup, setShowPopup] = useState(false);

  const router = useRouter();
  useEffect(() => {
    if (loading) return; // Wait for loading to finish
    /* if (!isLoggedIn) {
      setShowPopup(true); // Show the popup if the user is not logged in
      return;
    }
    */
    fetch(`${apiUrl}/api/posts`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        // Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
      },
    })
      .then(response => {
        if (response.status === 401) {
          setShowPopup(true);
          setIsLoggedIn(false);
          return []
        }
        return response.json()
      })
      .then(data => setPosts(data.rows || data))
      .catch(error => {
        console.error('Error fetching posts:', error)
      });
  }, [apiUrl, isLoggedIn, setIsLoggedIn, loading]);

  /* const handlePopupClose = () => {
    setShowPopup(false);
    console.log("Redirecting to home page...");
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
  */

  return (
    <main className="main">
      <h1 className="title">Posts</h1>
      <p>Result may delay up to 60s due to caching</p>
      <div className="grid">
        {posts && posts.length > 0 && posts?.map(post => (
          <a key={post.id} className="card">
            <h3>{post.title}</h3>
            <p>{post.content}</p>
            <p className="author">By {post.author_name}</p>
          </a>
        ))}
      </div>
    </main>
  );
}

export default Posts;