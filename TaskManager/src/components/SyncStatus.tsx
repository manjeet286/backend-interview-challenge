import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Wifi, WifiOff, RefreshCw, Clock, CheckCircle2, AlertCircle } from "lucide-react";

interface SyncStatusProps {
  isOnline: boolean;
  pendingSyncCount: number;
  lastSyncTime: string | null;
  onSync: () => void;
}

export const SyncStatus = ({ isOnline, pendingSyncCount, lastSyncTime, onSync }: SyncStatusProps) => {
  return (
    <Card className="border-border/50">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isOnline ? 'bg-success/10' : 'bg-warning/10'}`}>
              {isOnline ? (
                <Wifi className="h-5 w-5 text-success" />
              ) : (
                <WifiOff className="h-5 w-5 text-warning" />
              )}
            </div>
            <div className="space-y-1">
              <p className="font-medium text-sm">
                {isOnline ? 'Online' : 'Offline Mode'}
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {pendingSyncCount > 0 ? (
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-warning" />
                    <span>{pendingSyncCount} pending</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-success" />
                    <span>All synced</span>
                  </div>
                )}
                {lastSyncTime && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Last sync {new Date(lastSyncTime).toLocaleTimeString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {isOnline && (
            <Button
              size="sm"
              variant={pendingSyncCount > 0 ? "default" : "outline"}
              onClick={onSync}
              disabled={!isOnline}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
