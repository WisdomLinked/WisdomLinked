import { useState, useEffect, useCallback } from "react";
import { userManagementApi, UserStats } from "@/api/adminApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Search, UserCheck, UserX, Key, Link as LinkIcon, Users, Shield } from "lucide-react";

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  authMethods: string[];
  lastLogin?: string;
  createdAt: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await userManagementApi.searchUsers({
        search,
        role: roleFilter || undefined,
        isActive: statusFilter ? statusFilter === "active" : undefined,
        page: pagination.page,
        limit: pagination.limit,
      });
      setUsers(response.users);
      setPagination(response.pagination);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, pagination.page, pagination.limit]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await userManagementApi.getUserStats();
      setStats(response);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [fetchUsers, fetchStats]);

  const handleToggleStatus = async (userId: string) => {
    try {
      await userManagementApi.toggleUserStatus(userId);
      fetchUsers();
      if (window.toast) {
        window.toast({
          title: "Success",
          description: "User status updated",
        });
      }
    } catch (error) {
      console.error("Failed to toggle status:", error);
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!newPassword || newPassword.length < 6) {
      if (window.toast) {
        window.toast({
          title: "Error",
          description: "Password must be at least 6 characters",
          variant: "destructive",
        });
      }
      return;
    }

    try {
      await userManagementApi.resetUserPassword(userId, newPassword);
      setResetPasswordUserId(null);
      setNewPassword("");
      if (window.toast) {
        window.toast({
          title: "Success",
          description: "Password reset successfully",
        });
      }
    } catch (error) {
      console.error("Failed to reset password:", error);
    }
  };

  const handleGenerateResetLink = async (userId: string) => {
    try {
      const response = await userManagementApi.generateResetLink(userId);
      if (window.toast) {
        window.toast({
          title: "Reset Link Generated",
          description: `Link: ${response.resetLink}`,
        });
      }
    } catch (error) {
      console.error("Failed to generate reset link:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground mt-1">Manage user accounts and permissions</p>
      </div>

      {stats && (
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Active
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <UserX className="h-4 w-4" />
                Inactive
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inactive}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Admins
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.admins}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Users ({pagination.total})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{user.username}</h3>
                        {user.role === "admin" && (
                          <span className="px-2 py-0.5 text-xs rounded bg-primary/10 text-primary">
                            Admin
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 text-xs rounded ${
                            user.isActive
                              ? "bg-green-500/10 text-green-500"
                              : "bg-red-500/10 text-red-500"
                          }`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-2">
                        <span>Auth: {user.authMethods.join(", ")}</span>
                        {user.lastLogin && (
                          <span>Last login: {new Date(user.lastLogin).toLocaleDateString()}</span>
                        )}
                        <span>Joined: {new Date(user.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleStatus(user.id)}
                      >
                        {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </Button>
                      {user.authMethods.includes("local") && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setResetPasswordUserId(user.id)}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGenerateResetLink(user.id)}
                          >
                            <LinkIcon className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {resetPasswordUserId === user.id && (
                    <div className="mt-4 p-3 border rounded bg-muted/50">
                      <p className="text-sm font-medium mb-2">Reset Password</p>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          placeholder="New password (min 6 chars)"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <Button onClick={() => handleResetPassword(user.id)}>Reset</Button>
                        <Button variant="outline" onClick={() => setResetPasswordUserId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {users.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">No users found</div>
              )}
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  disabled={pagination.page === 1}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                >
                  Previous
                </Button>
                <span className="px-4 py-2">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

