"use client";

import React, { useState } from "react";

function SubmitPost() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !content) {
      setMessage("Please fill in all fields.");
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:4000";

    try {
      const response = await fetch(`${apiUrl}/api/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({ title, content }),
      });

      if (response.ok) {
        setToastMessage("Post submitted successfully!");
        setTitle("");
        setContent("");
      } else {
        setToastMessage("Failed to submit the post.");
      }
    } catch (error) {
      console.error("Error submitting post:", error);
      setToastMessage("Failed to submit the post.");
    } finally {
      setIsSubmitting(false);

      // Automatically hide the toast after 3 seconds
      setTimeout(() => {
        setToastMessage("");
      }, 3000);
    }
  };

  return (
    <main className="main">
      <h1 className="title">Submit a Post</h1>
      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
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
      {toastMessage && <div className="toast">{toastMessage}</div>}
    </main>
  );
}

export default SubmitPost;