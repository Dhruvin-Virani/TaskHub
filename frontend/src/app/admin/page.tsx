"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { tasksApi, adminApi, type Task, type AppUser, type Analytics } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus, Users, Image as ImageIcon, CheckCircle,
  Loader2, RefreshCw, Trash2, UserCheck, RotateCcw, X, Upload
} from "lucide-react";

const STATUS_COLORS: Record<Task["status"], string> = {
  pending: "#71717a",
  assigned: "#3b82f6",
  in_progress: "#f59e0b",
  submitted: "#8b5cf6",
  accepted: "#22c55e",
  revision_requested: "#ef4444",
};

export default function AdminDashboardPage() {
  const { appUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState<Task | null>(null);
  const [showRevision, setShowRevision] = useState<Task | null>(null);

  // Form state
  const [form, setForm] = useState({ title: "", description: "", product_image_url: "" });
  const [assignUserId, setAssignUserId] = useState("");
  const [revisionNotes, setRevisionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [tasksRes, usersRes, analyticsRes] = await Promise.all([
        tasksApi.list(),
        adminApi.users(),
        adminApi.analytics(),
      ]);
      setTasks(tasksRes.tasks);
      setUsers(usersRes.users.filter((u) => u.role === "user"));
      setAnalytics(analyticsRes);
    } catch {
      toast.error("Failed to load dashboard data");
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!appUser) { router.replace("/login"); return; }
    if (appUser.role !== "admin") { router.replace("/dashboard"); return; }
    fetchAll();
  }, [appUser, authLoading, router, fetchAll]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (selectedUsers.length > 0) {
        for (const userId of selectedUsers) {
          await tasksApi.create({ ...form, assigned_to: userId });
        }
      } else {
        await tasksApi.create(form);
      }
      setForm({ title: "", description: "", product_image_url: "" });
      setSelectedUsers([]);
      setShowCreate(false);
      toast.success(selectedUsers.length > 0 ? "Tasks created and assigned!" : "Task created!");
      fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const res = await tasksApi.upload(file);
      setForm((prev) => ({ ...prev, product_image_url: res.url }));
      toast.success("Image uploaded!");
    } catch (err) {
      toast.error("Upload failed");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAssign = async () => {
    if (!showAssign || !assignUserId) return;
    setSubmitting(true);
    try {
      await tasksApi.assign(showAssign.id, assignUserId);
      setShowAssign(null);
      setAssignUserId("");
      toast.success("Task assigned! User notified via email.");
      fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = async (task: Task) => {
    try {
      await tasksApi.accept(task.id, "Great work! Images look professional.");
      toast.success("Task accepted! User notified.");
      fetchAll();
    } catch {
      toast.error("Accept failed");
    }
  };

  const handleRevision = async () => {
    if (!showRevision || !revisionNotes.trim()) return;
    setSubmitting(true);
    try {
      await tasksApi.requestRevision(showRevision.id, revisionNotes);
      setShowRevision(null);
      setRevisionNotes("");
      toast.success("Revision requested. User notified.");
      fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Revision request failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    try {
      await tasksApi.delete(taskId);
      toast.success("Task deleted");
      fetchAll();
    } catch {
      toast.error("Delete failed");
    }
  };

  if (authLoading || pageLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <Loader2 size={36} style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }} />
        <style dangerouslySetInnerHTML={{ __html: "@keyframes spin{100%{transform:rotate(360deg)}}" }} />
      </div>
    );
  }

  return (
    <div className="container animate-fade-in" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "2rem" }}>Admin Dashboard</h1>
          <p style={{ color: "var(--muted-foreground)" }}>Manage tasks, users, and platform analytics.</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="btn btn-outline" onClick={fetchAll}><RefreshCw size={16} /></button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={18} /> New Task
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="kpi-grid">
          {[
            { icon: <ImageIcon size={22} />, value: analytics.total_tasks, label: "Total Tasks", color: "#3b82f6" },
            { icon: <Users size={22} />, value: analytics.total_users, label: "Creators", color: "#8b5cf6" },
            { icon: <ImageIcon size={22} />, value: analytics.total_images_generated, label: "Images Generated", color: "#06b6d4" },
            { icon: <CheckCircle size={22} />, value: analytics.tasks_by_status?.submitted ?? 0, label: "Pending Review", color: "#f59e0b" },
            { icon: <CheckCircle size={22} />, value: analytics.tasks_by_status?.accepted ?? 0, label: "Accepted", color: "#22c55e" },
          ].map(({ icon, value, label, color }) => (
            <div key={label} className="glass-panel" style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ background: `${color}18`, color, padding: "0.875rem", borderRadius: "0.75rem" }}>{icon}</div>
              <div>
                <div style={{ fontSize: "1.75rem", fontWeight: 700, lineHeight: 1, fontFamily: "var(--font-outfit)" }}>{value}</div>
                <div style={{ color: "var(--muted-foreground)", fontSize: "0.8rem", marginTop: "0.2rem" }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Users Section */}
      <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>Platform Users ({users.length})</h2>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "2.5rem" }}>
        {users.map((u) => (
          <div key={u.id} className="glass-panel" style={{ padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "0.75rem" }}>
              {u.display_name ? u.display_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?'}
            </div>
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>{u.display_name}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{u.email}</div>
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <p style={{ color: "var(--muted-foreground)", fontSize: "0.875rem" }}>No users yet. Users appear here after their first sign-in.</p>
        )}
      </div>

      {/* Tasks Table */}
      <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>All Tasks ({tasks.length})</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
        {Object.values(tasks.reduce((acc, task) => {
          const key = `${task.title}|${task.description}|${task.product_image_url}`;
          if (!acc[key]) {
            acc[key] = { ...task, subTasks: [task], assignees: [] };
          } else {
            acc[key].subTasks.push(task);
          }
          const user = users.find((u) => u.id === task.assigned_to);
          if (user && !acc[key].assignees.includes(user.display_name)) {
            acc[key].assignees.push(user.display_name);
          }
          return acc;
        }, {} as Record<string, any>)).map((group: any) => {
          const task = group.subTasks[0]; // representative task
          const color = STATUS_COLORS[task.status as keyof typeof STATUS_COLORS] || "#71717a";

          return (
            <div key={task.id} className="glass-panel" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div 
                style={{ width: "100%", aspectRatio: "16/9", borderRadius: "0.5rem", overflow: "hidden", background: "var(--muted)", cursor: "zoom-in" }}
                onClick={() => setLightboxImage(task.product_image_url)}
              >
                <img
                  src={task.product_image_url}
                  alt={task.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                  <h4 style={{ fontSize: "1.125rem", fontWeight: 600, marginRight: "1rem" }}>{task.title}</h4>
                  <span
                    className="badge"
                    style={{ background: `${color}18`, color, border: `1px solid ${color}40`, flexShrink: 0 }}
                  >
                    {task.status.replace("_", " ").toUpperCase()}
                  </span>
                </div>
                <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)", marginBottom: "1rem", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {task.description}
                </p>
                <p style={{ fontSize: "0.8rem", color: "var(--muted-foreground)" }}>
                  {group.assignees.length > 0 ? `Assigned to: ${group.assignees.join(", ")}` : "Unassigned"}
                </p>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "auto", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                {group.assignees.length === 0 && (
                  <button className="btn btn-outline" onClick={() => setShowAssign(task)} style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem", flex: 1 }}>
                    <UserCheck size={14} /> Assign
                  </button>
                )}
                {task.status === "submitted" && (
                  <>
                    <button className="btn btn-primary" onClick={() => handleAccept(task)} style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem", flex: 1 }}>
                      <CheckCircle size={14} /> Accept
                    </button>
                    <button className="btn btn-outline" onClick={() => setShowRevision(task)} style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem", flex: 1 }}>
                      <RotateCcw size={14} /> Revision
                    </button>
                  </>
                )}
                <button 
                  className="btn btn-outline" 
                  onClick={async () => {
                    if (!confirm("Delete this task? This cannot be undone.")) return;
                    try {
                      for (const st of group.subTasks) {
                        await tasksApi.delete(st.id);
                      }
                      toast.success("Tasks deleted");
                      fetchAll();
                    } catch {
                      toast.error("Delete failed");
                    }
                  }} 
                  style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem", color: "#ef4444", borderColor: "#ef4444" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
        {tasks.length === 0 && (
          <div className="glass-panel" style={{ padding: "3rem", textAlign: "center", gridColumn: "1 / -1" }}>
            <p style={{ color: "var(--muted-foreground)" }}>No tasks yet. Click "New Task" to get started.</p>
          </div>
        )}
      </div>

      {/* ── Modal: Create Task ── */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem", pointerEvents: "none" }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: "600px", padding: "2rem", position: "relative", maxHeight: "90vh", overflowY: "auto", pointerEvents: "auto", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)", background: "var(--background)" }}>
            <button onClick={() => setShowCreate(false)} style={{ position: "absolute", top: "1rem", right: "1rem", background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}>
              <X size={20} />
            </button>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Create New Task</h2>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.875rem", fontWeight: 500 }}>Task Title *</label>
                <input type="text" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Luxury Watch Campaign" />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.875rem", fontWeight: 500 }}>Instructions *</label>
                <textarea className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required rows={3} placeholder="Describe the photography style, product details, any special notes…" />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.875rem", fontWeight: 500 }}>Product Image *</label>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input type="url" className="input" value={form.product_image_url} onChange={(e) => setForm({ ...form, product_image_url: e.target.value })} required placeholder="https://your-cdn.com/product.jpg or upload below" style={{ flex: 1 }} />
                  <span style={{ color: "var(--muted-foreground)", fontSize: "0.8rem", fontWeight: 600 }}>OR</span>
                  <label className="btn btn-outline" style={{ cursor: "pointer", whiteSpace: "nowrap" }}>
                    {uploadingImage ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={16} />} 
                    {uploadingImage ? "Uploading..." : "Upload Local"}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileUpload} disabled={uploadingImage} />
                  </label>
                </div>
              </div>
              
              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.875rem", fontWeight: 600, textTransform: "uppercase", color: "var(--muted-foreground)" }}>Assign Employees</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {users.map(u => {
                    const isSelected = selectedUsers.includes(u.id);
                    return (
                      <button 
                        key={u.id} 
                        type="button"
                        onClick={() => setSelectedUsers(prev => isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                        style={{ 
                          padding: "0.4rem 0.8rem", borderRadius: "1rem", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
                          background: isSelected ? "var(--primary)" : "var(--muted)",
                          color: isSelected ? "white" : "var(--foreground)",
                          border: isSelected ? "1px solid var(--primary)" : "1px solid var(--border)",
                          transition: "all 0.2s"
                        }}
                      >
                        {u.display_name}
                      </button>
                    )
                  })}
                  {users.length === 0 && <span style={{ fontSize: "0.8rem", color: "var(--muted-foreground)" }}>No users available.</span>}
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting || uploadingImage}>
                  {submitting ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : null}
                  {submitting ? "Creating…" : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Assign Task ── */}
      {showAssign && (
        <div style={{ position: "fixed", inset: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem", pointerEvents: "none" }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: "420px", padding: "2rem", position: "relative", pointerEvents: "auto", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)", background: "var(--background)" }}>
            <button onClick={() => setShowAssign(null)} style={{ position: "absolute", top: "1rem", right: "1rem", background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}>
              <X size={20} />
            </button>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Assign Task</h2>
            <p style={{ color: "var(--muted-foreground)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
              Assign <strong>{showAssign.title}</strong> to a user. They will receive an email notification.
            </p>
            <select
              className="input"
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
              style={{ marginBottom: "1rem" }}
            >
              <option value="">Select a user…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.display_name} ({u.email})</option>
              ))}
            </select>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowAssign(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAssign} disabled={!assignUserId || submitting}>
                {submitting ? "Assigning…" : "Assign & Notify"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Request Revision ── */}
      {showRevision && (
        <div style={{ position: "fixed", inset: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem", pointerEvents: "none" }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: "420px", padding: "2rem", position: "relative", pointerEvents: "auto", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)", background: "var(--background)" }}>
            <button onClick={() => setShowRevision(null)} style={{ position: "absolute", top: "1rem", right: "1rem", background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}>
              <X size={20} />
            </button>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Request Revision</h2>
            <p style={{ color: "var(--muted-foreground)", fontSize: "0.875rem", marginBottom: "1rem" }}>Describe what needs to be changed. The user will receive an email with your notes.</p>
            <textarea
              className="input"
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              rows={4}
              placeholder="e.g. The marble background images need better lighting. Please regenerate theme_1 and theme_2…"
              style={{ marginBottom: "1rem" }}
            />
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowRevision(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleRevision} disabled={!revisionNotes.trim() || submitting}>
                {submitting ? "Sending…" : "Send Revision Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightboxImage && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}
          onClick={() => setLightboxImage(null)}
        >
          <button style={{ position: "absolute", top: "1rem", right: "1rem", background: "white", border: "none", borderRadius: "50%", padding: "0.5rem", cursor: "pointer" }}>
            <X size={20} color="black" />
          </button>
          <img
            src={lightboxImage}
            alt="Full size"
            style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: "0.75rem" }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: "@keyframes spin{100%{transform:rotate(360deg)}}" }} />
    </div>
  );
}
