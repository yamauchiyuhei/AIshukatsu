import { motion } from 'framer-motion';
import { FolderOpen, Sparkles } from 'lucide-react';
import { Particles } from './ui/Particles';
import { ShimmerButton } from './ui/ShimmerButton';
import { AuroraText } from './ui/AuroraText';

interface Props {
  needsPermission: boolean;
  onPick: () => void;
  onRequestPermission: () => void;
}

/**
 * Empty-state / first-launch hero. Dark backdrop with Canvas particles and
 * a shimmer CTA so the app feels alive before any file has been opened.
 */
export function WelcomeScreen({
  needsPermission,
  onPick,
  onRequestPermission,
}: Props) {
  return (
    <div className="relative flex h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 text-slate-100">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -left-32 top-1/4 h-72 w-72 rounded-full bg-indigo-500/25 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-[120px]" />
      {/* Dot grid mask */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:22px_22px] opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
      <Particles quantity={50} color="#ffffff" />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 max-w-xl text-center"
      >
        <div className="mx-auto mb-4 h-24 w-24">
          <img
            src="/logo.png"
            alt="AI就活"
            className="h-full w-full rounded-2xl object-contain shadow-[0_0_60px_rgba(129,140,248,0.4)]"
          />
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 backdrop-blur-sm">
          <Sparkles size={12} className="text-fuchsia-300" />
          Local-first / AI-ready
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          <AuroraText>就活を、ここから始めよう。</AuroraText>
        </h1>
        <p className="mt-4 text-slate-300">
          ローカルの Markdown ファイルで就活情報を管理する、
          <br className="hidden sm:inline" />
          AI フレンドリーなワークスペース。
        </p>
        <p className="mt-1 text-sm text-slate-400">
          1 企業 = 1 フォルダ。データはあなたの PC に残り、AI にそのまま渡せます。
        </p>

        <div className="mt-10 flex flex-col items-center gap-3">
          {needsPermission ? (
            <>
              <p className="text-sm text-amber-300">
                前回選択したフォルダへのアクセス許可が必要です。
              </p>
              <ShimmerButton onClick={onRequestPermission} className="px-6 py-3">
                <FolderOpen size={18} />
                フォルダへのアクセスを許可
              </ShimmerButton>
              <button
                onClick={onPick}
                className="text-sm text-slate-400 underline underline-offset-4 transition hover:text-white"
              >
                別のフォルダを選択
              </button>
            </>
          ) : (
            <ShimmerButton onClick={onPick} className="px-6 py-3">
              <FolderOpen size={18} />
              就活フォルダを選択
            </ShimmerButton>
          )}
        </div>

        <p className="mt-8 text-xs text-slate-500">
          ※ Chrome / Edge など Chromium 系ブラウザで動作します。
        </p>
      </motion.div>
    </div>
  );
}
