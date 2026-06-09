"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Camera, Moon, Sun, LogOut, LayoutDashboard } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function Navbar() {
  const { appUser, firebaseUser, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
      toast.success("Signed out");
    } catch {
      toast.error("Sign-out failed");
    }
  };

  const dashboardHref = appUser?.role === "admin" ? "/admin" : "/dashboard";

  return (
    <nav
      className="glass-panel"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderTop: "none",
        borderLeft: "none",
        borderRight: "none",
        borderRadius: 0,
        padding: "1rem 0",
      }}
    >
      <div
        className="container"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "1.25rem" }}
        >
          <div
            style={{
              background: "var(--primary)",
              padding: "0.5rem",
              borderRadius: "0.5rem",
              color: "white",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Camera size={20} />
          </div>
          <span className="gradient-text">TaskHub</span>
        </Link>

        {/* Right Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="btn btn-outline"
              style={{ padding: "0.5rem" }}
              aria-label="Toggle Theme"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          )}

          {firebaseUser ? (
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div className="user-menu-container" style={{ position: "relative" }}>
                <button
                  onClick={() => {
                    const dropdown = document.getElementById('user-dropdown');
                    if (dropdown) dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
                  }}
                  style={{
                    width: "36px", height: "36px", borderRadius: "50%", background: "var(--primary)",
                    color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600,
                    border: "none", cursor: "pointer", fontSize: "0.875rem"
                  }}
                >
                  {appUser?.display_name 
                    ? appUser.display_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() 
                    : <LogOut size={16} />}
                </button>
                
                <div
                  id="user-dropdown"
                  className="glass-panel"
                  style={{
                    display: "none", position: "absolute", top: "100%", right: 0, marginTop: "0.5rem",
                    minWidth: "150px", padding: "0.5rem", zIndex: 100
                  }}
                >
                  {appUser?.display_name && (
                    <div style={{ padding: "0.5rem", fontSize: "0.875rem", borderBottom: "1px solid var(--border)", marginBottom: "0.5rem" }}>
                      {appUser.display_name}
                    </div>
                  )}
                  <button onClick={handleSignOut} className="btn btn-outline" style={{ width: "100%", justifyContent: "flex-start", border: "none" }}>
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <Link href="/login" className="btn btn-primary">
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
