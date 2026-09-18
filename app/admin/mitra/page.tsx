import { MitraLoginView } from "@/components/auth/mitra-login-view";

export const metadata = {
  title: "Portal Mitra • AyoTKA",
  description: "Portal masuk resmi untuk Mitra dan Reseller AyoTKA.",
};

export default function AdminMitraPage() {
  return <MitraLoginView />;
}
