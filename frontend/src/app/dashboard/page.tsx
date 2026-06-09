"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { tasksApi, type Task } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";
import { Clock, CheckCircle, AlertCircle, ArrowRight, Image as ImageIcon, RefreshCw, Loader2 } from "lucide-react";

const STATUS_LABELS: Record<Task["status"], { label: string; color: string }> = {
  pending: { label: "Pending", color: "#71717a" },
  assigned: { label: "Assigned", color: "#3b82f6" },
  in_progress: { label: "In Progress", color: "#f59e0b" },
  submitted: { label: "Submitted", color: "#8b5cf6" },
  accepted: { label: "Accepted", color: "#22c55e" },
  revision_requested: { label: "Needs Revision", color: "#ef4444" },
};

export default function UserDashboardPage() {
  const { appUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await tasksApi.myTasks();
      setTasks(res.tasks);
    } catch (err) {
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!appUser) { router.replace("/login"); return; }
    if (appUser.role === "admin") { router.replace("/admin"); return; }
    fetchTasks();
  }, [appUser, authLoading, router, fetchTasks]);

  if (authLoading || loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }} />
        <style dangerouslySetInnerHTML={{ __html: "@keyframes spin{100%{transform:rotate(360deg)}}" }} />
      </div>
    );
  }

  return (
    <div className="container animate-fade-in" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "2rem" }}>My Tasks</h1>
          <p style={{ color: "var(--muted-foreground)" }}>
            Welcome back, <strong>{appUser?.display_name}</strong>. Here are your assigned tasks.
          </p>
        </div>
        <button className="btn btn-outline" onClick={fetchTasks} style={{ gap: "0.4rem" }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="glass-panel" style={{ padding: "4rem", textAlign: "center" }}>
          <ImageIcon size={48} style={{ color: "var(--muted-foreground)", margin: "0 auto 1rem" }} />
          <h3 style={{ marginBottom: "0.5rem" }}>No tasks assigned yet</h3>
          <p style={{ color: "var(--muted-foreground)" }}>
            Your administrator will assign product photography tasks to you shortly.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
          {tasks.map((task) => {
            const { label, color } = STATUS_LABELS[task.status];
            const imageCount = task.generated_images?.length ?? 0;

            return (
              <Link
                key={task.id}
                href={`/dashboard/task/${task.id}`}
                className="glass-panel"
                style={{ display: "block", padding: "1.5rem", transition: "transform 0.15s", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
              >
                {/* Product Image Thumbnail */}
                <div style={{
                  width: "100%", aspectRatio: "16/9", borderRadius: "0.5rem",
                  overflow: "hidden", marginBottom: "1rem", background: "var(--muted)"
                }}>
                  <img
                    src={task.product_image_url}
                    alt={task.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                  <h3 style={{ fontSize: "1.125rem", flex: 1, marginRight: "1rem" }}>{task.title}</h3>
                  <span className="badge" style={{ background: `${color}20`, color, border: `1px solid ${color}40`, flexShrink: 0 }}>
                    {label}
                  </span>
                </div>

                <p style={{
                  color: "var(--muted-foreground)", fontSize: "0.875rem", marginBottom: "1.25rem",
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden"
                }}>
                  {task.description}
                </p>

                {/* Progress Bar */}
                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--muted-foreground)", marginBottom: "0.4rem" }}>
                    <span>Progress</span>
                    <span>{imageCount}/8 images</span>
                  </div>
                  <div style={{ height: "4px", background: "var(--muted)", borderRadius: "9999px", overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${(imageCount / 8) * 100}%`,
                      background: "linear-gradient(to right, #8b5cf6, #3b82f6)",
                      borderRadius: "9999px",
                      transition: "width 0.3s",
                    }} />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--muted-foreground)", fontSize: "0.8rem" }}>
                    <ImageIcon size={14} /> 8 images required
                  </div>
                  <ArrowRight size={16} color="var(--primary)" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
