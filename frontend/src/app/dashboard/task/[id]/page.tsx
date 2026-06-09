"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { tasksApi, generationApi, type Task, type GeneratedImage, type GenerationJob } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft, Loader2, RefreshCw, Check, Download, Trash2, Send, ZoomIn, X
} from "lucide-react";

const IMAGE_TYPES = [
  { type: "white_bg",     label: "White Background",  group: "Background",  desc: "Pure white #FFFFFF, e-commerce quality" },
  { type: "theme_1",     label: "Theme Background 1", group: "Theme",       desc: "Luxury marble surface, product centered" },
  { type: "theme_2",     label: "Theme Background 2", group: "Theme",       desc: "Dark velvet fabric, luxury product setting" },
  { type: "creative_1",  label: "Creative Scene 1",   group: "Creative",    desc: "Photorealistic lifestyle – golden hour" },
  { type: "creative_2",  label: "Creative Scene 2",   group: "Creative",    desc: "Photorealistic lifestyle – modern interior" },
  { type: "model_front", label: "Model – Front View", group: "Model",       desc: "Realistic model, full front facing angle" },
  { type: "model_side",  label: "Model – Side (45°)", group: "Model",       desc: "Realistic model, 45-degree side profile" },
  { type: "model_close", label: "Model – Close-up",   group: "Model",       desc: "Extreme close-up macro, product detail" },
] as const;

type ImageType = typeof IMAGE_TYPES[number]["type"];

export default function TaskStudioPage() {
  const params = useParams();
  const router = useRouter();
  const { appUser, loading: authLoading } = useAuth();
  const taskId = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [generations, setGenerations] = useState<GeneratedImage[]>([]);
  const [jobs, setJobs] = useState<Record<string, GenerationJob>>({});
  const [lightbox, setLightbox] = useState<GeneratedImage | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // polling intervals
  const pollingRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const fetchTask = useCallback(async () => {
    const res = await tasksApi.get(taskId);
    setTask(res.task);
  }, [taskId]);

  const fetchGenerations = useCallback(async () => {
    const res = await generationApi.listGenerations(taskId);
    setGenerations(res.images);
  }, [taskId]);

  useEffect(() => {
    if (authLoading) return;
    if (!appUser) { router.replace("/login"); return; }
    Promise.all([fetchTask(), fetchGenerations()]).finally(() => setPageLoading(false));
  }, [authLoading, appUser, router, fetchTask, fetchGenerations]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      Object.values(pollingRef.current).forEach(clearInterval);
    };
  }, []);

  const startPolling = (jobId: string, imageType: ImageType) => {
    if (pollingRef.current[jobId]) return;
    const interval = setInterval(async () => {
      try {
        const res = await generationApi.pollJob(jobId);
        const job = res.job;
        setJobs((prev) => ({ ...prev, [imageType]: job }));

        if (job.status === "completed") {
          clearInterval(interval);
          delete pollingRef.current[jobId];
          await fetchGenerations();
          toast.success(`${IMAGE_TYPES.find(t => t.type === imageType)?.label} generated!`);
        } else if (job.status === "failed") {
          clearInterval(interval);
          delete pollingRef.current[jobId];
          toast.error(`Generation failed: ${job.error ?? "Unknown error"}`);
        }
      } catch {
        clearInterval(interval);
        delete pollingRef.current[jobId];
      }
    }, 3000);
    pollingRef.current[jobId] = interval;
  };

  const handleGenerate = async (imageType: ImageType) => {
    // Start task if first generation
    if (task?.status === "assigned") {
      try { await tasksApi.start(taskId); } catch { /* ignore */ }
    }

    try {
      const res = await generationApi.enqueue(taskId, imageType);
      setJobs((prev) => ({
        ...prev,
        [imageType]: { id: res.job_id, task_id: taskId, image_type: imageType, status: "pending", result_url: null, error: null, created_at: "" },
      }));
      startPolling(res.job_id, imageType);
      toast.info(`Generating ${IMAGE_TYPES.find(t => t.type === imageType)?.label}…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    }
  };

  const handleDelete = async (gen: GeneratedImage) => {
    try {
      await generationApi.delete(gen.id);
      setGenerations((prev) => prev.filter((g) => g.id !== gen.id));
      toast.success("Image deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleMarkFinal = async (gen: GeneratedImage) => {
    try {
      await generationApi.markFinal(gen.id);
      setGenerations((prev) => prev.map((g) => g.id === gen.id ? { ...g, is_final: true } : g));
      toast.success("Marked as final");
    } catch {
      toast.error("Could not mark as final");
    }
  };

  const handleSubmit = async () => {
    if (generations.length < 8) {
      toast.warning(`You need all 8 images. Currently: ${generations.length}/8`);
      return;
    }
    try {
      await tasksApi.submit(taskId);
      toast.success("Task submitted! Admin has been notified.");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed");
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

  if (!task) return <div className="container" style={{ padding: "2rem" }}>Task not found.</div>;

  const getGeneration = (type: string) => generations.find((g) => g.image_type === type);
  const getJob = (type: string) => jobs[type];

  // Group image types
  const groups = ["Background", "Theme", "Creative", "Model"];

  return (
    <div className="container animate-fade-in" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
      <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", color: "var(--muted-foreground)" }}>
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{task.title}</h1>
          <p style={{ color: "var(--muted-foreground)" }}>{task.description}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--primary)", fontFamily: "var(--font-outfit)", lineHeight: 1 }}>
            {generations.length}<span style={{ fontSize: "1.25rem", color: "var(--muted-foreground)" }}>/8</span>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted-foreground)" }}>images generated</div>
          {/* Progress bar */}
          <div style={{ marginTop: "0.5rem", height: "4px", width: "120px", background: "var(--muted)", borderRadius: "9999px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(generations.length / 8) * 100}%`, background: "linear-gradient(to right, #8b5cf6, #3b82f6)", borderRadius: "9999px", transition: "width 0.4s" }} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "2rem" }}>
        {/* Left: Original Product */}
        <div style={{ position: "sticky", top: "90px", alignSelf: "start" }}>
          <div className="glass-panel" style={{ padding: "1.5rem" }}>
            <h3 style={{ fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted-foreground)", marginBottom: "1rem" }}>
              Original Product
            </h3>
            <div style={{ borderRadius: "0.75rem", overflow: "hidden", marginBottom: "1rem", border: "1px solid var(--border)" }}>
              <img src={task.product_image_url} alt="Original" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--muted-foreground)", lineHeight: 1.6, marginBottom: "1.5rem" }}>
              ⚠️ The product must appear <strong style={{ color: "var(--foreground)" }}>EXACTLY THE SAME</strong> in all 8 generated images. Only the background or model changes.
            </p>

            <button
              className="btn btn-primary"
              style={{ width: "100%", opacity: generations.length < 8 || task.status === "submitted" ? 0.5 : 1 }}
              onClick={handleSubmit}
              disabled={generations.length < 8 || task.status === "submitted"}
            >
              <Send size={16} />
              {task.status === "submitted" ? "Task Submitted ✓" : "Submit Task"}
            </button>
          </div>
        </div>

        {/* Right: Generation Grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {groups.map((group) => {
            const groupTypes = IMAGE_TYPES.filter((t) => t.group === group);
            return (
              <div key={group}>
                <h2 style={{ fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted-foreground)", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ flex: 1, height: "1px", background: "var(--border)" }} />
                  {group} Images
                  <span style={{ flex: 1, height: "1px", background: "var(--border)" }} />
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {groupTypes.map(({ type, label, desc }) => {
                    const gen = getGeneration(type);
                    const job = getJob(type);
                    const isGenerating = job?.status === "pending" || job?.status === "running";
                    const hasImage = !!gen?.image_url;

                    return (
                      <div
                        key={type}
                        className="glass-panel"
                        style={{
                          padding: "1.25rem",
                          display: "flex",
                          gap: "1.25rem",
                          alignItems: "center",
                          border: gen?.is_final ? "1px solid var(--primary)" : undefined,
                        }}
                      >
                        {/* Thumbnail */}
                        <div
                          style={{
                            width: "120px", height: "120px", borderRadius: "0.625rem",
                            background: "var(--muted)", flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            overflow: "hidden", position: "relative", border: "1px solid var(--border)",
                            cursor: hasImage ? "zoom-in" : "default",
                          }}
                          onClick={() => hasImage && gen && setLightbox(gen)}
                        >
                          {isGenerating ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", color: "var(--primary)" }}>
                              <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                              <span style={{ fontSize: "0.7rem", fontWeight: 500 }}>Generating…</span>
                            </div>
                          ) : hasImage ? (
                            <>
                              <img src={gen.image_url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              {gen.is_final && (
                                <div style={{ position: "absolute", top: "4px", right: "4px", background: "var(--primary)", borderRadius: "50%", padding: "2px" }}>
                                  <Check size={10} color="white" />
                                </div>
                              )}
                            </>
                          ) : (
                            <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", textAlign: "center", padding: "0.5rem" }}>
                              Not generated
                            </span>
                          )}
                        </div>

                        {/* Info + Controls */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.35rem" }}>
                            <h4 style={{ fontSize: "1rem", fontWeight: 600 }}>{label}</h4>
                            {gen?.is_final && (
                              <span className="badge badge-primary" style={{ fontSize: "0.7rem" }}>Final</span>
                            )}
                          </div>
                          <p style={{ fontSize: "0.8rem", color: "var(--muted-foreground)", marginBottom: "1rem" }}>{desc}</p>

                          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                            {!isGenerating && (
                              <button
                                className="btn btn-primary"
                                onClick={() => handleGenerate(type as ImageType)}
                                style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}
                              >
                                <RefreshCw size={13} />
                                {hasImage ? "Regenerate" : "Generate"}
                              </button>
                            )}
                            {hasImage && gen && (
                              <>
                                {!gen.is_final && (
                                  <button
                                    className="btn btn-outline"
                                    onClick={() => handleMarkFinal(gen)}
                                    style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}
                                  >
                                    <Check size={13} /> Mark Final
                                  </button>
                                )}
                                <a
                                  href={gen.image_url}
                                  download
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-outline"
                                  style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}
                                >
                                  <Download size={13} />
                                </a>
                                <button
                                  className="btn btn-outline"
                                  onClick={() => handleDelete(gen)}
                                  style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem", color: "#ef4444", borderColor: "#ef4444" }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}
          onClick={() => setLightbox(null)}
        >
          <button style={{ position: "absolute", top: "1rem", right: "1rem", background: "white", border: "none", borderRadius: "50%", padding: "0.5rem", cursor: "pointer" }}>
            <X size={20} />
          </button>
          <img
            src={lightbox.image_url}
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
