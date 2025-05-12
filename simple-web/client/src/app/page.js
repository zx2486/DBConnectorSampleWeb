"use client";

import React, { useState, useContext } from "react";
import { AuthContext } from "./layout";


export default function Home() {
  const { isLoggedIn, setIsLoggedIn } = useContext(AuthContext); // Track login state
  const [username, setUsername] = useState(""); // Track username input
  const [password, setPassword] = useState(""); // Track password input
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setMessage("Please fill in all fields.");
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    localStorage.removeItem("accessToken");
    const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:4000";

    try {
      const response = await fetch(`${apiUrl}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (response.ok && data.success && data.accessToken) {
        setToastMessage("Login successfully!");
        setUsername("");
        setPassword("");
        setIsLoggedIn(true);
        // set access token in local storage
        localStorage.setItem("accessToken", data.accessToken);
      } else {
        setToastMessage((response?.message) ? `Login failed: ${response.message}` : 'Login failed.');
      }
    } catch (error) {
      console.error("Error submitting post:", error);
      setToastMessage("Failed to login.");
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
      <div className="flex gap-4 items-center flex-col sm:flex-row">
        Simple Web, click to view posts. Or login and submit your post.
      </div>

      <div className="flex gap-4 items-center flex-col sm:flex-row mt-6">
        {isLoggedIn ? (
          <div className="flex gap-4 items-center flex-col sm:flex-row mt-6">
            <a
              className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
              href="/profile"
              rel="noopener noreferrer"
            >
              View Profile
            </a>
            <a
              className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto md:w-[158px]"
              href="/posts/me"
              rel="noopener noreferrer"
            >
              View my posts
            </a>
            <a
              className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
              href="/posts/create"
              rel="noopener noreferrer"
            >
              Create a post
            </a>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border border-gray-300 rounded px-4 py-2"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-gray-300 rounded px-4 py-2"
              required
            />
            <button
              type="submit" disabled={isSubmitting}
              className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
            >
              {isSubmitting ? (
                <span className="loading-icon">⏳ Submitting...</span>
              ) : (
                "Login"
              )}
            </button>
            {toastMessage && <div className="toast">{toastMessage}</div>}
          </form>
        )}
      </div>

      <div className="flex gap-4 items-center flex-col sm:flex-row mt-6">
        <a
          className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
          href="/posts"
          rel="noopener noreferrer"
        >
          View public posts
        </a>
      </div>
    </main>
  );
}
