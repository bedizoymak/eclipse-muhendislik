import {
  BarChart3,
  BrainCircuit,
  BriefcaseBusiness,
  ClipboardList,
  Factory,
  Gauge,
  LineChart,
  PackageCheck,
  PanelsTopLeft,
  Route,
  Smartphone,
  Target,
  Truck,
  Users,
  WalletCards,
  Workflow,
} from "lucide-react";
import type { Lang } from "@/i18n/translations";

export type PageKey =
  | "home"
  | "solutions"
  | "modules"
  | "ai"
  | "dataAnalytics"
  | "digitalTransformation"
  | "industries"
  | "process"
  | "contact";

export const erpLoginUrl = "https://erp.eclipsemuhendislik.com/giris";

export const routes: Record<Lang, Record<PageKey, string>> = {
  tr: {
    home: "/",
    solutions: "/cozumler",
    modules: "/moduller",
    ai: "/ai-yapay-zeka",
    dataAnalytics: "/veri-analizi",
    digitalTransformation: "/dijital-donusum",
    industries: "/sektorler",
    process: "/surec",
    contact: "/iletisim",
  },
  en: {
    home: "/en",
    solutions: "/en/solutions",
    modules: "/en/modules",
    ai: "/en/ai",
    dataAnalytics: "/en/data-analytics",
    digitalTransformation: "/en/digital-transformation",
    industries: "/en/industries",
    process: "/en/process",
    contact: "/en/contact",
  },
};

export const navKeys: PageKey[] = ["solutions", "modules", "ai", "dataAnalytics", "digitalTransformation", "industries", "process", "contact"];

const trModules = [
  ["CRM ve Satış Yönetimi", "Satış fırsatlarını, müşteri temaslarını ve teklif süreçlerini merkezi bir CRM yapısında yönetir.", "Satış ekipleri müşteri geçmişi, teklif durumu ve takip aksiyonlarına tek panelden erişir.", "Tahmin doğruluğu, takip disiplini ve müşteri dönüşüm oranı güçlenir."],
  ["ERP Operasyon Yönetimi", "Operasyon, satın alma, üretim, teslimat ve servis süreçlerini bütünleşik ERP mimarisine taşır.", "Departmanlar aynı veri modeli üzerinde çalışır; operasyonel sorumluluklar netleşir.", "Süreç görünürlüğü artar, operasyonel gecikmeler azalır."],
  ["Finans ve Cari Yönetimi", "Tahsilat, ödeme, cari hesap, gider ve nakit akışı takibini yönetilebilir hale getirir.", "Finans ekipleri müşteri ve tedarikçi hareketlerini güncel veriyle analiz eder.", "Finansal riskler erken görünür hale gelir."],
  ["Stok ve Depo Yönetimi", "Depo, ürün, kritik stok, sevkiyat ve hareket kayıtlarını gerçek zamanlı takip eder.", "Depo ekipleri ürün giriş-çıkışlarını ve stok seviyelerini mobil veya web arayüzden yönetir.", "Stok maliyeti ve operasyonel belirsizlik azalır."],
  ["Personel ve Görev Yönetimi", "Kullanıcı rolleri, görev akışları, onay süreçleri ve iş yüklerini sistematik şekilde yönetir.", "Yöneticiler ekip performansını, sorumlulukları ve geciken işleri kontrol paneli üzerinden izler.", "İş takibi kişisel hafızadan kurumsal sisteme taşınır."],
  ["Teklif ve Sipariş Yönetimi", "Teklif hazırlama, revizyon, onay ve siparişe dönüşüm süreçlerini standardize eder.", "Satış ekibi teklif geçmişini CRM ile bağlantılı şekilde yönetir.", "Teklif kalitesi ve kapanış hızı artar."],
  ["Raporlama ve Yönetici Kontrol Panelleri", "Yönetim kararları için satış, finans, stok ve operasyon verilerini tek panelde birleştirir.", "Üst yönetim ölçülebilir performans göstergelerini, eğilimleri ve operasyonel sapmaları gerçek zamanlı takip eder.", "Karar süreçleri ölçülebilir veriyle desteklenir."],
  ["Veri Analizi Modülleri", "Dağınık işletme verilerini karşılaştırılabilir ve aksiyona dönüştürülebilir analiz katmanına taşır.", "Finans, satış ve operasyon verileri segment, dönem ve performans kırılımlarında analiz edilir.", "Veri Analizi, yönetim disiplininin temel bileşeni haline gelir."],
  ["AI-Yapay Zeka Destekli Karar Sistemleri", "AI-Yapay Zeka modelleriyle risk, tahmin ve öneri mekanizmaları oluşturur.", "Sistem kapanma ihtimali yüksek teklifleri, riskli müşterileri ve finansal sapmaları işaretler.", "Karar destek kapasitesi kurumsal ölçekte güçlenir."],
  ["Mobil Uygulamalar", "Saha, depo, satış ve servis ekiplerine mobil erişim sağlar.", "Ekipler müşteri, görev, stok ve servis bilgilerine ofis dışında erişir.", "Operasyon merkezi ile saha arasındaki veri gecikmesi azalır."],
  ["Özel Modül Geliştirme", "Standart modüllerin karşılamadığı iş kurallarına özel SaaS bileşenleri geliştirir.", "Kuruma özel onay, fiyatlandırma, entegrasyon veya raporlama akışları tasarlanır.", "Yazılım mimarisi işletmenin gerçek çalışma modeline uyarlanır."],
];

const enModules = [
  ["CRM and Sales Management", "Manages opportunities, customer interactions and proposal workflows within a centralized CRM structure.", "Sales teams access account history, proposal status and next actions from one operating panel.", "Forecast quality, follow-up discipline and conversion performance improve."],
  ["ERP Operations Management", "Connects operations, purchasing, production, delivery and service workflows through an integrated ERP architecture.", "Departments work on the same data model with clearly defined operational responsibilities.", "Process visibility increases and operational delays decrease."],
  ["Finance and Account Management", "Makes collections, payments, account movements, expenses and cash flow manageable.", "Finance teams analyze customer and vendor activity with current operational data.", "Financial risk becomes visible earlier."],
  ["Inventory and Warehouse Management", "Tracks warehouses, products, critical stock levels, shipments and stock movements in real time.", "Warehouse teams manage product entries, exits and stock levels through web or mobile interfaces.", "Inventory cost and operational uncertainty are reduced."],
  ["Personnel and Task Management", "Structures user roles, task flows, approvals and workloads across the organization.", "Managers monitor performance, responsibilities and delayed work through dashboards.", "Work tracking moves from personal memory to an institutional system."],
  ["Proposal and Order Management", "Standardizes proposal creation, revision, approval and conversion to order.", "Sales teams manage proposal history connected to CRM records.", "Proposal quality and closing speed improve."],
  ["Reporting and Executive Dashboards", "Combines sales, finance, inventory and operations data for management decisions.", "Executives monitor KPIs, trends and performance indicators in real time.", "Decision-making is supported by measurable data."],
  ["Data Analytics Modules", "Turns distributed business data into comparable and actionable analytics.", "Finance, sales and operations are analyzed by segment, period and performance dimension.", "Data Analytics becomes a core layer of management discipline."],
  ["AI-Powered Decision Systems", "Builds risk, prediction and recommendation mechanisms through AI models.", "The system flags high-probability proposals, at-risk customers and financial deviations.", "Decision support capacity is strengthened at enterprise scale."],
  ["Mobile Applications", "Provides mobile access for field, warehouse, sales and service teams.", "Teams access customer, task, inventory and service information outside the office.", "Data latency between field operations and headquarters decreases."],
  ["Custom Module Development", "Develops SaaS components for business rules not covered by standard modules.", "Custom approvals, pricing, integrations and reporting flows are designed for the organization.", "The software architecture adapts to the company operating model."],
];

export const siteContent = {
  tr: {
    nav: {
      solutions: "Çözümler",
      modules: "Modüller",
      ai: "AI-Yapay Zeka",
      dataAnalytics: "Veri Analizi",
      digitalTransformation: "Dijital Dönüşüm",
      industries: "Sektörler",
      process: "Süreç",
      contact: "İletişim",
      demo: "Demo Talep Et",
      erp: "ERP Girişi",
    },
    seo: {
      home: ["Eclipse | ERP, CRM, AI-Yapay Zeka, Veri Analizi ve Dijital Dönüşüm", "Eclipse; ERP, CRM, AI-Yapay Zeka, Veri Analizi ve Dijital Dönüşüm çözümleriyle işletmeler için kurumsal yazılım mimarileri geliştirir."],
      solutions: ["Çözümler | Eclipse ERP, CRM ve AI-Yapay Zeka Platformları", "ERP, CRM, AI-Yapay Zeka, Veri Analizi, Dijital Dönüşüm, mobil uygulama ve özel SaaS geliştirme çözümleri."],
      modules: ["Modüller | Eclipse ERP, CRM ve Veri Analizi Modülleri", "CRM, ERP, finans, stok, görev, teklif, kontrol paneli, Veri Analizi ve AI-Yapay Zeka modülleriyle kurumsal yönetim."],
      ai: ["AI-Yapay Zeka Sistemleri | Eclipse", "Eclipse AI-Yapay Zeka sistemleri satış tahmini, risk tespiti, müşteri analizi ve karar destek katmanı sağlar."],
      dataAnalytics: ["Veri Analizi | Eclipse Kontrol Paneli ve Performans Göstergesi Sistemleri", "Eclipse Veri Analizi modülleri gerçek zamanlı kontrol panelleri, performans göstergesi takibi, finans, satış, stok ve operasyon analitiği sunar."],
      digitalTransformation: ["Dijital Dönüşüm | Eclipse Kurumsal Yazılım Mimarisi", "Eclipse Dijital Dönüşüm çözümleri süreç dijitalleştirme, otomasyon, entegrasyon ve ölçeklenebilir yazılım mimarisi sağlar."],
      industries: ["Sektörler | Eclipse ERP CRM AI-Yapay Zeka Çözümleri", "Üretim, depo, lojistik, kurumsal ofis, saha, satış, finans ve servis ekipleri için ERP, CRM ve AI-Yapay Zeka çözümleri."],
      process: ["Süreç | Eclipse Yazılım Geliştirme ve Devreye Alma", "Süreç analizi, sistem mimarisi, ERP CRM AI-Yapay Zeka yapılandırması, veri modeli, entegrasyon, test ve ölçekleme."],
      contact: ["İletişim ve Demo | Eclipse", "İşletmeniz için uygun ERP, CRM, AI-Yapay Zeka, Veri Analizi ve Dijital Dönüşüm mimarisini Eclipse ile planlayın."],
    },
    pages: {
      home: {
        eyebrow: "Kurumsal SaaS ve İşletme Yazılımı",
        title: "İşletmenizi Tek Merkezden Yönetin",
        subtitle: "Eclipse; ERP, CRM, AI-Yapay Zeka, Veri Analizi ve Dijital Dönüşüm çözümlerini kurumsal yazılım mimarisiyle birleştirerek işletme süreçlerini ölçülebilir, yönetilebilir ve ölçeklenebilir hale getirir.",
        primary: "Demo Talep Et",
        secondary: "Çözümleri İncele",
        intro: "Eclipse, işletmelerin operasyonel süreçlerini yalnızca dijital ortama taşımakla kalmaz; bu süreçleri ölçülebilir, izlenebilir ve optimize edilebilir bir yönetim sistemine dönüştürür.",
      },
      solutions: {
        eyebrow: "Çözüm Portföyü",
        title: "ERP, CRM, AI-Yapay Zeka ve Dijital Dönüşüm için bütünleşik yazılım mimarisi.",
        subtitle: "Eclipse, kurumsal süreçleri veriye dayalı, izlenebilir ve ölçeklenebilir bir yönetim sistemine dönüştürür.",
        intro: "Her çözüm alanı, işletmenin veri akışları, kullanıcı rolleri ve operasyonel hedefleri dikkate alınarak mühendislik disipliniyle tasarlanır.",
      },
      modules: {
        eyebrow: "Modüler Platform",
        title: "İşletme süreçlerine göre yapılandırılan ERP, CRM ve Veri Analizi modülleri.",
        subtitle: "Eclipse modülleri, standart yazılım paketlerinden farklı olarak kurumsal iş akışlarına, veri modeline ve yönetim hedeflerine göre konumlandırılır.",
      },
      ai: {
        eyebrow: "AI-Yapay Zeka",
        title: "Veriyi aksiyona dönüştüren karar destek katmanı.",
        subtitle: "AI-Yapay Zeka, Eclipse sistemlerinde yalnızca bir özellik değil; veriyi aksiyona dönüştüren karar destek katmanıdır.",
      },
      dataAnalytics: {
        eyebrow: "Veri Analizi",
        title: "Gerçek zamanlı kontrol panelleri ve yönetilebilir performans göstergesi mimarisi.",
        subtitle: "Veri Analizi modülleri, işletme verilerini dağınık raporlardan çıkararak karar verilebilir, karşılaştırılabilir ve aksiyona dönüştürülebilir hale getirir.",
      },
      digitalTransformation: {
        eyebrow: "Dijital Dönüşüm",
        title: "Süreçleri yeniden tasarlayan, ölçen ve sürdürülebilir hale getiren yazılım yaklaşımı.",
        subtitle: "Dijital Dönüşüm, yalnızca mevcut işlerin dijitale aktarılması değildir. Eclipse yaklaşımında dijital dönüşüm; süreçlerin yeniden tasarlanması, ölçülmesi ve sürdürülebilir şekilde yönetilmesidir.",
      },
      industries: {
        eyebrow: "Sektörel Uyum",
        title: "Farklı operasyon modelleri için uyarlanabilir kurumsal yazılım.",
        subtitle: "Eclipse, üretimden sahaya, depodan satış ekiplerine kadar farklı iş birimlerinin operasyonel ihtiyaçlarına göre yapılandırılır.",
      },
      process: {
        eyebrow: "Uygulama Süreci",
        title: "Analizden ölçeklemeye kadar kontrollü mühendislik süreci.",
        subtitle: "Her proje; teknik değerlendirme, mimari planlama, veri modeli, entegrasyon, test ve sürekli geliştirme aşamalarıyla yönetilir.",
      },
      contact: {
        eyebrow: "Demo ve Danışmanlık",
        title: "İşletmeniz için uygun ERP, CRM ve AI-Yapay Zeka mimarisini birlikte planlayalım.",
        subtitle: "Eclipse ekibi, iş süreçlerinizi değerlendirerek kurumsal ihtiyaçlarınıza uygun yazılım mimarisini teknik ve işlevsel açıdan netleştirir.",
      },
    },
    solutionCards: [
      ["ERP Çözümleri", "Operasyon, satın alma, stok, üretim ve servis süreçlerini bütünleşik yönetim sistemine taşır."],
      ["CRM Çözümleri", "Satış, müşteri ilişkileri, teklif ve takip süreçlerini ölçülebilir hale getirir."],
      ["AI-Yapay Zeka Sistemleri", "Tahmin, risk tespiti, öneri ve otomasyon kararlarını kurumsal veriye bağlar."],
      ["Veri Analizi", "Performans göstergesi, finans, satış, stok ve operasyon verilerini karar destek kontrol panellerine dönüştürür."],
      ["Dijital Dönüşüm", "Kağıt, Excel ve parçalı sistem bağımlılığını azaltarak süreçleri yeniden tasarlar."],
      ["Özel SaaS Geliştirme", "Kuruma özel web, mobil ve platform tabanlı yazılım ürünleri geliştirir."],
      ["Mobil İş Uygulamaları", "Saha, depo, satış ve servis ekiplerinin gerçek zamanlı veriyle çalışmasını sağlar."],
    ],
    modules: trModules,
    aiItems: ["AI destekli karar sistemleri", "Prediktif analiz", "Risk tespiti", "Müşteri davranış analizi", "Satış tahmini", "Finansal öngörü", "Akıllı iş akışı önerileri", "Özel AI ajanları", "Şirket verisine dayalı AI-Yapay Zeka sistemleri"],
    analyticsItems: ["Gerçek zamanlı kontrol panelleri", "Performans göstergesi takibi", "Finans analitiği", "Satış analitiği", "Stok analitiği", "Personel performans analitiği", "Yönetim raporlaması", "Operasyonel görünürlük"],
    transformationItems: ["Süreç dijitalleştirme", "İş akışı otomasyonu", "Sistem entegrasyonu", "Kağıt ve Excel bağımlılığının azaltılması", "Web ve mobil erişim", "Ölçeklenebilir mimari", "Kurumsal yazılım yol haritası"],
    industries: [
      ["Üretim", "Üretim verisi, stok ve sipariş akışları parçalı takip edilir.", "ERP, stok, üretim ve Veri Analizi modülleri aynı mimaride birleştirilir.", "Planlama doğruluğu ve operasyonel görünürlük artar."],
      ["Depo ve Lojistik", "Stok hareketleri ve teslimat durumları gerçek zamanlı izlenemez.", "Depo, sevkiyat ve mobil saha kullanımı merkezi sisteme bağlanır.", "Stok hataları ve teslimat gecikmeleri azalır."],
      ["Kurumsal Ofisler", "Ekipler farklı araçlarda çalışır ve raporlama standardı oluşmaz.", "CRM, görev, finans ve kontrol paneli yapısı tek platformda konumlanır.", "Yönetim raporları standart ve karşılaştırılabilir hale gelir."],
      ["Saha Operasyonları", "Saha verisi merkeze geç ulaşır veya eksik kaydedilir.", "Mobil uygulamalar görev, müşteri ve operasyon verisini canlı aktarır.", "Merkez ve saha arasındaki karar gecikmesi azalır."],
      ["Satış Ekipleri", "Fırsatlar ve teklif takipleri kişisel yöntemlerle ilerler.", "CRM ve AI-Yapay Zeka destekli satış tahmini birlikte çalışır.", "Kapanış disiplini ve satış öngörüsü gelişir."],
      ["Finans Ekipleri", "Cari, tahsilat ve nakit akışı verileri parçalı raporlanır.", "Finans kontrol panelleri ve Veri Analizi modülleri riskleri görünür kılar.", "Finansal kontrol ve raporlama kalitesi artar."],
      ["Servis ve Bakım Ekipleri", "Servis talepleri, görevler ve saha kayıtları izlenebilir değildir.", "Görev, mobil ve müşteri modülleri servis operasyonunu merkezileştirir.", "Müdahale süreleri ve hizmet kalitesi ölçülebilir hale gelir."],
    ],
    processSteps: [
      ["Süreç ve İhtiyaç Analizi", "Mevcut operasyon yapısı, veri akışları, kullanıcı rolleri, raporlama ihtiyaçları ve entegrasyon gereksinimleri teknik ve işlevsel açıdan değerlendirilir."],
      ["Sistem Mimarisi ve Modül Planlama", "ERP, CRM, Veri Analizi ve AI-Yapay Zeka bileşenlerinin kurumsal hedeflere göre nasıl konumlanacağı belirlenir."],
      ["ERP / CRM / AI-Yapay Zeka Yapılandırması", "Modüller, rol bazlı yetkiler, iş kuralları ve süreç akışları işletmenin çalışma modeline göre yapılandırılır."],
      ["Veri Modeli ve Entegrasyonlar", "Veri yapısı, ilişkilendirmeler, API ihtiyaçları ve üçüncü parti sistem bağlantıları planlanır."],
      ["Web ve Mobil Kullanım Deneyimi", "Kullanıcı gruplarına göre web ve mobil arayüzler operasyonel verimlilik odağıyla tasarlanır."],
      ["Test, Eğitim ve Yayına Alma", "Fonksiyonel testler, kullanıcı kabul süreçleri, eğitim ve canlıya geçiş planı kontrollü şekilde yürütülür."],
      ["Sürekli Geliştirme ve Ölçekleme", "Sistem kullanımı izlenir, yeni ihtiyaçlar değerlendirilir ve platform ölçeklenebilir biçimde geliştirilir."],
    ],
    form: {
      name: "Ad Soyad",
      company: "Firma",
      email: "E-posta",
      phone: "Telefon",
      solution: "İlgilenilen çözüm",
      message: "Mesaj",
      submit: "Demo Talebini Gönder",
      options: ["ERP", "CRM", "AI-Yapay Zeka", "Veri Analizi", "Dijital Dönüşüm", "Mobil Uygulama", "Özel Yazılım"],
    },
    ctaTitle: "Kurumsal yazılım mimarinizi birlikte değerlendirelim.",
    ctaText: "ERP, CRM, AI-Yapay Zeka, Veri Analizi ve Dijital Dönüşüm gereksinimlerinizi teknik ve iş hedefleriyle birlikte ele alalım.",
  },
  en: {
    nav: {
      solutions: "Solutions",
      modules: "Modules",
      ai: "AI",
      dataAnalytics: "Data Analytics",
      digitalTransformation: "Digital Transformation",
      industries: "Industries",
      process: "Process",
      contact: "Contact",
      demo: "Request Demo",
      erp: "ERP Login",
    },
    seo: {
      home: ["Eclipse | ERP, CRM, AI, Data Analytics and Digital Transformation", "Eclipse builds enterprise ERP, CRM, AI, Data Analytics and Digital Transformation software architectures for measurable business operations."],
      solutions: ["Solutions | Eclipse ERP, CRM and AI Platforms", "ERP, CRM, AI systems, Data Analytics, Digital Transformation, mobile applications and custom SaaS development solutions."],
      modules: ["Modules | Eclipse ERP, CRM and Data Analytics", "CRM, ERP, finance, inventory, tasks, proposals, dashboards, Data Analytics and AI-powered decision modules."],
      ai: ["AI Systems | Eclipse", "Eclipse AI systems support sales forecasting, risk detection, customer analysis, financial forecasting and decision intelligence."],
      dataAnalytics: ["Data Analytics | Eclipse Dashboards and KPI Systems", "Real-time dashboards, KPI tracking, finance, sales, inventory, personnel performance and operational analytics."],
      digitalTransformation: ["Digital Transformation | Eclipse Enterprise Software", "Process digitization, workflow automation, system integration and scalable enterprise software roadmap solutions."],
      industries: ["Industries | Eclipse ERP CRM AI Solutions", "ERP, CRM and AI solutions for manufacturing, warehouse, logistics, corporate offices, field teams, sales, finance and service teams."],
      process: ["Process | Eclipse Software Engineering and Deployment", "Process analysis, system architecture, ERP CRM AI configuration, data model, integrations, testing and scaling."],
      contact: ["Contact and Demo | Eclipse", "Plan the right ERP, CRM, AI, Data Analytics and Digital Transformation architecture for your business with Eclipse."],
    },
    pages: {
      home: {
        eyebrow: "Enterprise SaaS and Business Software",
        title: "Manage Your Business from One Platform",
        subtitle: "Eclipse combines ERP, CRM, AI, Data Analytics and Digital Transformation through enterprise software architecture to make business operations measurable, manageable and scalable.",
        primary: "Request Demo",
        secondary: "Explore Solutions",
        intro: "Eclipse does not simply move business processes into software; it transforms them into measurable, traceable and optimizable management systems.",
      },
      solutions: { eyebrow: "Solution Portfolio", title: "Integrated software architecture for ERP, CRM, AI and Digital Transformation.", subtitle: "Eclipse turns enterprise processes into data-driven, traceable and scalable management systems.", intro: "Each solution area is engineered around business data flows, user roles and operational objectives." },
      modules: { eyebrow: "Modular Platform", title: "ERP, CRM and Data Analytics modules configured around business processes.", subtitle: "Eclipse modules are positioned around enterprise workflows, data models and management objectives rather than generic software packages." },
      ai: { eyebrow: "AI", title: "A decision-support layer that turns data into action.", subtitle: "In Eclipse systems, AI is not a standalone feature; it is the decision intelligence layer that converts operational data into action." },
      dataAnalytics: { eyebrow: "Data Analytics", title: "Real-time dashboards and manageable KPI architecture.", subtitle: "Data Analytics modules move business data out of fragmented reports and make it comparable, decision-ready and actionable." },
      digitalTransformation: { eyebrow: "Digital Transformation", title: "A software approach that redesigns, measures and sustains business processes.", subtitle: "Digital Transformation is not only the digitization of existing work. In the Eclipse approach, it means redesigning, measuring and sustainably managing processes." },
      industries: { eyebrow: "Industry Fit", title: "Adaptable enterprise software for different operating models.", subtitle: "Eclipse is configured around the operational requirements of production, field teams, warehouses, sales organizations and finance teams." },
      process: { eyebrow: "Implementation Process", title: "A controlled engineering process from analysis to scaling.", subtitle: "Every project is managed through technical assessment, architecture planning, data modeling, integration, testing and continuous improvement." },
      contact: { eyebrow: "Demo and Consulting", title: "Let us plan the right ERP, CRM and AI architecture for your business.", subtitle: "The Eclipse team evaluates your business processes and defines the appropriate software architecture from both technical and functional perspectives." },
    },
    solutionCards: [
      ["ERP Solutions", "Move operations, purchasing, inventory, production and service workflows into an integrated management system."],
      ["CRM Solutions", "Make sales, customer relationships, proposals and follow-up processes measurable."],
      ["AI Systems", "Connect prediction, risk detection, recommendations and automation decisions to enterprise data."],
      ["Data Analytics", "Transform KPIs, finance, sales, inventory and performance data into decision dashboards."],
      ["Digital Transformation", "Redesign processes by reducing dependency on paper, Excel and fragmented systems."],
      ["Custom SaaS Development", "Build custom web, mobile and platform-based software products for enterprise use."],
      ["Mobile Business Applications", "Enable field, warehouse, sales and service teams to work with real-time data."],
    ],
    modules: enModules,
    aiItems: ["AI-supported decision systems", "Predictive analytics", "Risk detection", "Customer behavior analysis", "Sales forecasting", "Financial forecasting", "Intelligent workflow suggestions", "Custom AI agents", "Company-data-based AI systems"],
    analyticsItems: ["Real-time dashboards", "KPI tracking", "Finance analytics", "Sales analytics", "Inventory analytics", "Personnel performance analytics", "Management reporting", "Operational visibility"],
    transformationItems: ["Process digitization", "Workflow automation", "System integration", "Paper and Excel dependency reduction", "Web and mobile access", "Scalable architecture", "Enterprise software roadmap"],
    industries: [
      ["Manufacturing", "Production data, inventory and order flows are tracked through fragmented systems.", "ERP, inventory, production and Data Analytics modules are unified in one architecture.", "Planning accuracy and operational visibility increase."],
      ["Warehouse & Logistics", "Stock movements and delivery statuses are not monitored in real time.", "Warehouse, shipment and mobile field usage are connected to the central system.", "Inventory errors and delivery delays are reduced."],
      ["Corporate Offices", "Teams operate across different tools without a standard reporting structure.", "CRM, tasks, finance and dashboard capabilities are positioned on one platform.", "Management reporting becomes standardized and comparable."],
      ["Field Operations", "Field data reaches headquarters late or is recorded incompletely.", "Mobile applications transmit task, customer and operational data in real time.", "Decision latency between field and headquarters decreases."],
      ["Sales Teams", "Opportunities and proposal follow-ups rely on personal methods.", "CRM and AI-powered sales forecasting operate together.", "Closing discipline and sales predictability improve."],
      ["Finance Teams", "Accounts, collections and cash flow data are reported through fragmented files.", "Finance dashboards and Data Analytics modules expose financial risks.", "Financial control and reporting quality improve."],
      ["Service Teams", "Service requests, tasks and field records are not fully traceable.", "Task, mobile and customer modules centralize service operations.", "Response times and service quality become measurable."],
    ],
    processSteps: [
      ["Process and Requirements Analysis", "The current operating model, data flows, user roles, reporting needs and integration requirements are assessed from technical and functional perspectives."],
      ["System Architecture and Module Planning", "ERP, CRM, Data Analytics and AI components are positioned according to enterprise objectives."],
      ["ERP / CRM / AI Configuration", "Modules, role-based permissions, business rules and workflow structures are configured around the operating model."],
      ["Data Model and Integrations", "Data structures, relationships, API needs and third-party system connections are planned."],
      ["Web and Mobile User Experience", "Web and mobile interfaces are designed around operational efficiency for each user group."],
      ["Testing, Training and Go-Live", "Functional testing, user acceptance, training and go-live planning are executed in a controlled manner."],
      ["Continuous Improvement and Scaling", "System usage is monitored, new requirements are evaluated and the platform evolves in a scalable structure."],
    ],
    form: {
      name: "Full Name",
      company: "Company",
      email: "Email",
      phone: "Phone",
      solution: "Solution of Interest",
      message: "Message",
      submit: "Submit Demo Request",
      options: ["ERP", "CRM", "AI", "Data Analytics", "Digital Transformation", "Mobile Application", "Custom Software"],
    },
    ctaTitle: "Let us evaluate your enterprise software architecture.",
    ctaText: "We can assess your ERP, CRM, AI, Data Analytics and Digital Transformation requirements alongside your technical and business objectives.",
  },
} as const;

export const iconSet = [Gauge, Users, BrainCircuit, BarChart3, Workflow, PanelsTopLeft, Smartphone, WalletCards, PackageCheck, ClipboardList, LineChart, Target, Factory, Truck, Route, BriefcaseBusiness];
