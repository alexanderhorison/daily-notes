import { BellRing, LogOut, Settings, UserRound, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/features/app/components/page-header";
import type { NotificationPermissionState } from "@/lib/task-notification-service";
import { cn } from "@/lib/utils";

type SettingsPageProps = {
  profileName: string;
  profileRole: string;
  onLogout: () => void;
  hasPendingReminders: boolean;
  notificationPermission: NotificationPermissionState;
  onRequestNotificationPermission: () => void;
  hasSupabaseEnv: boolean;
};

export function SettingsPage({
  profileName,
  profileRole,
  onLogout,
  hasPendingReminders,
  notificationPermission,
  onRequestNotificationPermission,
  hasSupabaseEnv,
}: SettingsPageProps): JSX.Element {
  return (
    <div className="px-4 pt-6 pb-[calc(11rem+env(safe-area-inset-bottom))]">
      <PageHeader title="Settings" description="Manage your account" Icon={Settings as LucideIcon} />

      <div className="grid gap-3">
        <Card className="border-gray-300 bg-white shadow-none">
          <CardContent className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
                <UserRound className="h-5 w-5 text-red-500" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-base font-semibold text-gray-900">{profileName}</p>
                <p className="text-sm text-gray-500">{profileRole}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {hasPendingReminders && notificationPermission !== "granted" ? (
          <Card
            className={cn(
              "border-gray-300 bg-white shadow-none",
              notificationPermission === "denied" && "border-red-200 bg-red-50",
            )}
          >
            <CardContent className="px-4 py-3">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg",
                    notificationPermission === "denied" ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600",
                  )}
                >
                  <BellRing className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-semibold", notificationPermission === "denied" ? "text-red-700" : "text-gray-900")}>
                    Notifications
                  </p>
                  <p className={cn("mt-1 text-sm", notificationPermission === "denied" ? "text-red-600" : "text-gray-500")}>
                    {notificationPermission === "denied"
                      ? "Notifications are blocked. Enable browser permission first."
                      : notificationPermission === "unsupported"
                        ? "This browser does not support notifications."
                        : "Enable notifications to alert every 10 minutes until reminder is marked done."}
                  </p>
                  {notificationPermission === "default" ? (
                    <Button
                      type="button"
                      size="sm"
                      className="mt-3 h-9 rounded-lg px-3"
                      onClick={onRequestNotificationPermission}
                    >
                      Enable notifications
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="fixed bottom-[calc(4.8rem+env(safe-area-inset-bottom))] left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 px-4 py-2">
        <Button
          type="button"
          onClick={onLogout}
          variant="destructive"
          className="h-11 w-full rounded-lg text-sm font-semibold"
        >
          <LogOut className="h-4 w-4" strokeWidth={2} />
          Logout
        </Button>
      </div>

      {!hasSupabaseEnv ? (
        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to enable data sync.
        </div>
      ) : null}
    </div>
  );
}
