import {
  ArrowRight,
  BarChart3,
  Boxes,
  BrainCircuit,
  Building2,
  CheckCircle2,
  ClipboardList,
  Cpu,
  Factory,
  Gauge,
  LineChart,
  LockKeyhole,
  PackageCheck,
  PanelTop,
  PieChart,
  ReceiptText,
  Route,
  Smartphone,
  Sparkles,
  Target,
  Truck,
  Users,
  WalletCards,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/sections/Footer";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { useReveal } from "@/hooks/use-reveal";

const modules = [
  {
    icon: Users,
    title: "CRM",
    benefit: "Satış sürecini görünür yapar.",
    detail: "Fırsatlar, görüşmeler ve teklif aşamaları tek ekranda ilerler.",
    impact: "Takip kaybı azalır. Kapanma ihtimali yükselir.",
  },
  {
    icon: Gauge,
    title: "ERP",
    benefit: "Operasyonu merkezi sisteme bağlar.",
    detail: "Sipariş, üretim, satın alma ve teslimat akışları birlikte çalışır.",
    impact: "Ekipler aynı veriyle hareket eder.",
  },
  {
    icon: WalletCards,
    title: "Finans",
    benefit: "Nakit akışını kontrol altına alır.",
    detail: "Gelir, gider, tahsilat ve borç durumları anlık izlenir.",
    impact: "Finans görünür olur. Sürprizler azalır.",
  },
  {
    icon: Boxes,
    title: "Stok",
    benefit: "Stok hareketlerini netleştirir.",
    detail: "Depo, ürün, kritik seviye ve sevkiyat bilgileri canlı kalır.",
    impact: "Eksik stok ve fazla alım riski düşer.",
  },
  {
    icon: Building2,
    title: "Personel",
    benefit: "Ekip performansını ölçülebilir yapar.",
    detail: "Rol, yetki, iş yükü ve operasyon sorumlulukları tanımlanır.",
    impact: "Kim ne yapıyor sorusu ortadan kalkar.",
  },
  {
    icon: ClipboardList,
    title: "Görev",
    benefit: "İş akışını takip edilebilir kılar.",
    detail: "Görevler, terminler, öncelikler ve onaylar sistemde tutulur.",
    impact: "İşler kişilerde değil sistemde kalır.",
  },
  {
    icon: ReceiptText,
    title: "Teklif",
    benefit: "Tekliften satışa geçişi hızlandırır.",
    detail: "Teklifler kayıt altına alınır, revize edilir ve CRM ile bağlanır.",
    impact: "Satış hafızası oluşur.",
  },
  {
    icon: PieChart,
    title: "Raporlama",
    benefit: "Karar için net veri üretir.",
    detail: "Satış, finans, stok ve ekip göstergeleri yönetim paneline akar.",
    impact: "Tahmin değil, veriyle yönetim başlar.",
  },
  {
    icon: Smartphone,
    title: "Mobil",
    benefit: "Sahadan merkeze canlı bağlantı kurar.",
    detail: "Ekipler müşteri, görev ve stok bilgilerine her yerden erişir.",
    impact: "Ofis dışı operasyon da kontrol altında kalır.",
  },
  {
    icon: Cpu,
    title: "Custom",
    benefit: "İşletmeye özel modül kurar.",
    detail: "Mevcut sürece uymayan alanlar özel akışlarla ürüne eklenir.",
    impact: "Sistem işletmeye göre büyür.",
  },
];

const pains = [
  "Excel dosyaları çoğalır. Hangisi güncel belli olmaz.",
  "Satış başka yerde, stok başka yerde, finans başka yerde yaşar.",
  "Veri kaybolur. Karar gecikir. Takip kişilere bağlı kalır.",
  "Finans görünmez hale gelir. Nakit akışı sonradan fark edilir.",
  "Stok kontrolsüz ilerler. Eksik ürün işi durdurur.",
  "Ekipler aynı işi farklı bilgilerle yönetir.",
];

const aiCapabilities = [
  "Satış tahmini",
  "Finansal öngörü",
  "Risk tespiti",
  "Müşteri analizi",
  "Otomasyon önerileri",
];

const industries = [
  { icon: Factory, title: "Fabrika", copy: "Üretim, sipariş, stok ve satın alma aynı sistemde ilerler." },
  { icon: PackageCheck, title: "Depo", copy: "Giriş, çıkış, kritik seviye ve sevkiyat canlı takip edilir." },
  { icon: Truck, title: "Lojistik", copy: "Saha, rota, teslimat ve müşteri bilgisi merkezde birleşir." },
  { icon: PanelTop, title: "Ofis", copy: "Satış, finans, görev ve raporlama tek panelden yönetilir." },
  { icon: Route, title: "Saha Ekipleri", copy: "Mobil kullanım ile bilgi ofise beklemeden ulaşır." },
];

const steps = ["Analiz", "Modül seçimi", "Kurulum", "Kullanım", "Büyüme"];

const DashboardVisual = () => (
  <div className="relative mx-auto w-full max-w-xl">
    <div className="absolute -inset-6 bg-electric/20 blur-3xl" aria-hidden />
    <div className="relative rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4 shadow-elevated backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-white/45">Eclipse Control</div>
          <div className="mt-1 text-lg font-semibold text-white">Yönetim Paneli</div>
        </div>
        <div className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">
          Canlı veri
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {["Gelir", "Fırsat", "Stok"].map((label, index) => (
          <div key={label} className="rounded-xl border border-white/10 bg-navy-deep/60 p-3">
            <div className="text-xs text-white/45">{label}</div>
            <div className="mt-2 text-xl font-semibold text-white">{["₺2.4M", "38", "94%"][index]}</div>
            <div className="mt-2 h-1.5 rounded-full bg-white/10">
              <div className="h-1.5 rounded-full bg-electric-bright" style={{ width: `${[76, 58, 84][index]}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-white/10 bg-navy-deep/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">CRM Pipeline</span>
            <LineChart className="h-4 w-4 text-electric-bright" />
          </div>
          <div className="mt-5 flex h-28 items-end gap-2">
            {[35, 54, 42, 76, 64, 88, 72].map((height, i) => (
              <div key={i} className="flex-1 rounded-t-lg bg-gradient-to-t from-electric to-electric-bright" style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {["Teklif onayı", "Tahsilat riski", "Kritik stok"].map((item) => (
            <div key={item} className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
              <div className="flex items-center gap-2 text-sm text-white">
                <CheckCircle2 className="h-4 w-4 text-electric-bright" />
                {item}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const Index = () => {
  const ref = useReveal();

  return (
    <div ref={ref} className="min-h-screen bg-navy-deep text-white">
      <Header />
      <main>
        <section id="top" className="relative isolate overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
          <div className="absolute inset-0 bg-gradient-hero" aria-hidden />
          <div className="absolute inset-0 grid-pattern opacity-25" aria-hidden />
          <div className="absolute left-1/2 top-24 h-80 w-80 -translate-x-1/2 rounded-full bg-electric/20 blur-[110px]" aria-hidden />
          <div className="container-page relative grid items-center gap-14 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/80 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-electric-bright" />
                ERP + CRM + Yapay Zeka Platformu
              </span>
              <h1 className="mt-7 max-w-3xl font-display text-5xl font-semibold leading-[1.02] text-white md:text-6xl">
                İşletmeni Tek Sistemden Yönet
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/72">
                Eclipse; ERP, CRM ve Yapay Zeka modüllerini tek panelde birleştirir. Operasyonu, veriyi ve kararları kontrol altına alırsın.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button size="xl" variant="hero" asChild>
                  <a href="#contact">Demo Talep Et <ArrowRight className="ml-1 h-4 w-4" /></a>
                </Button>
                <Button size="xl" variant="outline-light" asChild>
                  <a href="#modules">Modülleri İncele</a>
                </Button>
              </div>
              <p className="mt-4 text-sm text-white/55">İlk görüşmede ihtiyaç analizi yapılır. Zorunlu paket yok. İşletmene göre kurulur.</p>
            </div>
            <DashboardVisual />
          </div>
        </section>

        <section id="solutions" className="bg-[#071827] py-20 md:py-28">
          <div className="container-page">
            <div className="max-w-3xl">
              <span className="eyebrow">Gerçek Problem</span>
              <h2 className="mt-4 text-3xl font-semibold md:text-5xl">Dağınık sistem işletmeyi yavaşlatır.</h2>
              <p className="mt-5 text-lg text-white/62">Eclipse, karmaşayı tek merkezde toplar. Her şey görünür olur.</p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pains.map((pain) => (
                <div key={pain} className="reveal rounded-xl border border-white/10 bg-white/[0.04] p-5 text-white/78 transition hover:border-electric-bright/40 hover:bg-white/[0.07]">
                  {pain}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-navy-deep py-20 md:py-28">
          <div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <span className="eyebrow">Ana Fikir</span>
              <h2 className="mt-4 text-3xl font-semibold md:text-5xl">Tüm sistemler. Tek platform.</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {["Tek panel", "Tek veri", "Merkezi yönetim"].map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-white/[0.05] p-6">
                  <LockKeyhole className="h-5 w-5 text-electric-bright" />
                  <div className="mt-4 text-lg font-semibold">{item}</div>
                  <p className="mt-2 text-sm text-white/58">Kontrol sende kalır. Sistem sana söyler.</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="modules" className="bg-[#071827] py-20 md:py-28">
          <div className="container-page">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <span className="eyebrow">Modüler Sistem</span>
                <h2 className="mt-4 text-3xl font-semibold md:text-5xl">Satın alma. Sistemini kur.</h2>
              </div>
              <Button variant="hero" size="lg" asChild>
                <a href="#contact">Sistemini Kur</a>
              </Button>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {modules.map((module) => {
                const Icon = module.icon;
                return (
                  <article key={module.title} className="group reveal rounded-xl border border-white/10 bg-white/[0.04] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-electric-bright/50 hover:bg-white/[0.075] hover:shadow-glow">
                    <Icon className="h-6 w-6 text-electric-bright" />
                    <h3 className="mt-5 text-xl font-semibold">{module.title}</h3>
                    <p className="mt-2 text-sm text-white/64">{module.benefit}</p>
                    <div className="mt-4 max-h-0 overflow-hidden text-sm text-white/58 transition-all duration-300 group-hover:max-h-32">
                      <p>{module.detail}</p>
                      <p className="mt-2 text-electric-bright">{module.impact}</p>
                    </div>
                    <a href="#contact" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-electric-bright">
                      İncele <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </a>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="ai" className="bg-navy-deep py-20 md:py-28">
          <div className="container-page grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="eyebrow">Yapay Zeka</span>
              <h2 className="mt-4 text-3xl font-semibold md:text-5xl">Hype değil. Karar motoru.</h2>
              <p className="mt-5 text-lg text-white/64">Eclipse AI veriyi izler, riski fark eder, fırsatı öne çıkarır. Sistem sadece kayıt tutmaz. Yön gösterir.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {aiCapabilities.map((item) => (
                  <div key={item} className="rounded-xl border border-white/10 bg-white/[0.05] p-4 text-sm text-white/78">
                    <BrainCircuit className="mb-3 h-5 w-5 text-electric-bright" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-electric-bright/20 bg-gradient-to-br from-white/[0.09] to-electric/10 p-8 shadow-glow">
              <div className="text-sm uppercase tracking-[0.18em] text-electric-bright">Custom AI</div>
              <h3 className="mt-4 text-3xl font-semibold">Şirket verinle eğitilen yapay zeka.</h3>
              <div className="mt-7 space-y-4">
                {["Hangi müşteri riskte?", "Hangi teklif kapanır?", "Nerede zarar var?", "Hangi ürün daha karlı?"].map((question) => (
                  <div key={question} className="rounded-xl border border-white/10 bg-navy-deep/55 p-4 text-white/80">
                    {question}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="industries" className="bg-[#071827] py-20 md:py-28">
          <div className="container-page">
            <div className="max-w-2xl">
              <span className="eyebrow">Sektörler</span>
              <h2 className="mt-4 text-3xl font-semibold md:text-5xl">Her işletmeye uyarlanır.</h2>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
              {industries.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                    <Icon className="h-6 w-6 text-electric-bright" />
                    <h3 className="mt-5 font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm text-white/58">{item.copy}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="process" className="bg-navy-deep py-20 md:py-28">
          <div className="container-page">
            <span className="eyebrow">Süreç</span>
            <h2 className="mt-4 text-3xl font-semibold md:text-5xl">Hızlı kurulur. Büyüdükçe genişler.</h2>
            <div className="mt-12 grid gap-4 md:grid-cols-5">
              {steps.map((step, index) => (
                <div key={step} className="rounded-xl border border-white/10 bg-white/[0.05] p-5">
                  <div className="text-sm text-electric-bright">0{index + 1}</div>
                  <div className="mt-4 text-lg font-semibold">{step}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#071827] py-20 md:py-28">
          <div className="container-page grid gap-12 lg:grid-cols-2 lg:items-center">
            <DashboardVisual />
            <div>
              <span className="eyebrow">Canlı Kontrol</span>
              <h2 className="mt-4 text-3xl font-semibold md:text-5xl">Grafikler, görevler, finans ve CRM tek ekranda.</h2>
              <p className="mt-5 text-lg text-white/64">Gerçek zamanlı yönetim paneli ile satış, görev, stok ve finans hareketlerini aynı yerden izlersin.</p>
              <div className="mt-8 flex flex-wrap gap-3 text-sm text-white/72">
                {["Anlık veri", "Rol bazlı erişim", "Mobil uyum", "Yönetim raporları"].map((item) => (
                  <span key={item} className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2">{item}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-navy-deep py-20 md:py-28">
          <div className="container-page grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
            <div>
              <span className="eyebrow">Neden Eclipse</span>
              <h2 className="mt-4 text-3xl font-semibold md:text-5xl">Kontrol, netlik ve karar gücü.</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                "Modüler yapı",
                "AI destekli karar motoru",
                "Hızlı devreye alma",
                "Özelleştirilebilir akışlar",
                "Ölçeklenebilir mimari",
                "Tek panel işletme yönetimi",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] p-4">
                  <Target className="h-5 w-5 text-electric-bright" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="relative overflow-hidden bg-gradient-hero py-20 md:py-28">
          <div className="absolute inset-0 grid-pattern opacity-25" aria-hidden />
          <div className="container-page relative text-center">
            <span className="eyebrow justify-center">Demo</span>
            <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold md:text-6xl">İşletme kontrolünü tek sisteme taşı.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-white/68">Kısa bir analiz görüşmesiyle hangi modüllerin işletmene değer üreteceğini netleştirelim.</p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button size="xl" variant="hero" asChild>
                <a href="mailto:info@eclipsemuhendislik.com">Kontrolü Ele Al <ArrowRight className="ml-1 h-4 w-4" /></a>
              </Button>
              <Button size="xl" variant="outline-light" asChild>
                <a href="https://erp.eclipsemuhendislik.com/giris">ERP Girişi</a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-white/55">Demo talebi sonrası net ihtiyaç haritası çıkarılır. Gereksiz modül önerilmez.</p>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
};

export default Index;
