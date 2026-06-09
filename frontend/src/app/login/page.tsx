"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Camera, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const { signInWithGoogle, signInWithGithub, appUser, loading, backendError, firebaseUser } = useAuth();
  const [signingIn, setSigningIn] = useState<"google" | "github" | null>(null);
  const router = useRouter();

  // ── Redirect once appUser is known ────────────────────────────────────────
  // MUST be in useEffect — never call router.replace() during render in Next.js
  useEffect(() => {
    if (!loading && appUser) {
      router.replace(appUser.role === "admin" ? "/admin" : "/dashboard");
    }
  }, [appUser, loading, router]);

  // ── Show backend error as toast when it appears ────────────────────────────
  useEffect(() => {
    if (backendError) {
      toast.error(backendError, { duration: 8000, id: "backend-error" });
    }
  }, [backendError]);

  const handleGoogle = async () => {
    setSigningIn("google");
    try {
      await signInWithGoogle();
      // AuthContext onAuthStateChanged fires → calls backend → sets appUser → useEffect redirects
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("popup-closed-by-user") || msg.includes("cancelled-popup-request")) {
        toast.info("Sign-in cancelled");
      } else if (msg.includes("popup-blocked")) {
        toast.error("Popup was blocked by your browser. Please allow popups for localhost.");
      } else {
        toast.error("Google sign-in failed. Check Firebase Console → Authentication → Sign-in method.");
      }
    } finally {
      setSigningIn(null);
    }
  };

  const handleGithub = async () => {
    setSigningIn("github");
    try {
      await signInWithGithub();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("popup-closed-by-user")) {
        toast.info("Sign-in cancelled");
      } else {
        toast.error("GitHub sign-in failed. Make sure GitHub provider is enabled in Firebase Console.");
      }
    } finally {
      setSigningIn(null);
    }
  };

  // Auth state is still loading
  if (loading) {
    return (
      <div style={{ display: "flex", height: "calc(100vh - 80px)", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={32} color="var(--primary)" style={{ animation: "spin 1s linear infinite" }} />
        <style dangerouslySetInnerHTML={{ __html: "@keyframes spin{100%{transform:rotate(360deg)}}" }} />
      </div>
    );
  }

  // Firebase signed in but backend call failed — show error state
  const isBackendDown = !!firebaseUser && !appUser && !!backendError;

  return (
    <div
      style={{
        display: "flex",
        height: "calc(100vh - 80px)",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{ padding: "2.5rem", width: "100%", maxWidth: "420px" }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              background: "linear-gradient(135deg, #8b5cf6, #3b82f6)",
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem auto",
              color: "white",
            }}
          >
            <Camera size={28} />
          </div>
          <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Welcome to TaskHub</h1>
          <p style={{ color: "var(--muted-foreground)", fontSize: "0.9rem", lineHeight: 1.6 }}>
            AI-powered product photography studio.<br />
            Sign in to access your workspace.
          </p>
        </div>

        {/* Backend error banner */}
        {isBackendDown && (
          <div style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "0.75rem",
            padding: "1rem",
            marginBottom: "1.5rem",
            display: "flex",
            gap: "0.75rem",
            alignItems: "flex-start",
          }}>
            <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: "1px" }} />
            <div>
              <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#ef4444", marginBottom: "0.25rem" }}>
                Backend unreachable
              </p>
              <p style={{ fontSize: "0.8rem", color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                Firebase sign-in worked but the Flask backend isn&apos;t responding.<br />
                Run <code style={{ background: "var(--muted)", padding: "0.1rem 0.3rem", borderRadius: "0.25rem", fontSize: "0.75rem" }}>python app.py</code> in the <strong>backend/</strong> folder.
              </p>
            </div>
          </div>
        )}

        {/* OAuth Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <button
            id="google-signin-btn"
            className="btn btn-outline"
            onClick={handleGoogle}
            disabled={!!signingIn}
            style={{ width: "100%", padding: "0.875rem", fontSize: "1rem", justifyContent: "center" }}
          >
            {signingIn === "google" ? (
              <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {signingIn === "google" ? "Signing in..." : "Continue with Google"}
          </button>

          <button
            id="github-signin-btn"
            className="btn btn-outline"
            onClick={handleGithub}
            disabled={!!signingIn}
            style={{ width: "100%", padding: "0.875rem", fontSize: "1rem", justifyContent: "center" }}
          >
            {signingIn === "github" ? (
              <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            )}
            {signingIn === "github" ? "Signing in..." : "Continue with GitHub"}
          </button>
        </div>

        <p style={{ textAlign: "center", marginTop: "2rem", color: "var(--muted-foreground)", fontSize: "0.8rem" }}>
          Your role (admin/user) is set by your administrator in Supabase.
        </p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: "@keyframes spin { 100% { transform: rotate(360deg); } }" }} />
    </div>
  );
}
