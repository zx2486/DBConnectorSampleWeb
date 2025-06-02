"use client";

import React, { useEffect, useState, useContext } from 'react';
import { AuthContext, apiService } from '../../layout';
import { useRouter } from 'next/navigation';

// https://github.com/trandainhan/next.js-example-authentication-with-jwt/blob/master/server.js
function Posts() {
  const { isLoggedIn, setIsLoggedIn, loading, apiUrl } = useContext(AuthContext);
  const [posts, setPosts] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const router = useRouter();

  const [deleteId, setDeleteId] = useState(null);
  const [showDeletePopup, setDeletePopup] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [hideId, setHideId] = useState(null);
  const [showHidePopup, setHidePopup] = useState(false);

  useEffect(() => {
    if (loading) return; // Wait for loading to finish
    if (!isLoggedIn) {
      setShowPopup(true); // Show the popup if the user is not logged in
      return;
    }

    const response = apiService.get('/api/posts/me', {
      Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
    }, {})
      .then(response => {
        if (response.status === 401) {
          setShowPopup(true);
          setIsLoggedIn(false);
          return []
        }
        // return response.json()
        return response?.data || {};
      })
      .then(data => setPosts(data.rows || data))
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

  const handleDelete = async (postId) => {
    setDeleteId(postId);
    setDeletePopup(true);
  }
  const handleDeletePopClose = () => {
    setDeleteId(null);
    setDeletePopup(false);
  }
  const handleDeletePopupTrue = async () => {
    try {
      const postId = deleteId;
      const response = await apiService.delete(`/api/posts/${postId}`, {
        Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
      }, {});
      if (response.ok) {
        console.log(`Post with ID ${postId} deleted successfully.`);
        setDeleteId(null);
        setDeletePopup(false);
        setRefreshKey(prevKey => prevKey + 1); // Trigger a refresh
      } else {
        console.error("Failed to delete the post.");
      }
    } catch (error) {
      console.error("Error deleting the post:", error);
    }
  };
  if (showDeletePopup) {
    return (
      <div className="popup">
        <div className="popup-content">
          <p>Are you confirm to delete this post?</p>
          <button onClick={handleDeletePopupTrue}>Delete</button>
          <button onClick={handleDeletePopClose}>Cancel</button>
        </div>
      </div>
    );
  }
  const handleHide = async (postId) => {
    setHideId(postId);
    setHidePopup(true);
  }
  const handleHidePopClose = () => {
    setHideId(null);
    setHidePopup(false);
  }
  const handleHidePopupTrue = async () => {
    try {
      const postId = hideId;
      const response = await apiService.put(`/api/posts/${postId}`, {
        Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
      }, { active: !posts.find(post => post.id === postId).active });

      if (response.ok) {
        console.log(`Post with ID ${postId} updated successfully.`);
        setHideId(null);
        setHidePopup(false);
        setRefreshKey(prevKey => prevKey + 1); // Trigger a refresh
      } else {
        console.error("Failed to update the post.");
      }
    } catch (error) {
      console.error("Error updating the post:", error);
    }
  };
  if (showHidePopup) {
    return (
      <div className="popup">
        <div className="popup-content">
          <p>Are you confirm to {(posts.find(post => post.id === hideId).active) ? 'hide' : 'make public'} this post?</p>
          <button onClick={handleHidePopupTrue}>Confirm</button>
          <button onClick={handleHidePopClose}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <main className="main">
      <h1 className="title">Posts</h1>
      <p>Always latest</p>
      <div className="grid">
        {posts && posts.length > 0 && posts?.map(post => (
          <a key={post.id} className="card">
            <h3>{post.title}</h3>
            <p>{post.content}</p>
            <hr style={{ borderTop: "1px dotted #000" }} />
            <p className="author">{(post.active) ? 'Public' : 'Hidden'}</p>
            <p className="author" onClick={() => handleHide(post.id)}>{(post.active) ? 'Hide up' : 'Make it Public'}</p>
            <p className="author" onClick={() => handleDelete(post.id)}>Delete</p>
          </a>
        ))}
      </div>
    </main>
  );
}

export default Posts;