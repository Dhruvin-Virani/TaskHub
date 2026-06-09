/**
 * Backend API client.
 * Automatically attaches the Firebase ID token to every request.
 */
import { firebaseAuth } from "@/lib/firebase";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000";

async function getIdToken(): Promise<string | null> {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getIdToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error ?? "API request failed");
  }

  return response.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  callback: (id_token: string) =>
    apiFetch<{ user: AppUser }>("/api/auth/oauth/callback", {
      method: "POST",
      body: JSON.stringify({ id_token }),
    }),
  me: () => apiFetch<{ user: AppUser }>("/api/auth/me"),
  logout: () => apiFetch<{ message: string }>("/api/auth/logout", { method: "POST" }),
};

// ── Tasks ─────────────────────────────────────────────────────────────────────
export const tasksApi = {
  list: () => apiFetch<{ tasks: Task[] }>("/api/tasks"),
  myTasks: () => apiFetch<{ tasks: Task[] }>("/api/my-tasks"),
  get: (id: string) => apiFetch<{ task: Task }>(`/api/tasks/${id}`),
  create: (data: CreateTaskPayload) =>
    apiFetch<{ task: Task }>("/api/tasks", { method: "POST", body: JSON.stringify(data) }),
  upload: async (file: File) => {
    const token = await getIdToken();
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${BACKEND_URL}/api/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!response.ok) throw new Error("Upload failed");
    return response.json() as Promise<{ url: string }>;
  },
  assign: (taskId: string, userId: string) =>
    apiFetch<{ task: Task }>(`/api/tasks/${taskId}/assign`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    }),
  start: (taskId: string) =>
    apiFetch<{ task: Task }>(`/api/tasks/${taskId}/start`, { method: "PUT" }),
  submit: (taskId: string) =>
    apiFetch<{ task: Task }>(`/api/tasks/${taskId}/submit`, { method: "POST" }),
  accept: (taskId: string, feedback: string) =>
    apiFetch<{ task: Task }>(`/api/tasks/${taskId}/accept`, {
      method: "PUT",
      body: JSON.stringify({ feedback }),
    }),
  requestRevision: (taskId: string, revision_notes: string) =>
    apiFetch<{ task: Task }>(`/api/tasks/${taskId}/request-revision`, {
      method: "PUT",
      body: JSON.stringify({ revision_notes }),
    }),
  delete: (taskId: string) =>
    apiFetch<{ message: string }>(`/api/tasks/${taskId}`, { method: "DELETE" }),
};

// ── Generation ────────────────────────────────────────────────────────────────
export const generationApi = {
  enqueue: (taskId: string, image_type: string) =>
    apiFetch<{ job_id: string; status: string }>(`/api/tasks/${taskId}/generate`, {
      method: "POST",
      body: JSON.stringify({ image_type }),
    }),
  pollJob: (jobId: string) =>
    apiFetch<{ job: GenerationJob }>(`/api/jobs/${jobId}/status`),
  listGenerations: (taskId: string) =>
    apiFetch<{ images: GeneratedImage[] }>(`/api/tasks/${taskId}/generations`),
  delete: (generationId: string) =>
    apiFetch<{ message: string }>(`/api/generations/${generationId}`, { method: "DELETE" }),
  markFinal: (generationId: string) =>
    apiFetch<{ message: string }>(`/api/generations/${generationId}/mark-final`, { method: "PUT" }),
};

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminApi = {
  users: () => apiFetch<{ users: AppUser[] }>("/api/admin/users"),
  analytics: () => apiFetch<Analytics>("/api/admin/analytics"),
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AppUser {
  id: string;
  firebase_uid: string;
  email: string;
  display_name: string;
  avatar_url: string;
  role: "admin" | "user";
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  product_image_url: string;
  status: "pending" | "assigned" | "in_progress" | "submitted" | "accepted" | "revision_requested";
  created_by: string;
  assigned_to: string | null;
  created_at: string;
  generated_images?: GeneratedImage[];
}

export interface GeneratedImage {
  id: string;
  task_id: string;
  image_type: string;
  image_url: string;
  prompt_used: string;
  is_final: boolean;
  created_at: string;
}

export interface GenerationJob {
  id: string;
  task_id: string;
  image_type: string;
  status: "pending" | "running" | "completed" | "failed";
  result_url: string | null;
  error: string | null;
  created_at: string;
}

export interface CreateTaskPayload {
  title: string;
  description: string;
  product_image_url: string;
  assigned_to?: string | null;
}

export interface Analytics {
  total_tasks: number;
  total_users: number;
  total_images_generated: number;
  tasks_by_status: Record<string, number>;
  jobs_by_status: Record<string, number>;
}
