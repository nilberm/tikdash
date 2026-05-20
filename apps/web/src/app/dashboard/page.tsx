"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  Plus, Trash2, Edit3, Key, LogOut, Loader2, Sparkles, User, Mail, 
  Copy, Check, ShieldAlert, ShieldCheck, Eye, EyeOff
} from "lucide-react";

interface TikTokAccount {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  type: "real" | "copia";
  isActive: boolean;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: sessionData, isPending: sessionLoading } = useSession();
  const user = sessionData?.user;

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isRevealOpen, setIsRevealOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Form states
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [type, setType] = useState<"real" | "copia">("real");

  // Selected account for edit/delete/reveal
  const [selectedAccount, setSelectedAccount] = useState<TikTokAccount | null>(null);

  // Reveal password state
  const [userPassword, setUserPassword] = useState("");
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [revealError, setRevealError] = useState("");
  const [copied, setCopied] = useState(false);

  // TikTok Password visibility states
  const [showTikTokPassword, setShowTikTokPassword] = useState(false);
  const [showEditTikTokPassword, setShowEditTikTokPassword] = useState(false);

  // Mutation error states
  const [addError, setAddError] = useState("");
  const [editError, setEditError] = useState("");

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!sessionLoading && !user) {
      router.push("/login");
    }
  }, [user, sessionLoading, router]);

  // Fetch accounts query
  const { data: accounts = [], isLoading: accountsLoading } = useQuery<TikTokAccount[]>({
    queryKey: ["accounts"],
    queryFn: () => apiRequest("/accounts"),
    enabled: !!user,
  });

  // Add account mutation
  const addMutation = useMutation({
    mutationFn: (newAcc: { username: string; displayName?: string; email?: string; password?: string; type: "real" | "copia" }) => apiRequest("/accounts", {
      method: "POST",
      body: JSON.stringify(newAcc),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setIsAddOpen(false);
      resetAddForm();
    },
    onError: (err: Error) => {
      setAddError(err.message || "Erro ao adicionar conta");
    }
  });

  // Edit account mutation
  const editMutation = useMutation({
    mutationFn: (updatedAcc: { username: string; displayName?: string; email?: string; password?: string; type: "real" | "copia" }) => apiRequest(`/accounts/${selectedAccount?.id}`, {
      method: "PUT",
      body: JSON.stringify(updatedAcc),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setIsEditOpen(false);
      setSelectedAccount(null);
    },
    onError: (err: Error) => {
      setEditError(err.message || "Erro ao editar conta");
    }
  });

  // Delete account mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/accounts/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setIsDeleteOpen(false);
      setSelectedAccount(null);
    }
  });

  // Reveal password mutation
  const revealMutation = useMutation({
    mutationFn: (creds: { userPassword: string }) => apiRequest(`/accounts/${selectedAccount?.id}/reveal`, {
      method: "POST",
      body: JSON.stringify(creds),
    }),
    onSuccess: (data: { password: string }) => {
      setRevealedPassword(data.password);
      setRevealError("");
    },
    onError: (err: Error) => {
      setRevealError(err.message || "Senha incorreta ou erro de descriptografia");
      setRevealedPassword(null);
    }
  });

  const resetAddForm = () => {
    setUsername("");
    setDisplayName("");
    setEmail("");
    setPassword("");
    setType("real");
    setAddError("");
    setShowTikTokPassword(false);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    addMutation.mutate({ username, displayName, email, password, type });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError("");
    editMutation.mutate({ username, displayName, email, password: password || undefined, type });
  };

  const handleRevealSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRevealError("");
    revealMutation.mutate({ userPassword });
  };

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (sessionLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#00f2fe]" />
          <p className="text-zinc-400 text-sm">Carregando painel de segurança...</p>
        </div>
      </div>
    );
  }

  // Quick stats
  const totalAccounts = accounts.length;
  const realAccounts = accounts.filter(a => a.type === "real").length;
  const copiaAccounts = accounts.filter(a => a.type === "copia").length;

  return (
    <div className="min-h-screen bg-[#070708] text-white font-sans selection:bg-[#00f2fe]/30 pb-16">
      {/* Glow Effects */}
      <div className="absolute top-0 right-0 w-[40%] h-[40%] rounded-full bg-[#00f2fe]/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[40%] h-[40%] rounded-full bg-[#fe0979]/5 blur-[120px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-[#18181b] bg-black/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-[#00f2fe] to-[#fe0979] flex items-center justify-center shadow-lg shadow-[#00f2fe]/10">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-xl font-black tracking-wider">
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
        
        {/* Welcome & Stats Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-[#0f1115] to-[#0a0a0c] border border-[#1e2025] p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Olá, <span className="bg-gradient-to-r from-[#00f2fe] to-purple-400 bg-clip-text text-transparent">Bem-vindo</span>
            </h1>
            <p className="text-zinc-400 text-sm">
              Gerencie suas credenciais e visualize o status de suas contas TikTok com segurança militar.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="text-center px-4 py-2 bg-[#12141a]/60 border border-[#20232a] rounded-xl min-w-24">
              <div className="text-2xl font-black text-[#00f2fe]">{totalAccounts}</div>
              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Contas</div>
            </div>
            <div className="text-center px-4 py-2 bg-[#12141a]/60 border border-[#20232a] rounded-xl min-w-24">
              <div className="text-2xl font-black text-purple-400">{realAccounts}</div>
              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Reais</div>
            </div>
            <div className="text-center px-4 py-2 bg-[#12141a]/60 border border-[#20232a] rounded-xl min-w-24">
              <div className="text-2xl font-black text-[#fe0979]">{copiaAccounts}</div>
              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Cópia</div>
            </div>
          </div>
        </div>

        {/* Action Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-zinc-200">
            Contas TikTok Cadastradas
          </h2>
          <Button 
            onClick={() => { resetAddForm(); setIsAddOpen(true); }}
            className="bg-gradient-to-r from-[#00f2fe] to-[#fe0979] hover:opacity-90 active:scale-[0.98] text-white font-bold h-10 px-4 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg shadow-[#00f2fe]/5 border-none"
          >
            <Plus className="h-4.5 w-4.5" />
            Nova Conta
          </Button>
        </div>

        {/* Accounts List Section */}
        {accountsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-2xl bg-[#0f1115] border border-[#1e2025] animate-pulse" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <Card className="border-[#18181b] bg-[#0c0c0e]/40 backdrop-blur-xl py-12 text-center rounded-2xl border-dashed">
            <CardHeader className="space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#121214] border border-[#222]">
                <ShieldAlert className="h-6 w-6 text-zinc-500" />
              </div>
              <CardTitle className="text-lg text-zinc-300 font-bold">Nenhuma conta cadastrada</CardTitle>
              <CardDescription className="text-zinc-500 max-w-sm mx-auto text-xs">
                Registre sua primeira conta TikTok. A senha fornecida será criptografada e armazenada de forma 100% segura.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setIsAddOpen(true)}
                className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl h-10"
              >
                Cadastrar TikTok
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accounts.map((account) => (
              <Card 
                key={account.id} 
                className="border-[#1e2025] bg-[#0c0c0e]/80 hover:bg-[#101217] backdrop-blur-xl shadow-lg rounded-2xl overflow-hidden hover:border-[#333] transition-all duration-300 group flex flex-col justify-between"
              >
                <div onClick={() => router.push(`/accounts/${account.id}`)} className="cursor-pointer">
                  <div className="h-1 w-full bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-500 from-[#00f2fe] to-[#fe0979]" />
                  <CardHeader className="pb-3 flex flex-row items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-lg tracking-tight">
                          {account.displayName || account.username}
                        </span>
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider ${
                          account.type === "real" 
                            ? "bg-[#00f2fe]/10 text-[#00f2fe] border border-[#00f2fe]/20" 
                            : "bg-[#fe0979]/10 text-[#fe0979] border border-[#fe0979]/20"
                        }`}>
                          {account.type === "real" ? "Real" : "Cópia"}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 font-medium">@{account.username}</p>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 pb-6 text-sm text-zinc-400">
                    {account.email && (
                      <div className="flex items-center gap-2 text-xs">
                        <Mail className="h-3.5 w-3.5 text-zinc-600" />
                        <span className="truncate">{account.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Criptografado AES-256</span>
                    </div>
                  </CardContent>
                </div>

                <div className="border-t border-[#1a1c22] px-6 py-4 flex items-center justify-between bg-[#0e1014]/40 rounded-b-2xl">
                  {/* Password Reveal Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedAccount(account);
                      setUserPassword("");
                      setRevealedPassword(null);
                      setRevealError("");
                      setIsRevealOpen(true);
                    }}
                    className="border-[#222] bg-[#121214] hover:bg-[#1a1a1f] text-[#00f2fe] hover:text-[#00f2fe] rounded-xl text-xs gap-1.5 h-8.5"
                  >
                    <Key className="h-3.5 w-3.5" />
                    Ver Senha
                  </Button>

                  {/* Actions (Edit / Delete) */}
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setSelectedAccount(account);
                        setUsername(account.username);
                        setDisplayName(account.displayName || "");
                        setEmail(account.email || "");
                        setPassword("");
                        setType(account.type);
                        setEditError("");
                        setShowEditTikTokPassword(false);
                        setIsEditOpen(true);
                      }}
                      className="h-8.5 w-8.5 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setSelectedAccount(account);
                        setIsDeleteOpen(true);
                      }}
                      className="h-8.5 w-8.5 text-zinc-400 hover:text-red-400 rounded-xl hover:bg-red-950/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* ================= MODALS & DIALOGS ================= */}

      {/* 1. ADD ACCOUNT DIALOG */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-[#0c0c0e] border-[#222] text-white rounded-2xl max-w-md w-full p-6 font-sans">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#00f2fe]" />
              Cadastrar Conta TikTok
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs mt-1">
              Forneça os detalhes da conta do TikTok. Armazenamos senhas sob forte criptografia reversível.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddSubmit} className="space-y-4 pt-4">
            {addError && (
              <div className="p-3 text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg text-center">
                {addError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs font-semibold text-zinc-400 uppercase">Username (sem @)</Label>
              <Input
                id="username"
                placeholder="ex: gabriel_tiktok"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="bg-[#121214] border-[#222] text-white focus:border-[#00f2fe] focus:ring-1 focus:ring-[#00f2fe]/20 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="displayName" className="text-xs font-semibold text-zinc-400 uppercase">Nome de Exibição</Label>
              <Input
                id="displayName"
                placeholder="ex: Gabriel Nunes"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-[#121214] border-[#222] text-white focus:border-[#00f2fe] focus:ring-1 focus:ring-[#00f2fe]/20 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-zinc-400 uppercase">E-mail Vinculado</Label>
              <Input
                id="email"
                type="email"
                placeholder="ex: gabriel@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#121214] border-[#222] text-white focus:border-[#00f2fe] focus:ring-1 focus:ring-[#00f2fe]/20 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-zinc-400 uppercase">Senha da Conta</Label>
              <div className="relative flex items-center">
                <Input
                  id="password"
                  type={showTikTokPassword ? "text" : "password"}
                  placeholder="Senha de login do TikTok"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10 bg-[#121214] border-[#222] text-white focus:border-[#00f2fe] focus:ring-1 focus:ring-[#00f2fe]/20 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowTikTokPassword(!showTikTokPassword)}
                  className="absolute right-3 text-zinc-500 hover:text-white transition-colors p-1"
                >
                  {showTikTokPassword ? (
                    <EyeOff className="h-4.5 w-4.5" />
                  ) : (
                    <Eye className="h-4.5 w-4.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="type" className="text-xs font-semibold text-zinc-400 uppercase">Tipo da Conta</Label>
              <Select value={type} onValueChange={(val: "real" | "copia" | null) => { if (val) setType(val); }}>
                <SelectTrigger className="bg-[#121214] border-[#222] text-white rounded-xl focus:ring-[#00f2fe]/20">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent className="bg-[#121214] border-[#222] text-white rounded-xl">
                  <SelectItem value="real" className="hover:bg-zinc-800 focus:bg-zinc-800">Conta Real (Principal)</SelectItem>
                  <SelectItem value="copia" className="hover:bg-zinc-800 focus:bg-zinc-800">Conta Cópia (Backup/Estrutura)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsAddOpen(false)}
                className="text-zinc-400 hover:text-white rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={addMutation.isPending}
                className="bg-gradient-to-r from-[#00f2fe] to-[#fe0979] hover:opacity-90 font-bold text-white rounded-xl px-6 h-10 border-none"
              >
                {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar Conta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. EDIT ACCOUNT DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-[#0c0c0e] border-[#222] text-white rounded-2xl max-w-md w-full p-6 font-sans">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-purple-400" />
              Editar Conta TikTok
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs mt-1">
              Atualize as informações da conta. Deixe a senha em branco se não desejar alterá-la.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
            {editError && (
              <div className="p-3 text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg text-center">
                {editError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="edit-username" className="text-xs font-semibold text-zinc-400 uppercase">Username</Label>
              <Input
                id="edit-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="bg-[#121214] border-[#222] text-white focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-displayName" className="text-xs font-semibold text-zinc-400 uppercase">Nome de Exibição</Label>
              <Input
                id="edit-displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-[#121214] border-[#222] text-white focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-email" className="text-xs font-semibold text-zinc-400 uppercase">E-mail</Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#121214] border-[#222] text-white focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-password" className="text-xs font-semibold text-zinc-400 uppercase">Nova Senha (opcional)</Label>
              <div className="relative flex items-center">
                <Input
                  id="edit-password"
                  type={showEditTikTokPassword ? "text" : "password"}
                  placeholder="Deixe em branco para manter a atual"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10 bg-[#121214] border-[#222] text-white focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowEditTikTokPassword(!showEditTikTokPassword)}
                  className="absolute right-3 text-zinc-500 hover:text-white transition-colors p-1"
                >
                  {showEditTikTokPassword ? (
                    <EyeOff className="h-4.5 w-4.5" />
                  ) : (
                    <Eye className="h-4.5 w-4.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-type" className="text-xs font-semibold text-zinc-400 uppercase">Tipo da Conta</Label>
              <Select value={type} onValueChange={(val: "real" | "copia" | null) => { if (val) setType(val); }}>
                <SelectTrigger className="bg-[#121214] border-[#222] text-white rounded-xl focus:ring-purple-400/20">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent className="bg-[#121214] border-[#222] text-white rounded-xl">
                  <SelectItem value="real">Conta Real (Principal)</SelectItem>
                  <SelectItem value="copia">Conta Cópia (Backup/Estrutura)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsEditOpen(false)}
                className="text-zinc-400 hover:text-white rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={editMutation.isPending}
                className="bg-purple-600 hover:bg-purple-500 font-bold text-white rounded-xl px-6 h-10 border-none"
              >
                {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3. REVEAL PASSWORD DIALOG */}
      <Dialog open={isRevealOpen} onOpenChange={setIsRevealOpen}>
        <DialogContent className="bg-[#0c0c0e] border-[#222] text-white rounded-2xl max-w-sm w-full p-6 font-sans">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Key className="h-5 w-5 text-[#00f2fe]" />
              Verificar Identidade
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs mt-1">
              Para revelar a senha da conta <span className="text-[#00f2fe]">@{selectedAccount?.username}</span>, confirme a sua senha mestra de acesso ao painel.
            </DialogDescription>
          </DialogHeader>

          {revealedPassword ? (
            <div className="space-y-4 pt-4">
              <div className="p-4 bg-[#12141c] border border-[#202535] rounded-xl flex flex-col items-center justify-center gap-2 animate-in zoom-in-95 duration-200">
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Senha do TikTok</span>
                <span className="text-2xl font-black text-white select-all select-text font-mono tracking-wide px-3 py-1 bg-black/40 rounded-lg border border-[#222] min-w-full text-center truncate">
                  {revealedPassword}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => copyToClipboard(revealedPassword)}
                  className="flex-1 bg-gradient-to-r from-[#00f2fe] to-purple-600 font-bold text-white rounded-xl gap-2 h-10 border-none"
                >
                  {copied ? <Check className="h-4.5 w-4.5 text-emerald-400" /> : <Copy className="h-4.5 w-4.5" />}
                  {copied ? "Copiado!" : "Copiar Senha"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsRevealOpen(false)}
                  className="border-[#222] bg-[#121214] hover:bg-[#1a1a1f] text-white hover:text-white rounded-xl h-10 px-4"
                >
                  Fechar
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRevealSubmit} className="space-y-4 pt-4">
              {revealError && (
                <div className="p-3 text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg text-center font-medium">
                  {revealError}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="master-password" className="text-xs font-semibold text-zinc-400 uppercase">Sua Senha do Painel</Label>
                <Input
                  id="master-password"
                  type="password"
                  placeholder="Sua senha mestra"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  required
                  autoFocus
                  className="bg-[#121214] border-[#222] text-white focus:border-[#00f2fe] focus:ring-1 focus:ring-[#00f2fe]/20 rounded-xl"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsRevealOpen(false)}
                  className="text-zinc-400 hover:text-white rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={revealMutation.isPending}
                  className="bg-[#00f2fe] hover:bg-[#00f2fe]/95 hover:opacity-90 font-bold text-black rounded-xl px-6 h-10 border-none"
                >
                  {revealMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin text-black" /> : "Confirmar"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 4. DELETE ACCOUNT DIALOG */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-[#0c0c0e] border-[#222] text-white rounded-2xl max-w-sm w-full p-6 font-sans">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              Excluir Conta?
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs mt-1">
              Tem certeza que deseja excluir permanentemente a conta <span className="text-red-400">@{selectedAccount?.username}</span>? Esta ação é irreversível e apagará as credenciais.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-4 flex items-center gap-2 justify-end">
            <Button
              variant="ghost"
              onClick={() => setIsDeleteOpen(false)}
              className="text-zinc-400 hover:text-white rounded-xl"
            >
              Não, manter
            </Button>
            <Button
              onClick={() => deleteMutation.mutate(selectedAccount!.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-500 font-bold text-white rounded-xl px-6 h-10 border-none"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sim, Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
