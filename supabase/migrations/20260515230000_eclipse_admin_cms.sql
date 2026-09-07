create type public.app_role as enum ('admin', 'user');
create type public.content_status as enum ('published', 'draft');
create type public.message_status as enum ('new', 'read');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_count int;
begin
  insert into public.profiles (user_id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));

  select count(*) into user_count from auth.users;

  if user_count = 1 then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'user');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table public.services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  short_description text not null,
  detail_description text,
  icon_name text,
  image_url text,
  sort_order int not null default 0,
  status public.content_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  location text,
  project_year text,
  short_description text not null,
  detail_description text,
  cover_image_url text,
  gallery_images text[],
  sort_order int not null default 0,
  status public.content_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  subject text,
  message text not null,
  status public.message_status not null default 'new',
  created_at timestamptz not null default now()
);

create table public.site_settings (
  id uuid primary key default gen_random_uuid(),
  company_name text not null default 'Eclipse Mühendislik',
  phone text not null default '+90 (536) 262 90 65',
  whatsapp text not null default '+90 (536) 262 90 65',
  email text not null default 'info@eclipsemuhendislik.com',
  address text not null default 'Molla Gürani Mahallesi, Kaçamak Sokak No:8, 34093 Fatih / İstanbul, Türkiye',
  map_url text,
  map_embed_url text,
  linkedin_url text,
  instagram_url text,
  seo_title text not null default 'Eclipse Mühendislik | BT Danışmanlığı ve Yönetilen BT Hizmetleri',
  seo_description text not null default 'Eclipse Mühendislik; ağ altyapısı, siber güvenlik, bulut, Microsoft 365 ve yönetilen BT hizmetleriyle işletmelere güvenilir teknoloji operasyonları sunar.',
  footer_description text not null default 'Eclipse Mühendislik, İstanbul merkezli, mühendislik odaklı bir BT danışmanlık ve yönetilen hizmetler şirketidir.',
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.services enable row level security;
alter table public.projects enable row level security;
alter table public.contact_messages enable row level security;
alter table public.site_settings enable row level security;

create trigger services_updated_at before update on public.services for each row execute function public.update_updated_at_column();
create trigger projects_updated_at before update on public.projects for each row execute function public.update_updated_at_column();
create trigger site_settings_updated_at before update on public.site_settings for each row execute function public.update_updated_at_column();

create policy "Users view own profile" on public.profiles for select using (auth.uid() = user_id);
create policy "Admins view all profiles" on public.profiles for select using (public.has_role(auth.uid(), 'admin'));

create policy "Users view own roles" on public.user_roles for select using (auth.uid() = user_id);
create policy "Admins view all roles" on public.user_roles for select using (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage roles" on public.user_roles for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create policy "Anyone reads published services" on public.services for select using (status = 'published');
create policy "Admins view all services" on public.services for select using (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage services" on public.services for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create policy "Anyone reads published projects" on public.projects for select using (status = 'published');
create policy "Admins view all projects" on public.projects for select using (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage projects" on public.projects for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create policy "Anyone submits messages" on public.contact_messages for insert with check (true);
create policy "Admins view messages" on public.contact_messages for select using (public.has_role(auth.uid(), 'admin'));
create policy "Admins update messages" on public.contact_messages for update using (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete messages" on public.contact_messages for delete using (public.has_role(auth.uid(), 'admin'));

create policy "Anyone reads site settings" on public.site_settings for select using (true);
create policy "Admins update site settings" on public.site_settings for update using (public.has_role(auth.uid(), 'admin'));
create policy "Admins insert site settings" on public.site_settings for insert with check (public.has_role(auth.uid(), 'admin'));

insert into public.site_settings (map_url, map_embed_url)
values (
  'https://www.google.com/maps/search/?api=1&query=Molla+G%C3%BCrani+Mahallesi+Ka%C3%A7amak+Sokak+No%3A8+34093+Fatih+%C4%B0stanbul+T%C3%BCrkiye',
  'https://www.google.com/maps?q=Molla+G%C3%BCrani+Mahallesi+Ka%C3%A7amak+Sokak+No%3A8+34093+Fatih+%C4%B0stanbul&output=embed'
);

insert into public.services (title, short_description, detail_description, sort_order, status) values
('Ağ Altyapısı', 'Performans ve süreklilik için tasarlanmış switch, firewall, yapısal kablolama ve kablosuz ağ çözümleri.', 'Kurumsal ağ topolojisi, VLAN, firewall, Wi-Fi kapsama ve saha kurulumlarını uçtan uca yönetiriz.', 1, 'published'),
('Siber Güvenlik', 'Uç nokta koruması, MFA, firewall, yedekleme ve politika sıkılaştırması.', 'İş sürekliliğini koruyan pratik güvenlik mimarileri, yedekleme ve erişim politikaları tasarlarız.', 2, 'published'),
('Bulut ve Sunucu', 'Sanallaştırma, hibrit bulut ve Windows Server mimarileri.', 'Sunucu, sanallaştırma, Microsoft 365 ve Azure iş yüklerini güvenilir şekilde kurar ve yönetiriz.', 3, 'published'),
('BT Destek Hizmetleri', 'Kullanıcı verimliliğini koruyan yardım masası ve önleyici bakım.', 'Uzaktan ve yerinde destek süreçlerini kayıtlı, ölçülebilir ve sürdürülebilir şekilde işletiriz.', 4, 'published');

insert into public.projects (title, category, location, project_year, short_description, detail_description, sort_order, status) values
('Kurumsal Ofis Ağ Kurulumu', 'Kurumsal Ofis', 'İstanbul', '2026', 'Çok katlı ofis için segmentli, güvenilir ve yönetilebilir ağ altyapısı kuruldu.', 'Yapısal kablolama, VLAN tasarımı ve kurumsal Wi-Fi kapsamı birlikte ele alındı.', 1, 'published'),
('Üretim Tesisi BT Altyapısı', 'Üretim', 'Türkiye', '2026', 'Üretim ortamında kesinti riskini azaltan standart ağ ve uç nokta operasyonu oluşturuldu.', 'Ağ yenileme, cihaz standardizasyonu ve yönetilen destek modeli devreye alındı.', 2, 'published'),
('Çoklu Lokasyon CCTV Sistemi', 'Güvenlik Sistemleri', 'Türkiye', '2026', 'Şubeler için merkezi kayıt ve güvenli uzaktan izleme altyapısı hazırlandı.', 'IP kamera kurulumu, NVR merkezi ve güvenli erişim adımları tamamlandı.', 3, 'published');
