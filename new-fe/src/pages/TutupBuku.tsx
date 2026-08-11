import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "react-toastify";
import axiosInstance from "@/api/axiosInstance";
import { useAppStore } from "@/store/useAppStore";
import { Calendar, AlertTriangle, CheckCircle } from "lucide-react";

export default function TutupBuku() {
  const { setFiscalYear } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [tahun, setTahun] = useState("");

  const handleTutupBuku = async () => {
    if (!tahun) {
      toast.error("Tahun fiskal harus diisi!");
      return;
    }
    setLoading(true);
    try {
      console.debug('[TutupBuku] Attempting to close fiscal year:', tahun);
      const res = await axiosInstance.post("/fiscal/close", { fiscalYear: tahun });
      console.debug('[TutupBuku] /fiscal/close response:', res?.data);
      if (res.data.success) {
        toast.success(`Tutup buku berhasil! Data tahun ${tahun} dipindahkan.`);
        // Update fiscal year in global store
        setFiscalYear(Number(tahun) + 1);
        console.debug('[TutupBuku] setFiscalYear called with:', Number(tahun) + 1);
        setTahun(""); // Reset form
      } else {
        toast.error("Tutup buku gagal!");
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || "Tutup buku gagal!");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
      <div className="absolute top-0 right-0 -z-10">
        <div className="w-72 h-72 bg-gradient-to-bl from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl" />
      </div>
      <div className="absolute bottom-0 left-0 -z-10">
        <div className="w-96 h-96 bg-gradient-to-tr from-indigo-400/20 to-purple-600/20 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6 py-8 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Tutup Buku
            </h1>
            <p className="text-gray-600 mt-2">Kelola penutupan tahun fiskal dengan aman</p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Warning Card */}
          <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-dashed border-amber-200 mb-6">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-amber-900 mb-2">
                    Peringatan Penting
                  </h3>
                  <p className="text-amber-800 text-sm leading-relaxed">
                    Tutup buku akan memindahkan semua data transaksi tahun fiskal yang dipilih ke arsip.
                    Pastikan semua transaksi telah selesai dan data sudah benar sebelum melanjutkan.
                    Tindakan ini tidak dapat dibatalkan.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Form Card */}
          <Card className="bg-white/50 backdrop-blur-sm border-2 border-dashed border-blue-200 shadow-xl">
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Tutup Buku Tahun Fiskal
              </CardTitle>
              <CardDescription className="text-gray-600">
                Masukkan tahun fiskal yang akan ditutup
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid gap-2">
                <Label htmlFor="tahun" className="text-sm font-semibold text-gray-700">
                  Tahun Fiskal
                </Label>
                <Input
                  id="tahun"
                  type="number"
                  placeholder="2025"
                  value={tahun}
                  onChange={(e) => setTahun(e.target.value)}
                  className="border-2 border-gray-200 transition-all duration-200 text-center text-lg font-semibold"
                  min="2000"
                  max="2100"
                />
                <p className="text-xs text-gray-500 text-center">
                  Contoh: 2025 (tahun yang akan ditutup)
                </p>
              </div>

              <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-200/50">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-900">Yang akan terjadi:</span>
                </div>
                <ul className="text-sm text-blue-800 space-y-1 ml-8">
                  <li>• Semua transaksi tahun {tahun || "terpilih"} akan dipindahkan ke arsip</li>
                  <li>• Tahun fiskal aktif akan berubah ke {tahun ? (parseInt(tahun) + 1).toString() : "tahun berikutnya"}</li>
                  <li>• Data tetap dapat diakses melalui laporan arsip</li>
                </ul>
              </div>

              <Button
                onClick={handleTutupBuku}
                disabled={loading || !tahun}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Memproses Tutup Buku...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Tutup Buku Tahun {tahun || "..."}
                  </div>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
