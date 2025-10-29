# 📝 Task Manager – Offline-First Task Management API

This project is a **full-stack, offline-first Task Management system** built as part of the **PearlThoughts Backend Interview Challenge**.  
It demonstrates how to handle **task creation, updates, and deletions** even while **offline**, and automatically synchronizes data with the server once connectivity is restored.

---

## 🚀 Features

- ✅ Create, edit, and delete tasks locally (offline mode supported)
- 🔄 Automatic synchronization with the server when online
- ⚙️ Sync conflict handling using timestamps (`updated_at`)
- 💾 Local persistence using browser storage
- 🧱 Built with Node.js, Express, and SQLite
- 🧑‍💻 Clean code structure with modular service design

---

## 🧠 Core Idea: Offline-First Sync

The **offline-first approach** ensures users can work seamlessly even without an internet connection.  
All changes (create, update, delete) are saved locally and later synced to the server.

### 🔍 How It Works

1. **When offline:**
   - Tasks are stored locally using `localStorage` or IndexedDB.
   - Each task has a `sync_status` = `'pending'`.

2. **When online:**
   - The app automatically checks all pending tasks.
   - For each task:
     - If `is_deleted = true` → delete on the server.
     - If `server_id` exists → update task on the server.
     - Else → create a new task on the server and update `server_id`.
   - Once synced, `sync_status` becomes `'synced'`.

### 🧩 Example Sync Function (from frontend)
```ts
const syncTasks = async () => {
  if (!user || !isOnline) return;

  const localTasks = loadLocalTasks();
  const pendingTasks = localTasks.filter(t => t.sync_status === 'pending');

  if (pendingTasks.length === 0) return;

  for (const task of pendingTasks) {
    try {
      if (task.is_deleted) {
        await supabase.from('tasks').update({ is_deleted: true }).eq('id', task.server_id);
      } else if (task.server_id) {
        await supabase.from('tasks').update(task).eq('id', task.server_id);
      } else {
        const { data } = await supabase.from('tasks').insert({
          title: task.title,
          description: task.description,
          completed: task.completed,
          user_id: user.id,
        }).select().single();

        if (data) task.server_id = data.id;
      }

      task.sync_status = 'synced';
      task.last_synced_at = new Date().toISOString();
    } catch (err) {
      task.sync_status = 'error';
      console.error(`Sync failed for task ${task.id}`, err);
    }
  }

  saveLocalTasks(localTasks);
};
