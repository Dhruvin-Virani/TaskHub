"use client";

import Link from "next/link";
import { Camera, Sparkles, Wand2, ImageIcon, Shield, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LandingPage() {
  const { appUser } = useAuth();
  const router = useRouter();

  // Redirect authenticated users to their dashboard
  useEffect(() => {
    if (appUser) {
      router.replace(appUser.role === "admin" ? "/admin" : "/dashboard");
    }
  }, [appUser, router]);

  return (
    <div>
      {/* Hero */}
      <div className="container animate-fade-in" style={{ paddingTop: "5rem", paddingBottom: "5rem", textAlign: "center" }}>
        <div style={{ maxWidth: "820px", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: "2rem" }}>
          <div className="badge badge-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", display: "inline-flex", gap: "0.4rem" }}>
            <Sparkles size={14} /> AI Product Photography Studio
          </div>

          <h1 style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0 }}>
            Perfect product photos.<br />
            <span className="gradient-text">Zero photo shoots.</span>
          </h1>

          <p style={{ fontSize: "1.2rem", color: "var(--muted-foreground)", maxWidth: "600px", lineHeight: 1.7, margin: 0 }}>
            TaskHub assigns product photography tasks to creators, who generate 8 professional AI images per product — white background, themed, lifestyle, and model-wearing — while keeping your product <strong>exactly the same</strong> in every shot.
          </p>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
            <Link href="/login" className="btn btn-primary" style={{ padding: "1rem 2.5rem", fontSize: "1rem" }}>
              <Wand2 size={18} /> Get Started
            </Link>
            <a href="#how-it-works" className="btn btn-outline" style={{ padding: "1rem 2.5rem", fontSize: "1rem" }}>
              How It Works
            </a>
          </div>
        </div>

        {/* Feature preview card */}
        <div style={{ marginTop: "4rem" }}>
          <div className="glass-panel" style={{
            padding: "2rem",
            background: "linear-gradient(135deg, rgba(139,92,246,0.07) 0%, rgba(59,130,246,0.07) 100%)",
            maxWidth: "900px",
            margin: "0 auto",
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "1rem" }}>
              {[
                { label: "White BG", color: "#ffffff", border: "1px solid #e4e4e7" },
                { label: "Marble Theme", color: "linear-gradient(135deg, #c9c9c9, #f0f0f0)" },
                { label: "Velvet Theme", color: "linear-gradient(135deg, #1a0533, #4c1d95)" },
                { label: "Beach Scene", color: "linear-gradient(135deg, #0ea5e9, #f59e0b)" },
                { label: "Interior", color: "linear-gradient(135deg, #78716c, #d6d3d1)" },
                { label: "Model Front", color: "linear-gradient(135deg, #f9a8d4, #fbcfe8)" },
                { label: "Model Side", color: "linear-gradient(135deg, #fda4af, #f9a8d4)" },
                { label: "Model Close", color: "linear-gradient(135deg, #c4b5fd, #a78bfa)" },
              ].map(({ label, color, border }) => (
                <div key={label} style={{
                  height: "80px", borderRadius: "0.5rem",
                  background: typeof color === "string" && color.startsWith("linear") ? color : color,
                  border: border ?? "none",
                  display: "flex", alignItems: "flex-end", padding: "0.5rem",
                }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 600, color: label.includes("White") ? "#71717a" : "rgba(255,255,255,0.85)", background: "rgba(0,0,0,0.2)", padding: "0.2rem 0.4rem", borderRadius: "0.25rem" }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <p style={{ marginTop: "1rem", color: "var(--muted-foreground)", fontSize: "0.875rem" }}>
              8 professional images per product, generated with AI
            </p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div id="how-it-works" className="container" style={{ paddingBottom: "6rem" }}>
        <h2 style={{ textAlign: "center", fontSize: "2rem", marginBottom: "3rem" }}>How TaskHub Works</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.5rem" }}>
          {[
            { icon: <Shield size={28} />, title: "1. Admin Creates Task", desc: "Upload a product image and create a photography task. Assign it to a creator on your team.", color: "#8b5cf6" },
            { icon: <Zap size={28} />, title: "2. Creator Generates", desc: "Creator opens the AI Studio and generates all 8 required images. Regenerate until quality is perfect.", color: "#3b82f6" },
            { icon: <Camera size={28} />, title: "3. Admin Reviews", desc: "Admin reviews the submission, accepts it or requests specific revisions. Creator is notified by email.", color: "#22c55e" },
            { icon: <ImageIcon size={28} />, title: "4. Download Assets", desc: "All 8 professional product images are ready for your e-commerce store, ads, and campaigns.", color: "#f59e0b" },
          ].map(({ icon, title, desc, color }) => (
            <div key={title} className="glass-panel" style={{ padding: "2rem" }}>
              <div style={{ background: `${color}18`, color, padding: "1rem", borderRadius: "0.75rem", display: "inline-flex", marginBottom: "1.25rem" }}>
                {icon}
              </div>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>{title}</h3>
              <p style={{ color: "var(--muted-foreground)", fontSize: "0.9rem", lineHeight: 1.6, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
