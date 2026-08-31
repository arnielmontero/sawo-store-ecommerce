import { AuthProvider } from "@/lib/auth-context";
import { StoreSettingsProvider } from "@/lib/store-settings-context";
import { AdminLayout } from "@/components/AdminLayout";

export default function AdminSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <StoreSettingsProvider>
        <AdminLayout>{children}</AdminLayout>
      </StoreSettingsProvider>
    </AuthProvider>
  );
}
