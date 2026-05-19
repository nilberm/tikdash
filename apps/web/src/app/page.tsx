"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Loader2, Sparkles } from "lucide-react";

export default function IndexPage() {
  const router = useRouter();
  const { data: sessionData, isPending } = useSession();

  useEffect(() => {
    if (!isPending) {
      if (sessionData?.user) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    }
  }, [sessionData, isPending, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black font-sans">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#00f2fe] to-[#fe0979] flex items-center justify-center shadow-lg shadow-[#00f2fe]/20">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <span className="text-2xl font-black tracking-widest text-white mt-2">
          Tik<span className="bg-gradient-to-r from-[#00f2fe] to-[#fe0979] bg-clip-text text-transparent">Dash</span>
        </span>
        <Loader2 className="h-5 w-5 animate-spin text-zinc-500 mt-4" />
      </div>
    </div>
  );
}
