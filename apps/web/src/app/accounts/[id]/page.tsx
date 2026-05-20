"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useSession, authClient } from "@/lib/auth-client";
import { apiRequest } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Calendar, TrendingUp, BarChart3, Video, Plus, Trash2, Edit3,
  ExternalLink, Eye, Heart, Loader2, Sparkles, User, LogOut, AlertTriangle,
  RefreshCw, Link, CheckCircle2
} from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface TikTokAccount {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  type: "real" | "copia";
  isActive: boolean;
  tiktokUserId: string | null;
  tokenExpiresAt: string | null;
  hasTikTokToken: boolean;
  limitedMetrics: boolean;
  createdAt: string;
}

interface AccountMetricSnapshot {
  id: string;
  accountId: string;
  followers: number;
  totalViews: number;
  totalLikes: number;
  totalVideos: number;
  recordedAt: string;
}

interface VideoPost {
  id: string;
  accountId: string;
  title: string | null;
  tiktokUrl: string | null;
  thumbnail: string | null;
  postedAt: string | null;
  status: "active" | "paused" | "removed";
  views: number;
  likes: number;
  comments: number;
  shares: number;
  createdAt: string;
}

export default function AccountDetailPage() {
  const router = useRouter();
  const params = useParams();
  const accountId = params.id as string;
  const queryClient = useQueryClient();
  const { data: sessionData, isPending: sessionLoading } = useSession();
  const user = sessionData?.user;

  const [isMounted, setIsMounted] = useState(false);

  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");

  const [syncStatus, setSyncStatus] = useState<{ success: boolean; limitedMetrics: boolean; message?: string } | null>(null);

  const syncMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/accounts/${accountId}/sync`, {
        method: "POST"
      }),
    onSuccess: (dataRaw: unknown) => {
      const data = dataRaw as { limitedMetrics: boolean };
      queryClient.invalidateQueries({ queryKey: ["account", accountId] });
      queryClient.invalidateQueries({ queryKey: ["metrics", accountId] });
      queryClient.invalidateQueries({ queryKey: ["videos", accountId] });
      setSyncStatus({
        success: true,
        limitedMetrics: !!data.limitedMetrics,
        message: data.limitedMetrics 
          ? "Sincronização concluída. Métricas limitadas — scope não aprovado pelo TikTok." 
          : "Sincronização concluída com sucesso com o TikTok!"
      });
      setTimeout(() => setSyncStatus(null), 7000);
    },
    onError: (err: Error) => {
      setSyncStatus({
        success: false,
        limitedMetrics: false,
        message: err.message || "Erro de conexão ao sincronizar com a API."
      });
      setTimeout(() => setSyncStatus(null), 7000);
    }
  });

  // Modals state
  const [isMetricsOpen, setIsMetricsOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isDeleteVideoOpen, setIsDeleteVideoOpen] = useState(false);

  // Metrics form states
  const [followers, setFollowers] = useState<number | "">("");
  const [totalViews, setTotalViews] = useState<number | "">("");
  const [totalLikes, setTotalLikes] = useState<number | "">("");
  const [totalVideos, setTotalVideos] = useState<number | "">("");
  const [metricsError, setMetricsError] = useState("");

  // Videos form states
  const [selectedVideo, setSelectedVideo] = useState<VideoPost | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoThumbnail, setVideoThumbnail] = useState("");
  const [videoPostedAt, setVideoPostedAt] = useState("");
  const [videoStatus, setVideoStatus] = useState<"active" | "paused" | "removed">("active");
  const [videoViews, setVideoViews] = useState<number | "">("");
  const [videoLikes, setVideoLikes] = useState<number | "">("");
  const [videoComments, setVideoComments] = useState<number | "">("");
  const [videoShares, setVideoShares] = useState<number | "">("");
  const [videoError, setVideoError] = useState("");

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!sessionLoading && !user) {
      router.push("/login");
    }
  }, [user, sessionLoading, router]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Queries
  const { data: account, isLoading: accountLoading, error: accountError } = useQuery<TikTokAccount>({
    queryKey: ["account", accountId],
    queryFn: () => apiRequest(`/accounts/${accountId}`),
    enabled: !!user && !!accountId,
  });

  const { data: metricsHistory = [], isLoading: metricsLoading } = useQuery<AccountMetricSnapshot[]>({
    queryKey: ["metrics", accountId],
    queryFn: () => apiRequest(`/accounts/${accountId}/metrics`),
    enabled: !!user && !!accountId,
  });

  const { data: videosList = [], isLoading: videosLoading } = useQuery<VideoPost[]>({
    queryKey: ["videos", accountId],
    queryFn: () => apiRequest(`/accounts/${accountId}/videos`),
    enabled: !!user && !!accountId,
  });

  // Check if today already has a metrics snapshot
  const todaySnapshot = metricsHistory.find((m) => {
    const recordedDate = new Date(m.recordedAt);
    const today = new Date();
    return (
      recordedDate.getDate() === today.getDate() &&
      recordedDate.getMonth() === today.getMonth() &&
      recordedDate.getFullYear() === today.getFullYear()
    );
  });

  const latestSnapshot = metricsHistory[0] || null;

  // Mutations
  const saveMetricsMutation = useMutation({
    mutationFn: (newMetrics: { followers: number; totalViews: number; totalLikes: number; totalVideos: number }) =>
      apiRequest(`/accounts/${accountId}/metrics`, {
        method: "POST",
        body: JSON.stringify(newMetrics),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metrics", accountId] });
      setIsMetricsOpen(false);
    },
    onError: (err: Error) => {
      setMetricsError(err.message || "Erro ao salvar métricas");
    }
  });

  const saveVideoMutation = useMutation({
    mutationFn: (videoData: Partial<VideoPost>) => {
      if (selectedVideo) {
        return apiRequest(`/accounts/${accountId}/videos/${selectedVideo.id}`, {
          method: "PUT",
          body: JSON.stringify(videoData),
        });
      } else {
        return apiRequest(`/accounts/${accountId}/videos`, {
          method: "POST",
          body: JSON.stringify(videoData),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos", accountId] });
      setIsVideoModalOpen(false);
      resetVideoForm();
    },
    onError: (err: Error) => {
      setVideoError(err.message || "Erro ao salvar vídeo");
    }
  });

  const deleteVideoMutation = useMutation({
    mutationFn: (videoId: string) =>
      apiRequest(`/accounts/${accountId}/videos/${videoId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos", accountId] });
      setIsDeleteVideoOpen(false);
      setSelectedVideo(null);
    }
  });

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  const handleMetricsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMetricsError("");
    saveMetricsMutation.mutate({
      followers: Number(followers) || 0,
      totalViews: Number(totalViews) || 0,
      totalLikes: Number(totalLikes) || 0,
      totalVideos: Number(totalVideos) || 0,
    });
  };

  const handleVideoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setVideoError("");
    saveVideoMutation.mutate({
      title: videoTitle,
      tiktokUrl: videoUrl || null,
      thumbnail: videoThumbnail || null,
      postedAt: videoPostedAt ? new Date(videoPostedAt).toISOString() : new Date().toISOString(),
      status: videoStatus,
      views: Number(videoViews) || 0,
      likes: Number(videoLikes) || 0,
      comments: Number(videoComments) || 0,
      shares: Number(videoShares) || 0,
    });
  };

  const resetMetricsForm = () => {
    const baseSource = todaySnapshot || latestSnapshot;
    setFollowers(baseSource ? baseSource.followers : "");
    setTotalViews(baseSource ? baseSource.totalViews : "");
    setTotalLikes(baseSource ? baseSource.totalLikes : "");
    setTotalVideos(baseSource ? baseSource.totalVideos : "");
    setMetricsError("");
  };

  const resetVideoForm = () => {
    setSelectedVideo(null);
    setVideoTitle("");
    setVideoUrl("");
    setVideoThumbnail("");
    setVideoPostedAt(new Date().toISOString().substring(0, 16));
    setVideoStatus("active");
    setVideoViews("");
    setVideoLikes("");
    setVideoComments("");
    setVideoShares("");
    setVideoError("");
  };

  const openEditVideo = (video: VideoPost) => {
    setSelectedVideo(video);
    setVideoTitle(video.title || "");
    setVideoUrl(video.tiktokUrl || "");
    setVideoThumbnail(video.thumbnail || "");
    if (video.postedAt) {
      setVideoPostedAt(new Date(video.postedAt).toISOString().substring(0, 16));
    } else {
      setVideoPostedAt("");
    }
    setVideoStatus(video.status);
    setVideoViews(video.views);
    setVideoLikes(video.likes);
    setVideoComments(video.comments);
    setVideoShares(video.shares);
    setVideoError("");
    setIsVideoModalOpen(true);
  };

  if (sessionLoading || !user || accountLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#00f2fe]" />
          <p className="text-zinc-400 text-sm">Carregando painel analítico da conta...</p>
        </div>
      </div>
    );
  }

  if (accountError || !account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-[#fe0979]" />
          <h2 className="text-xl font-bold">Conta Não Encontrada</h2>
          <p className="text-zinc-400 text-sm">
            Esta conta TikTok pode não pertencer ao seu usuário ou ter sido removida.
          </p>
          <Button
            onClick={() => router.push("/dashboard")}
            className="mt-2 bg-gradient-to-r from-[#00f2fe] to-[#fe0979] text-white border-none font-bold rounded-xl"
          >
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Reverse data for chronological plotting in Recharts
  const chartData = [...metricsHistory].reverse();

  // Custom tooltips for recharts
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: AccountMetricSnapshot }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#0c0c0e]/95 border border-[#00f2fe]/30 backdrop-blur-md px-4 py-3 rounded-xl shadow-2xl flex flex-col gap-1.5 text-xs text-zinc-300">
          <p className="font-bold text-white flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[#00f2fe]" />
            {new Date(data.recordedAt).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>
          <p className="font-semibold text-white flex items-center gap-1.5">
            👥 Seguidores: <span className="text-[#00f2fe] font-black">{Number(data.followers).toLocaleString()}</span>
          </p>
          <p className="flex items-center gap-1.5">
            👁️ Views: <span className="font-semibold">{Number(data.totalViews).toLocaleString()}</span>
          </p>
          <p className="flex items-center gap-1.5">
            ❤️ Curtidas: <span className="font-semibold">{Number(data.totalLikes).toLocaleString()}</span>
          </p>
          <p className="flex items-center gap-1.5">
            🎬 Vídeos: <span className="font-semibold">{Number(data.totalVideos).toLocaleString()}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#070708] text-white font-sans selection:bg-[#00f2fe]/30 pb-16">
      {/* Glow Effects */}
      <div className="absolute top-0 right-0 w-[40%] h-[40%] rounded-full bg-[#00f2fe]/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-50 left-0 w-[40%] h-[40%] rounded-full bg-[#fe0979]/5 blur-[120px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-[#18181b] bg-black/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              onClick={() => router.push("/dashboard")}
              className="h-8 w-8 rounded-lg bg-gradient-to-tr from-[#00f2fe] to-[#fe0979] flex items-center justify-center shadow-lg shadow-[#00f2fe]/10 cursor-pointer"
            >
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <span 
              onClick={() => router.push("/dashboard")}
              className="text-xl font-black tracking-wider cursor-pointer"
            >
              Tik<span className="bg-gradient-to-r from-[#00f2fe] to-[#fe0979] bg-clip-text text-transparent">Dash</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#121214] border border-[#222]">
              <User className="h-3.5 w-3.5 text-[#00f2fe]" />
              <span className="text-xs text-zinc-300 font-medium">{user.email}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-zinc-400 hover:text-white hover:bg-zinc-900 gap-2 h-9 rounded-xl transition-all duration-300"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8 relative z-10">
        
        {/* Error Banners or Sync Notices */}
        {oauthError === "oauth_failed" && (
          <div className="bg-[#fe0979]/10 border border-[#fe0979]/30 rounded-2xl p-4 text-sm text-[#fe0979] flex items-center gap-3 animate-pulse">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[#fe0979]" />
            <div>
              <span className="font-bold">Falha na Conexão OAuth:</span> Ocorreu um problema ao conectar com a API do TikTok. Verifique suas credenciais e permissões no console do desenvolvedor do TikTok e tente novamente.
            </div>
          </div>
        )}

        {syncStatus && (
          <div className={`${
            syncStatus.success 
              ? (syncStatus.limitedMetrics ? "bg-amber-500/10 border border-amber-500/30 text-amber-400" : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400")
              : "bg-[#fe0979]/10 border border-[#fe0979]/30 text-[#fe0979]"
          } rounded-2xl p-4 text-sm flex items-center gap-3 transition-all duration-300`}>
            {syncStatus.success ? (
              syncStatus.limitedMetrics ? (
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
              ) : (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              )
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0 text-[#fe0979]" />
            )}
            <div className="flex-1 font-semibold">{syncStatus.message}</div>
          </div>
        )}

        {account.hasTikTokToken && (
          <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-2xl p-4 text-xs text-zinc-400 flex items-start sm:items-center gap-3">
            <Sparkles className="h-4.5 w-4.5 text-cyan-400 shrink-0 mt-0.5 sm:mt-0 animate-pulse" />
            <div className="flex-1 leading-relaxed">
              <span className="font-bold text-zinc-200">TikTok Integrado:</span> Esta conta está devidamente sincronizada via API oficial do TikTok. Você pode usar a sincronização automática ou forçar a atualização a qualquer momento clicando no botão de sincronizar.
            </div>
            <div className="text-[10px] text-zinc-500 uppercase font-black tracking-widest bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full shrink-0">
              API Ativa
            </div>
          </div>
        )}

        {/* Aviso de escopo limitado */}
        {account.hasTikTokToken && (account.limitedMetrics || latestSnapshot?.followers === 0 || latestSnapshot?.followers === null) && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-sm text-amber-400 flex items-start gap-3 shadow-lg shadow-amber-500/5">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
            <div className="leading-relaxed">
              <span className="font-bold text-white block mb-1">Métricas limitadas — scope não aprovado pelo TikTok</span>
              <span className="text-zinc-300 block text-xs leading-normal">
                O TikDash continua operando graciosamente: você pode cadastrar manualmente as métricas diárias clicando no botão <strong className="text-white">&quot;Registrar Métricas Hoje&quot;</strong>.
              </span>
            </div>
          </div>
        )}

        {/* Breadcrumb Navigation & Back Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-zinc-500 font-bold uppercase tracking-wider">
              <span className="cursor-pointer hover:text-white transition-colors" onClick={() => router.push("/dashboard")}>Painel</span>
              <span>/</span>
              <span className="cursor-pointer hover:text-white transition-colors" onClick={() => router.push("/dashboard")}>Contas</span>
              <span>/</span>
              <span className="text-zinc-300">@{account.username}</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {account.displayName || account.username}
              </h1>
              <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full tracking-widest ${
                account.type === "real"
                  ? "bg-[#00f2fe]/10 text-[#00f2fe] border border-[#00f2fe]/20"
                  : "bg-[#fe0979]/10 text-[#fe0979] border border-[#fe0979]/20"
              }`}>
                {account.type === "real" ? "Conta Real" : "Conta Cópia"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard")}
              className="border-[#222] bg-[#121214] hover:bg-[#1a1a1f] text-zinc-300 hover:text-white rounded-xl text-xs gap-1.5 h-10 px-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Painel
            </Button>

            {/* Botoes de Integracao TikTok API */}
            {account.hasTikTokToken ? (
              <Button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="bg-black/40 hover:bg-black/60 border border-[#00f2fe]/30 hover:border-[#00f2fe]/60 backdrop-blur-md text-zinc-200 hover:text-white font-bold h-10 px-4 rounded-xl transition-all duration-300 flex items-center gap-2"
              >
                {syncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#00f2fe]" />
                ) : (
                  <RefreshCw className="h-4 w-4 text-[#00f2fe]" />
                )}
                Sincronizar TikTok
              </Button>
            ) : (
              <Button
                onClick={() => {
                  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";
                  window.location.href = `${apiUrl}/tiktok/connect/${accountId}`;
                }}
                className="bg-gradient-to-tr from-[#fe0979]/20 to-[#00f2fe]/20 hover:from-[#fe0979]/30 hover:to-[#00f2fe]/30 border border-[#fe0979]/40 hover:border-[#00f2fe]/40 text-white font-bold h-10 px-4 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg shadow-[#00f2fe]/5"
              >
                <Link className="h-4 w-4 text-[#00f2fe]" />
                Conectar TikTok
              </Button>
            )}

            <Button
              onClick={() => {
                resetMetricsForm();
                setIsMetricsOpen(true);
              }}
              className="bg-gradient-to-r from-[#00f2fe] to-[#fe0979] hover:opacity-90 active:scale-[0.98] text-white font-bold h-10 px-5 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg shadow-[#00f2fe]/5 border-none"
            >
              <TrendingUp className="h-4 w-4" />
              {todaySnapshot ? "Editar Métricas de Hoje" : "Registrar Métricas Hoje"}
            </Button>
          </div>
        </div>

        {/* 4 KPI Cards (Evolução / Último snapshot) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Seguidores */}
          <Card className="border-[#1e2025] bg-[#0c0c0e]/80 backdrop-blur-xl rounded-2xl overflow-hidden hover:border-[#333] transition-all duration-300 flex flex-col justify-between p-6">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Seguidores</span>
              <div className="p-2 rounded-xl bg-[#00f2fe]/10 border border-[#00f2fe]/20 text-[#00f2fe]">
                <User className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-black tracking-tight text-white">
                {latestSnapshot ? Number(latestSnapshot.followers).toLocaleString() : "0"}
              </div>
              <p className="text-[10px] text-zinc-500 font-bold mt-1 uppercase">
                {latestSnapshot ? `Última atualização: ${new Date(latestSnapshot.recordedAt).toLocaleDateString("pt-BR")}` : "Nenhum snapshot salvo"}
              </p>
            </div>
          </Card>

          {/* Card 2: Visualizações Totais */}
          <Card className="border-[#1e2025] bg-[#0c0c0e]/80 backdrop-blur-xl rounded-2xl overflow-hidden hover:border-[#333] transition-all duration-300 flex flex-col justify-between p-6">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Visualizações Totais</span>
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Eye className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-black tracking-tight text-white">
                {latestSnapshot ? Number(latestSnapshot.totalViews).toLocaleString() : "0"}
              </div>
              <p className="text-[10px] text-zinc-500 font-bold mt-1 uppercase">
                {latestSnapshot ? `Última atualização: ${new Date(latestSnapshot.recordedAt).toLocaleDateString("pt-BR")}` : "Nenhum snapshot salvo"}
              </p>
            </div>
          </Card>

          {/* Card 3: Curtidas Totais */}
          <Card className="border-[#1e2025] bg-[#0c0c0e]/80 backdrop-blur-xl rounded-2xl overflow-hidden hover:border-[#333] transition-all duration-300 flex flex-col justify-between p-6">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Curtidas Totais</span>
              <div className="p-2 rounded-xl bg-[#fe0979]/10 border border-[#fe0979]/20 text-[#fe0979]">
                <Heart className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-black tracking-tight text-white">
                {latestSnapshot ? Number(latestSnapshot.totalLikes).toLocaleString() : "0"}
              </div>
              <p className="text-[10px] text-zinc-500 font-bold mt-1 uppercase">
                {latestSnapshot ? `Última atualização: ${new Date(latestSnapshot.recordedAt).toLocaleDateString("pt-BR")}` : "Nenhum snapshot salvo"}
              </p>
            </div>
          </Card>

          {/* Card 4: Vídeos no TikTok */}
          <Card className="border-[#1e2025] bg-[#0c0c0e]/80 backdrop-blur-xl rounded-2xl overflow-hidden hover:border-[#333] transition-all duration-300 flex flex-col justify-between p-6">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Vídeos no TikTok</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Video className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-black tracking-tight text-white">
                {latestSnapshot ? Number(latestSnapshot.totalVideos).toLocaleString() : "0"}
              </div>
              <p className="text-[10px] text-zinc-500 font-bold mt-1 uppercase">
                {latestSnapshot ? `Última atualização: ${new Date(latestSnapshot.recordedAt).toLocaleDateString("pt-BR")}` : "Nenhum snapshot salvo"}
              </p>
            </div>
          </Card>
        </div>

        {/* Gráfico de Evolução (Seguidores ao Longo do Tempo) */}
        <Card className="border-[#1e2025] bg-[#0c0c0e]/80 backdrop-blur-xl rounded-2xl p-6">
          <CardHeader className="p-0 pb-6 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold tracking-tight text-zinc-200 flex items-center gap-2">
                <BarChart3 className="h-4.5 w-4.5 text-[#00f2fe]" />
                Evolução de Seguidores
              </CardTitle>
              <CardDescription className="text-zinc-500 text-xs">
                Histórico diário dos últimos 30 snapshots registrados no sistema.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {metricsLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#00f2fe]" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-[300px] flex flex-col items-center justify-center gap-3 border border-dashed border-[#222] rounded-xl text-center p-6 bg-[#070708]/30">
                <TrendingUp className="h-8 w-8 text-zinc-600" />
                <p className="text-zinc-400 text-sm font-semibold">Sem dados de histórico ainda</p>
                <p className="text-zinc-500 text-xs max-w-xs">
                  Comece a registrar as métricas da sua conta diariamente para acompanhar o crescimento no gráfico de linha neon.
                </p>
              </div>
            ) : (
              <div className="h-[300px] w-full pr-4">
                {isMounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorFollowers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#fe0979" stopOpacity={0} />
                        </linearGradient>
                        <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="5" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#16171b" />
                      <XAxis
                        dataKey="recordedAt"
                        tickFormatter={(str) => {
                          const date = new Date(str);
                          return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
                        }}
                        stroke="#4b5563"
                        fontSize={10}
                        fontWeight="bold"
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#4b5563"
                        fontSize={10}
                        fontWeight="bold"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => {
                          if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                          if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                          return val;
                        }}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#00f2fe", strokeWidth: 1, strokeDasharray: "4 4" }} />
                      <Line
                        type="monotone"
                        dataKey="followers"
                        stroke="url(#colorFollowers)"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "#00f2fe", strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: "#fe0979", strokeWidth: 0 }}
                        filter="url(#neonGlow)"
                      />
                      <Line
                        type="monotone"
                        dataKey="followers"
                        stroke="#00f2fe"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Seção de Controle de Vídeos */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-zinc-200 flex items-center gap-2">
                <Video className="h-5 w-5 text-[#fe0979]" />
                Controle de Postagem de Vídeos
              </h2>
              <p className="text-zinc-500 text-xs">
                Gerencie todos os vídeos agendados, ativos e removidos com suas estatísticas e links.
              </p>
            </div>
            <Button
              onClick={() => {
                resetVideoForm();
                setIsVideoModalOpen(true);
              }}
              className="bg-gradient-to-r from-purple-600 to-[#fe0979] hover:opacity-90 active:scale-[0.98] text-white font-bold h-10 px-4 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg shadow-purple-600/10 border-none"
            >
              <Plus className="h-4.5 w-4.5" />
              Adicionar Vídeo
            </Button>
          </div>

          {videosLoading ? (
            <div className="h-40 rounded-2xl bg-[#0c0c0e]/80 border border-[#1e2025] animate-pulse flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#fe0979]" />
            </div>
          ) : videosList.length === 0 ? (
            <Card className="border-[#18181b] bg-[#0c0c0e]/40 backdrop-blur-xl py-12 text-center rounded-2xl border-dashed">
              <CardHeader className="space-y-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#121214] border border-[#222]">
                  <Video className="h-6 w-6 text-zinc-500" />
                </div>
                <CardTitle className="text-lg text-zinc-300 font-bold">Nenhum vídeo cadastrado</CardTitle>
                <CardDescription className="text-zinc-500 max-w-sm mx-auto text-xs">
                  Adicione vídeos para monitorar a audiência de cada postagem e acompanhar o engajamento geral.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => setIsVideoModalOpen(true)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl h-10"
                >
                  Cadastrar Primeiro Vídeo
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="border border-[#1e2025] bg-[#0c0c0e]/80 backdrop-blur-xl rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto w-full">
                <Table className="w-full">
                  <TableHeader className="bg-[#12141c]/50 border-b border-[#1e2025]">
                    <TableRow className="hover:bg-transparent border-[#1e2025]">
                      <TableHead className="text-zinc-400 font-bold text-xs uppercase py-4 px-6">Vídeo</TableHead>
                      <TableHead className="text-zinc-400 font-bold text-xs uppercase py-4 px-6 text-center">Data</TableHead>
                      <TableHead className="text-zinc-400 font-bold text-xs uppercase py-4 px-6 text-center">Status</TableHead>
                      <TableHead className="text-zinc-400 font-bold text-xs uppercase py-4 px-6 text-right">Views</TableHead>
                      <TableHead className="text-zinc-400 font-bold text-xs uppercase py-4 px-6 text-right">Likes</TableHead>
                      <TableHead className="text-zinc-400 font-bold text-xs uppercase py-4 px-6 text-right">Comentários</TableHead>
                      <TableHead className="text-zinc-400 font-bold text-xs uppercase py-4 px-6 text-right">Shares</TableHead>
                      <TableHead className="text-zinc-400 font-bold text-xs uppercase py-4 px-6 text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {videosList.map((video) => (
                      <TableRow key={video.id} className="border-b border-[#16171b] hover:bg-[#12141c]/30 transition-colors">
                        <TableCell className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            {video.thumbnail ? (
                              <img 
                                src={video.thumbnail} 
                                alt="Thumb" 
                                className="h-10 w-10 object-cover rounded-lg border border-[#222] bg-zinc-900"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-zinc-900 border border-[#222] flex items-center justify-center text-zinc-500">
                                <Video className="h-4 w-4" />
                              </div>
                            )}
                            <div className="space-y-0.5">
                              <span className="font-semibold text-zinc-100 text-sm block max-w-xs truncate">
                                {video.title || "Sem título"}
                              </span>
                              {video.tiktokUrl && (
                                <a 
                                  href={video.tiktokUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-[#00f2fe] font-bold uppercase flex items-center gap-1 hover:underline w-fit"
                                >
                                  Ver no TikTok
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6 text-center text-zinc-300 text-xs">
                          {video.postedAt 
                            ? new Date(video.postedAt).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : "-"
                          }
                        </TableCell>
                        <TableCell className="py-4 px-6 text-center">
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider border ${
                            video.status === "active"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : video.status === "paused"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-red-500/10 text-red-400 border-red-500/20"
                          }`}>
                            {video.status === "active" ? "Ativo" : video.status === "paused" ? "Pausado" : "Removido"}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 px-6 text-right font-semibold text-zinc-100 text-xs">
                          {Number(video.views).toLocaleString()}
                        </TableCell>
                        <TableCell className="py-4 px-6 text-right font-semibold text-zinc-100 text-xs">
                          {Number(video.likes).toLocaleString()}
                        </TableCell>
                        <TableCell className="py-4 px-6 text-right text-zinc-400 text-xs">
                          {Number(video.comments).toLocaleString()}
                        </TableCell>
                        <TableCell className="py-4 px-6 text-right text-zinc-400 text-xs">
                          {Number(video.shares).toLocaleString()}
                        </TableCell>
                        <TableCell className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEditVideo(video)}
                              className="h-8 w-8 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setSelectedVideo(video);
                                setIsDeleteVideoOpen(true);
                              }}
                              className="h-8 w-8 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-red-950/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ================= MODALS & DIALOGS ================= */}

      {/* 1. RECORD SNAPSHOT DIALOG */}
      <Dialog open={isMetricsOpen} onOpenChange={setIsMetricsOpen}>
        <DialogContent className="bg-[#0c0c0e] border-[#222] text-white rounded-2xl max-w-md w-full p-6 font-sans">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#00f2fe]" />
              {todaySnapshot ? "Editar Métricas de Hoje" : "Registrar Métricas de Hoje"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs mt-1">
              {todaySnapshot 
                ? "Edite os valores do snapshot que você salvou hoje. Os gráficos e painéis serão atualizados automaticamente."
                : "Registre os números globais atuais da sua conta do TikTok. Seus dados de crescimento serão consolidados hoje."
              }
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleMetricsSubmit} className="space-y-4 pt-4">
            {metricsError && (
              <div className="p-3 text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg text-center">
                {metricsError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="followers" className="text-xs font-semibold text-zinc-400 uppercase">👥 Seguidores</Label>
                <Input
                  id="followers"
                  type="number"
                  placeholder="ex: 15400"
                  value={followers}
                  onChange={(e) => setFollowers(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                  min={0}
                  className="bg-[#121214] border-[#222] text-white focus:border-[#00f2fe] focus:ring-1 focus:ring-[#00f2fe]/20 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="totalVideos" className="text-xs font-semibold text-zinc-400 uppercase">🎬 Total Vídeos</Label>
                <Input
                  id="totalVideos"
                  type="number"
                  placeholder="ex: 42"
                  value={totalVideos}
                  onChange={(e) => setTotalVideos(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                  min={0}
                  className="bg-[#121214] border-[#222] text-white focus:border-[#00f2fe] focus:ring-1 focus:ring-[#00f2fe]/20 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="totalViews" className="text-xs font-semibold text-zinc-400 uppercase">👁️ Views Totais</Label>
                <Input
                  id="totalViews"
                  type="number"
                  placeholder="ex: 254890"
                  value={totalViews}
                  onChange={(e) => setTotalViews(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                  min={0}
                  className="bg-[#121214] border-[#222] text-white focus:border-[#00f2fe] focus:ring-1 focus:ring-[#00f2fe]/20 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="totalLikes" className="text-xs font-semibold text-zinc-400 uppercase">❤️ Curtidas Totais</Label>
                <Input
                  id="totalLikes"
                  type="number"
                  placeholder="ex: 45012"
                  value={totalLikes}
                  onChange={(e) => setTotalLikes(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                  min={0}
                  className="bg-[#121214] border-[#222] text-white focus:border-[#00f2fe] focus:ring-1 focus:ring-[#00f2fe]/20 rounded-xl"
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsMetricsOpen(false)}
                className="text-zinc-400 hover:text-white rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saveMetricsMutation.isPending}
                className="bg-gradient-to-r from-[#00f2fe] to-[#fe0979] hover:opacity-90 font-bold text-white rounded-xl px-6 h-10 border-none animate-all"
              >
                {saveMetricsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gravar Métricas"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. ADD/EDIT VIDEO DIALOG */}
      <Dialog open={isVideoModalOpen} onOpenChange={(open) => {
        setIsVideoModalOpen(open);
        if (!open) resetVideoForm();
      }}>
        <DialogContent className="bg-[#0c0c0e] border-[#222] text-white rounded-2xl max-w-lg w-full p-6 font-sans">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Video className="h-5 w-5 text-purple-400" />
              {selectedVideo ? "Editar Dados do Vídeo" : "Adicionar Vídeo Monitorado"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs mt-1">
              Registre ou modifique as estatísticas individuais do vídeo. Coloque a URL do TikTok para habilitar o atalho.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleVideoSubmit} className="space-y-4 pt-4">
            {videoError && (
              <div className="p-3 text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg text-center">
                {videoError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="videoTitle" className="text-xs font-semibold text-zinc-400 uppercase">Título ou Identificador</Label>
              <Input
                id="videoTitle"
                placeholder="ex: Review Completo de Tecnologia - Parte 1"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                required
                className="bg-[#121214] border-[#222] text-white focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="videoUrl" className="text-xs font-semibold text-zinc-400 uppercase">URL do Vídeo no TikTok</Label>
                <Input
                  id="videoUrl"
                  placeholder="https://tiktok.com/@..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="bg-[#121214] border-[#222] text-white focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="videoThumbnail" className="text-xs font-semibold text-zinc-400 uppercase">URL da Capa/Thumbnail</Label>
                <Input
                  id="videoThumbnail"
                  placeholder="Link direto de imagem (opcional)"
                  value={videoThumbnail}
                  onChange={(e) => setVideoThumbnail(e.target.value)}
                  className="bg-[#121214] border-[#222] text-white focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="videoPostedAt" className="text-xs font-semibold text-zinc-400 uppercase">Data e Hora de Postagem</Label>
                <Input
                  id="videoPostedAt"
                  type="datetime-local"
                  value={videoPostedAt}
                  onChange={(e) => setVideoPostedAt(e.target.value)}
                  required
                  className="bg-[#121214] border-[#222] text-white focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="videoStatus" className="text-xs font-semibold text-zinc-400 uppercase">Status do Vídeo</Label>
                <Select value={videoStatus} onValueChange={(val: "active" | "paused" | "removed" | null) => { if (val) setVideoStatus(val); }}>
                  <SelectTrigger className="bg-[#121214] border-[#222] text-white rounded-xl focus:ring-purple-400/20">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#121214] border-[#222] text-white rounded-xl">
                    <SelectItem value="active">🟢 Ativo (Visível)</SelectItem>
                    <SelectItem value="paused">🟡 Pausado/Privado</SelectItem>
                    <SelectItem value="removed">🔴 Removido/Deletado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t border-[#1a1c22] my-4 pt-3">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-3">Métricas de Engajamento</span>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="videoViews" className="text-xs font-semibold text-zinc-400 uppercase">👁️ Views</Label>
                  <Input
                    id="videoViews"
                    type="number"
                    placeholder="0"
                    value={videoViews}
                    onChange={(e) => setVideoViews(e.target.value === "" ? "" : Number(e.target.value))}
                    min={0}
                    className="bg-[#121214] border-[#222] text-white focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="videoLikes" className="text-xs font-semibold text-zinc-400 uppercase">❤️ Likes</Label>
                  <Input
                    id="videoLikes"
                    type="number"
                    placeholder="0"
                    value={videoLikes}
                    onChange={(e) => setVideoLikes(e.target.value === "" ? "" : Number(e.target.value))}
                    min={0}
                    className="bg-[#121214] border-[#222] text-white focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="videoComments" className="text-xs font-semibold text-zinc-400 uppercase">💬 Comentários</Label>
                  <Input
                    id="videoComments"
                    type="number"
                    placeholder="0"
                    value={videoComments}
                    onChange={(e) => setVideoComments(e.target.value === "" ? "" : Number(e.target.value))}
                    min={0}
                    className="bg-[#121214] border-[#222] text-white focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="videoShares" className="text-xs font-semibold text-zinc-400 uppercase">🔗 Shares</Label>
                  <Input
                    id="videoShares"
                    type="number"
                    placeholder="0"
                    value={videoShares}
                    onChange={(e) => setVideoShares(e.target.value === "" ? "" : Number(e.target.value))}
                    min={0}
                    className="bg-[#121214] border-[#222] text-white focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20 rounded-xl"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsVideoModalOpen(false)}
                className="text-zinc-400 hover:text-white rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saveVideoMutation.isPending}
                className="bg-purple-600 hover:bg-purple-500 font-bold text-white rounded-xl px-6 h-10 border-none"
              >
                {saveVideoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : selectedVideo ? "Salvar Vídeo" : "Adicionar Vídeo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3. CONFIRM DELETE VIDEO DIALOG */}
      <Dialog open={isDeleteVideoOpen} onOpenChange={setIsDeleteVideoOpen}>
        <DialogContent className="bg-[#0c0c0e] border-[#222] text-white rounded-2xl max-w-sm w-full p-6 font-sans">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Remover Vídeo?
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs mt-1">
              Tem certeza que deseja apagar o registro do vídeo <span className="text-red-400">&quot;{selectedVideo?.title}&quot;</span>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-4 flex items-center gap-2 justify-end">
            <Button
              variant="ghost"
              onClick={() => setIsDeleteVideoOpen(false)}
              className="text-zinc-400 hover:text-white rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => deleteVideoMutation.mutate(selectedVideo!.id)}
              disabled={deleteVideoMutation.isPending}
              className="bg-red-600 hover:bg-red-500 font-bold text-white rounded-xl px-6 h-10 border-none"
            >
              {deleteVideoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sim, Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
