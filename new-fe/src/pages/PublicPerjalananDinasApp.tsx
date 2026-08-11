import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  Headphones,
  History,
  Lock,
  MailQuestion,
  MapPinned,
  ReceiptText,
  ShieldCheck,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

const appName = 'Perjalanan Dinas';
const lastUpdated = '15 Juni 2026';

const PublicShell = ({
  children,
  eyebrow,
  title,
  description,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) => (
  <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/perjalanan-dinas-app" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-600 text-white">
            <MapPinned className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-base font-bold">{appName}</span>
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Employee Travel Expense</span>
          </span>
        </Link>
        <nav className="flex flex-wrap gap-2 text-sm font-semibold text-slate-700">
          <Link className="rounded-md px-3 py-2 hover:bg-slate-100" to="/perjalanan-dinas-app">Marketing</Link>
          <Link className="rounded-md px-3 py-2 hover:bg-slate-100" to="/perjalanan-dinas-app/support">Support</Link>
          <Link className="rounded-md px-3 py-2 hover:bg-slate-100" to="/perjalanan-dinas-app/privacy-policy">Privacy Policy</Link>
        </nav>
      </div>
    </header>

    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <p className="mb-4 text-sm font-bold uppercase tracking-wide text-blue-700">{eyebrow}</p>
        <h1 className="max-w-4xl text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">{description}</p>
      </div>
    </section>

    <div className="mx-auto max-w-6xl px-6 py-12">{children}</div>
  </main>
);

const InfoBand = ({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) => (
  <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
    <Icon className="mb-4 h-6 w-6 text-blue-600" />
    <h2 className="text-lg font-bold text-slate-950">{title}</h2>
    <p className="mt-2 leading-7 text-slate-600">{body}</p>
  </div>
);

const PolicySection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="border-b border-slate-200 py-7 last:border-b-0">
    <h2 className="text-xl font-bold text-slate-950">{title}</h2>
    <div className="mt-3 space-y-3 leading-7 text-slate-600">{children}</div>
  </section>
);

export function PerjalananDinasMarketingPage() {
  return (
    <PublicShell
      eyebrow="Marketing URL"
      title="Input perjalanan dinas karyawan jadi lebih rapi, cepat, dan mudah diaudit."
      description="Aplikasi Perjalanan Dinas membantu pegawai mencatat transaksi selama tugas luar, mengunggah bukti, menyelesaikan laporan, dan melihat riwayat perjalanan dari satu alur kerja yang sederhana."
    >
      <div className="grid gap-5 md:grid-cols-3">
        <InfoBand
          icon={ClipboardList}
          title="Daftar Perjalanan"
          body="Pegawai dapat melihat perjalanan dinas yang ditugaskan, status proses, dana yang diterima, dan ringkasan penggunaan biaya."
        />
        <InfoBand
          icon={ReceiptText}
          title="Input Transaksi"
          body="Biaya perjalanan seperti transportasi, konsumsi, akomodasi, dan kebutuhan operasional dapat dicatat sebagai item transaksi."
        />
        <InfoBand
          icon={UploadCloud}
          title="Upload Bukti"
          body="Bukti transaksi berupa gambar atau dokumen pendukung dapat diunggah untuk mempercepat validasi dan audit internal."
        />
      </div>

      <section className="mt-10 rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-950">Alur kerja utama</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {['Pilih perjalanan dinas', 'Tambah transaksi dan bukti', 'Submit penyelesaian', 'Pantau history dan audit'].map((item, index) => (
            <div key={item} className="border-l-4 border-blue-600 bg-slate-50 p-4">
              <p className="text-sm font-bold text-blue-700">Langkah {index + 1}</p>
              <p className="mt-2 font-semibold text-slate-900">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-5 md:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <ShieldCheck className="mb-4 h-7 w-7 text-blue-600" />
          <h2 className="text-xl font-bold text-slate-950">Dibuat untuk proses internal perusahaan</h2>
          <p className="mt-3 leading-7 text-slate-600">
            Data perjalanan dinas digunakan untuk administrasi biaya, validasi bukti, audit, dan pelaporan internal sesuai kebijakan perusahaan.
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <History className="mb-4 h-7 w-7 text-blue-600" />
          <h2 className="text-xl font-bold text-slate-950">Riwayat tetap mudah dilacak</h2>
          <p className="mt-3 leading-7 text-slate-600">
            Pegawai dan tim terkait dapat melihat status perjalanan, transaksi yang sudah diajukan, serta catatan proses penyelesaian.
          </p>
        </div>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700" to="/perjalanan-dinas-app/support">
          Buka Support URL
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 hover:bg-slate-100" to="/perjalanan-dinas-app/privacy-policy">
          Buka Privacy Policy
        </Link>
      </div>
    </PublicShell>
  );
}

export function PerjalananDinasSupportPage() {
  return (
    <PublicShell
      eyebrow="Support URL"
      title="Bantuan penggunaan aplikasi Perjalanan Dinas."
      description="Halaman ini disediakan untuk membantu pengguna dan reviewer memahami jalur bantuan aplikasi. Untuk penggunaan produksi, pegawai dapat menghubungi administrator perusahaan atau tim Finance/IT internal yang memberikan akses aplikasi."
    >
      <div className="grid gap-5 md:grid-cols-3">
        <InfoBand
          icon={MailQuestion}
          title="Akses dan Login"
          body="Laporkan kendala akun, role, reset password, atau token login kepada administrator internal perusahaan."
        />
        <InfoBand
          icon={ReceiptText}
          title="Transaksi dan Bukti"
          body="Hubungi tim Finance jika ada kendala kategori biaya, nominal, lampiran bukti, atau status validasi transaksi."
        />
        <InfoBand
          icon={FileText}
          title="Status Penyelesaian"
          body="Minta bantuan tim terkait jika perjalanan belum bisa diselesaikan, perlu revisi, atau membutuhkan pengecekan audit."
        />
      </div>

      <section className="mt-10 rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-blue-700">
            <Headphones className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-2xl font-bold text-slate-950">Informasi yang sebaiknya disertakan saat meminta bantuan</h2>
            <ul className="mt-4 grid gap-3 leading-7 text-slate-600 md:grid-cols-2">
              <li>Nama pengguna dan perusahaan/unit kerja.</li>
              <li>Nomor atau nama perjalanan dinas.</li>
              <li>Tanggal kejadian dan status terakhir.</li>
              <li>Screenshot atau pesan error jika tersedia.</li>
              <li>Nominal transaksi dan kategori terkait.</li>
              <li>Jenis perangkat dan versi aplikasi yang digunakan.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-10 rounded-md border border-blue-200 bg-blue-50 p-6">
        <h2 className="text-xl font-bold text-slate-950">Jalur eskalasi internal</h2>
        <p className="mt-3 leading-7 text-slate-700">
          Aplikasi ini digunakan untuk kebutuhan operasional perusahaan. Permintaan bantuan, koreksi data, dan permintaan penghapusan data dilakukan melalui administrator perusahaan atau tim internal yang ditunjuk.
        </p>
      </section>
    </PublicShell>
  );
}

export function PerjalananDinasPrivacyPolicyPage() {
  return (
    <PublicShell
      eyebrow="Privacy Policy"
      title="Kebijakan Privasi Aplikasi Perjalanan Dinas."
      description={`Terakhir diperbarui: ${lastUpdated}. Kebijakan ini menjelaskan bagaimana data pengguna diproses untuk mendukung pencatatan, penyelesaian, dan audit perjalanan dinas.`}
    >
      <article className="rounded-md border border-slate-200 bg-white px-6 py-2 shadow-sm">
        <PolicySection title="1. Data yang dikumpulkan">
          <p>
            Aplikasi dapat memproses data akun seperti nama, username atau email kerja, role, dan informasi autentikasi. Aplikasi juga memproses data perjalanan dinas seperti tanggal perjalanan, tujuan, dana perjalanan, item transaksi, nominal, kategori biaya, catatan, status penyelesaian, dan riwayat audit.
          </p>
          <p>
            Saat pengguna mengunggah bukti transaksi, aplikasi dapat menyimpan gambar, PDF, atau dokumen pendukung lain yang dipilih pengguna.
          </p>
        </PolicySection>

        <PolicySection title="2. Tujuan penggunaan data">
          <p>
            Data digunakan untuk menjalankan fungsi aplikasi, termasuk menampilkan daftar perjalanan dinas, mencatat transaksi, mengunggah bukti, menyelesaikan laporan, melakukan validasi, audit internal, dan membuat pelaporan administrasi perusahaan.
          </p>
          <p>
            Aplikasi tidak menggunakan data pengguna untuk iklan, pelacakan lintas aplikasi, atau penjualan data pribadi.
          </p>
        </PolicySection>

        <PolicySection title="3. Penyimpanan dan akses">
          <p>
            Data disimpan pada sistem yang dikelola atau ditunjuk oleh perusahaan. Akses data dibatasi berdasarkan akun, role, dan kebutuhan operasional seperti pegawai, finance, admin, auditor, atau pihak internal lain yang berwenang.
          </p>
        </PolicySection>

        <PolicySection title="4. Berbagi data">
          <p>
            Data tidak dibagikan kepada pihak ketiga untuk tujuan iklan. Data dapat diproses oleh penyedia infrastruktur, hosting, database, storage, atau layanan teknis lain yang digunakan perusahaan untuk menjalankan aplikasi.
          </p>
        </PolicySection>

        <PolicySection title="5. Retensi dan penghapusan data">
          <p>
            Data disimpan selama diperlukan untuk administrasi perjalanan dinas, audit, kepatuhan internal, dan kewajiban pencatatan perusahaan. Permintaan koreksi atau penghapusan data dapat diajukan melalui administrator perusahaan atau tim internal yang memberikan akses aplikasi.
          </p>
        </PolicySection>

        <PolicySection title="6. Keamanan">
          <p>
            Aplikasi menggunakan autentikasi dan pembatasan akses berbasis role. Pengguna bertanggung jawab menjaga keamanan akun dan tidak membagikan kredensial kepada pihak lain.
          </p>
        </PolicySection>

        <PolicySection title="7. Perubahan kebijakan">
          <p>
            Kebijakan ini dapat diperbarui jika terdapat perubahan fitur, praktik pengolahan data, atau kebutuhan kepatuhan. Tanggal pembaruan terakhir ditampilkan pada bagian atas halaman ini.
          </p>
        </PolicySection>

        <PolicySection title="8. Kontak">
          <p>
            Untuk pertanyaan terkait privasi, akses data, koreksi data, atau penghapusan data, pengguna dapat menghubungi administrator perusahaan atau tim Finance/IT internal yang mengelola aplikasi Perjalanan Dinas.
          </p>
        </PolicySection>
      </article>

      <div className="mt-8 rounded-md border border-slate-200 bg-slate-100 p-5">
        <div className="flex items-start gap-3">
          <Lock className="mt-1 h-5 w-5 text-blue-700" />
          <p className="leading-7 text-slate-700">
            Halaman ini dibuat sebagai Privacy Policy URL publik untuk kebutuhan App Store dan dapat diakses tanpa login.
          </p>
        </div>
      </div>
    </PublicShell>
  );
}
