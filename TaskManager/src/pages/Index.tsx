import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { Button } from "@/components/ui/button";
import { CreateTaskForm } from "@/components/CreateTaskForm";
import { TaskItem } from "@/components/TaskItem";
import { SyncStatus } from "@/components/SyncStatus";
import { LogOut, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const {
    tasks,
    loading: tasksLoading,
    isOnline,
    pendingSyncCount,
    lastSyncTime,
    createTask,
    updateTask,
    deleteTask,
    syncTasks,
  } = useTasks();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  if (authLoading || tasksLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              TaskSync
            </h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <SyncStatus
            isOnline={isOnline}
            pendingSyncCount={pendingSyncCount}
            lastSyncTime={lastSyncTime}
            onSync={syncTasks}
          />

          <CreateTaskForm onCreate={createTask} />

          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active">
                Active ({activeTasks.length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({completedTasks.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-3 mt-6">
              {activeTasks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-lg">No active tasks</p>
                  <p className="text-sm">Create your first task to get started!</p>
                </div>
              ) : (
                activeTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onUpdate={updateTask}
                    onDelete={deleteTask}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-3 mt-6">
              {completedTasks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-lg">No completed tasks</p>
                  <p className="text-sm">Complete some tasks to see them here!</p>
                </div>
              ) : (
                completedTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onUpdate={updateTask}
                    onDelete={deleteTask}
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Index;
