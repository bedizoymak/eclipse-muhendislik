import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, FolderKanban, Inbox, Plus, ServerCog, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { defaultProjects, defaultServices } from "@/lib/eclipseContent";
import { AdminMetricCard, AdminPageHeader, AdminSection } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";

type Counts = {
  services: number;
  projects: number;
  messages: number;
  published: number;
};

export default function AdminDashboard() {
  const [counts, setCounts] = useState<Counts>({
    services: defaultServices.length,
    projects: defaultProjects.length,
    messages: 0,
    published: defaultServices.length + defaultProjects.length,
  });

  useEffect(() => {
    if (!supabase) return;
    async function load() {
      const [services, projects, messages] = await Promise.all([
        supabase.from("services").select("id,status"),
        supabase.from("projects").select("id,status"),
        supabase.from("contact_messages").select("id,status"),
      ]);

      const serviceRows = services.data ?? [];
      const projectRows = projects.data ?? [];
      const messageRows = messages.data ?? [];
      setCounts({
        services: serviceRows.length,
        projects: projectRows.length,
        messages: messageRows.length,
        published: serviceRows.filter((item) => item.status === "published").length + projectRows.filter((item) => item.status === "published").length,
      });
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Genel Bakış"
        title="Yönetim Paneli"
        description="Eclipse Mühendislik web sitesindeki hizmetleri, referansları, mesajları ve temel site bilgilerini tek merkezden yönetin."
        actions={
          <Button asChild variant="outline">
            <Link to="/">Siteye Git</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Toplam Hizmet" value={counts.services} description="Yönetilebilir hizmet kaydı" icon={ServerCog} />
        <AdminMetricCard label="Toplam Proje / Referans" value={counts.projects} description="Yayınlanabilir referans kaydı" icon={FolderKanban} />
        <AdminMetricCard label="Gelen Mesajlar" value={counts.messages} description="İletişim formu kayıtları" icon={Inbox} />
        <AdminMetricCard label="Yayındaki İçerikler" value={counts.published} description="Public sitede görünür kayıtlar" icon={Eye} />
      </div>

      <AdminSection title="Hızlı İşlemler" description="Sık kullanılan yönetim adımlarına hızlı erişim.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Button asChild className="justify-start bg-gradient-electric text-white shadow-glow">
            <Link to="/admin/services">
              <Plus className="h-4 w-4" />
              Yeni Hizmet Ekle
            </Link>
          </Button>
          <Button asChild className="justify-start bg-primary text-primary-foreground hover:bg-navy-soft">
            <Link to="/admin/projects">
              <Plus className="h-4 w-4" />
              Yeni Proje Ekle
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link to="/admin/messages">
              <Inbox className="h-4 w-4" />
              Mesajları Görüntüle
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link to="/admin/settings">
              <Settings className="h-4 w-4" />
              Site Ayarları
            </Link>
          </Button>
        </div>
      </AdminSection>
    </div>
  );
}
