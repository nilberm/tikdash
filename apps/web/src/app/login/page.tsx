"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Mail, Sparkles, Loader2, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await signIn.email({
        email,
        password,
        callbackURL: "/dashboard"
      });
      if (res?.error) {
        setError(res.error.message || "Credenciais inválidas");
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ocorreu um erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-black overflow-hidden font-sans">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#00f2fe]/10 blur-[120px] pointer-events-none animate-pulse duration-[6000ms]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#fe0979]/10 blur-[120px] pointer-events-none animate-pulse duration-[8000ms]" />

      <div className="relative z-10 w-full max-w-md p-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
        <Card className="border-[#222] bg-[#0c0c0e]/80 backdrop-blur-xl shadow-[0_0_50px_rgba(0,242,254,0.05)] rounded-2xl overflow-hidden">
          {/* Top Neon Border Line */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#00f2fe] via-purple-600 to-[#fe0979]" />

          <CardHeader className="space-y-2 pt-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#121214] border border-[#222]">
              <Sparkles className="h-6 w-6 text-[#00f2fe] animate-pulse" />
            </div>
            <CardTitle className="text-3xl font-extrabold tracking-tight text-white mt-4">
              Tik<span className="bg-gradient-to-r from-[#00f2fe] to-[#fe0979] bg-clip-text text-transparent">Dash</span>
            </CardTitle>
            <CardDescription className="text-zinc-400 text-sm">
              Gerencie suas múltiplas contas TikTok em um só lugar
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 px-6 pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg text-center font-medium animate-in shake duration-300">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  E-mail
                </Label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3 h-4.5 w-4.5 text-zinc-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="voce@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="pl-10 bg-[#121214] border-[#222] text-white focus:border-[#00f2fe] focus:ring-1 focus:ring-[#00f2fe]/20 rounded-xl transition-all duration-300 h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Senha
                </Label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 h-4.5 w-4.5 text-zinc-500" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pl-10 pr-10 bg-[#121214] border-[#222] text-white focus:border-[#fe0979] focus:ring-1 focus:ring-[#fe0979]/20 rounded-xl transition-all duration-300 h-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    className="absolute right-3 text-zinc-500 hover:text-white transition-colors p-1"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4.5 w-4.5" />
                    ) : (
                      <Eye className="h-4.5 w-4.5" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-to-r from-[#00f2fe] to-[#fe0979] hover:opacity-90 active:scale-[0.98] text-white font-bold transition-all duration-300 rounded-xl border-none shadow-[0_4px_20px_rgba(0,242,254,0.15)] flex items-center justify-center gap-2 mt-6"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Acessar Dashboard"
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="pb-8 pt-4 justify-center">
            <p className="text-xs text-zinc-500">
              Protegido com criptografia de ponta a ponta
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
