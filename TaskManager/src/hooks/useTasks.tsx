import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  server_id: string | null;
  last_synced_at: string | null;
}

interface LocalTask extends Omit<Task, 'user_id'> {
  sync_status: 'pending' | 'synced' | 'error';
}

const STORAGE_KEY = 'offline_tasks';
const LAST_SYNC_KEY = 'last_sync_timestamp';

export const useTasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(
    localStorage.getItem(LAST_SYNC_KEY)
  );

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load tasks from localStorage
  const loadLocalTasks = (): LocalTask[] => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  };

  // Save tasks to localStorage
  const saveLocalTasks = (localTasks: LocalTask[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localTasks));
    const pending = localTasks.filter(t => t.sync_status === 'pending' && !t.is_deleted);
    setPendingSyncCount(pending.length);
  };

  // Fetch tasks from server
  const fetchTasks = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTasks(data || []);
      
      // Update local storage with server data
      const localTasks: LocalTask[] = (data || []).map(task => ({
        ...task,
        sync_status: 'synced' as const,
      }));
      saveLocalTasks(localTasks);
      
      const now = new Date().toISOString();
      setLastSyncTime(now);
      localStorage.setItem(LAST_SYNC_KEY, now);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      // Load from localStorage if offline
      const localTasks = loadLocalTasks();
      setTasks(localTasks.filter(t => !t.is_deleted).map(t => ({
        ...t,
        user_id: user.id,
      })));
    } finally {
      setLoading(false);
    }
  };

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    fetchTasks();

    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          setTimeout(() => fetchTasks(), 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && user && pendingSyncCount > 0) {
      toast.info('Connection restored. Syncing tasks...');
      syncTasks();
    }
  }, [isOnline, user]);

  const createTask = async (title: string, description?: string) => {
    if (!user) return;

    const newTask: LocalTask = {
      id: crypto.randomUUID(),
      title,
      description: description || null,
      completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false,
      server_id: null,
      last_synced_at: null,
      sync_status: 'pending',
    };

    // Add to local state immediately
    const localTasks = loadLocalTasks();
    localTasks.push(newTask);
    saveLocalTasks(localTasks);
    
    setTasks(prev => [{...newTask, user_id: user.id}, ...prev]);

    if (isOnline) {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .insert({
            title,
            description,
            user_id: user.id,
          })
          .select()
          .single();

        if (error) throw error;

        // Update local task with server ID
        const updatedLocalTasks = localTasks.map(t =>
          t.id === newTask.id ? { ...t, server_id: data.id, sync_status: 'synced' as const, last_synced_at: new Date().toISOString() } : t
        );
        saveLocalTasks(updatedLocalTasks);
        
        toast.success('Task created');
      } catch (error) {
        console.error('Error creating task:', error);
        toast.error('Task saved offline. Will sync when online.');
      }
    } else {
      toast.info('Task saved offline. Will sync when online.');
    }
  };

  const updateTask = async (id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'completed'>>) => {
    if (!user) return;

    const localTasks = loadLocalTasks();
    const taskIndex = localTasks.findIndex(t => t.id === id || t.server_id === id);
    
    if (taskIndex === -1) return;

    const updatedTask = {
      ...localTasks[taskIndex],
      ...updates,
      updated_at: new Date().toISOString(),
      sync_status: 'pending' as const,
    };

    localTasks[taskIndex] = updatedTask;
    saveLocalTasks(localTasks);
    
    setTasks(prev => prev.map(t => 
      (t.id === id || t.server_id === id) ? { ...t, ...updates, updated_at: updatedTask.updated_at } : t
    ));

    if (isOnline) {
      try {
        const serverId = localTasks[taskIndex].server_id || id;
        const { error } = await supabase
          .from('tasks')
          .update(updates)
          .eq('id', serverId);

        if (error) throw error;

        localTasks[taskIndex] = {
          ...updatedTask,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
        };
        saveLocalTasks(localTasks);
        
        toast.success('Task updated');
      } catch (error) {
        console.error('Error updating task:', error);
        toast.error('Update saved offline. Will sync when online.');
      }
    } else {
      toast.info('Update saved offline. Will sync when online.');
    }
  };

  const deleteTask = async (id: string) => {
    if (!user) return;

    const localTasks = loadLocalTasks();
    const taskIndex = localTasks.findIndex(t => t.id === id || t.server_id === id);
    
    if (taskIndex === -1) return;

    localTasks[taskIndex] = {
      ...localTasks[taskIndex],
      is_deleted: true,
      updated_at: new Date().toISOString(),
      sync_status: 'pending' as const,
    };
    saveLocalTasks(localTasks);
    
    setTasks(prev => prev.filter(t => t.id !== id && t.server_id !== id));

    if (isOnline) {
      try {
        const serverId = localTasks[taskIndex].server_id || id;
        const { error } = await supabase
          .from('tasks')
          .update({ is_deleted: true })
          .eq('id', serverId);

        if (error) throw error;

        // Remove from local storage after successful sync
        const filtered = localTasks.filter((_, i) => i !== taskIndex);
        saveLocalTasks(filtered);
        
        toast.success('Task deleted');
      } catch (error) {
        console.error('Error deleting task:', error);
        toast.error('Deletion saved offline. Will sync when online.');
      }
    } else {
      toast.info('Deletion saved offline. Will sync when online.');
    }
  };

  const syncTasks = async () => {
    if (!user || !isOnline) return;

    const localTasks = loadLocalTasks();
    const pendingTasks = localTasks.filter(t => t.sync_status === 'pending');

    if (pendingTasks.length === 0) {
      toast.success('All tasks are synced');
      return;
    }

    let syncedCount = 0;
    let errorCount = 0;

    for (const task of pendingTasks) {
      try {
        if (task.is_deleted) {
          if (task.server_id) {
            await supabase
              .from('tasks')
              .update({ is_deleted: true })
              .eq('id', task.server_id);
          }
        } else if (task.server_id) {
          // Update existing
          await supabase
            .from('tasks')
            .update({
              title: task.title,
              description: task.description,
              completed: task.completed,
            })
            .eq('id', task.server_id);
        } else {
          // Create new
          const { data } = await supabase
            .from('tasks')
            .insert({
              title: task.title,
              description: task.description,
              completed: task.completed,
              user_id: user.id,
            })
            .select()
            .single();

          if (data) {
            const index = localTasks.findIndex(t => t.id === task.id);
            if (index !== -1) {
              localTasks[index].server_id = data.id;
            }
          }
        }

        const index = localTasks.findIndex(t => t.id === task.id);
        if (index !== -1) {
          localTasks[index].sync_status = 'synced';
          localTasks[index].last_synced_at = new Date().toISOString();
        }
        
        syncedCount++;
      } catch (error) {
        console.error(`Error syncing task ${task.id}:`, error);
        errorCount++;
        
        const index = localTasks.findIndex(t => t.id === task.id);
        if (index !== -1) {
          localTasks[index].sync_status = 'error';
        }
      }
    }

    saveLocalTasks(localTasks);
    await fetchTasks();

    if (syncedCount > 0) {
      toast.success(`Synced ${syncedCount} task${syncedCount !== 1 ? 's' : ''}`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} task${errorCount !== 1 ? 's' : ''} failed to sync`);
    }
  };

  return {
    tasks,
    loading,
    isOnline,
    pendingSyncCount,
    lastSyncTime,
    createTask,
    updateTask,
    deleteTask,
    syncTasks,
  };
};
