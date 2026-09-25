import Image from "next/image"
import Link from "next/link"
import {
  Crown,
  Play,
  Star,
  Users,
  Library,
  Cpu,
  CloudUpload,
  GitBranch,
  Target,
  LineChart,
} from "lucide-react"

const features = [
  {
    icon: Library,
    title: "Build Repertoires",
    description:
      "Organize your openings into clean, branching repertoires you can study line by line.",
  },
  {
    icon: Cpu,
    title: "Engine Analysis",
    description:
      "Get instant evaluations and the best moves from a powerful engine on every position.",
  },
  {
    icon: GitBranch,
    title: "Variation Trees",
    description:
      "Visualize every line and sideline in a tree so you never lose track of an idea.",
  },
  {
    icon: Target,
    title: "Spaced Practice",
    description:
      "Drill your lines with smart repetition that focuses on the moves you keep forgetting.",
  },
  {
    icon: LineChart,
    title: "Progress Stats",
    description:
      "Track accuracy, weak spots, and study time with simple, clear charts.",
  },
  {
    icon: CloudUpload,
    title: "Cloud Sync",
    description:
      "Your entire library stays in sync across every device, automatically and securely.",
  },
]

export default function Page() {
  return (
    <div className="min-h-screen bg-[#21201d] text-zinc-100 antialiased selection:bg-[#81b64c]/30">
      
      {/* Very subtle background texture, no cheap neon glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.03)_0%,rgba(0,0,0,0.4)_100%)]" />
      </div>

      <div className="relative">
        {/* ============ NAVIGATION ============ */}
        <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            {/* Clean, flat logo - no glowing shadows */}
            <span className="flex h-8 w-8 items-center justify-center rounded bg-[#81b64c] text-white">
              <Crown className="h-5 w-5" />
            </span>
            <span className="text-xl font-bold tracking-tight text-white">
              Chess Library
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-400 md:flex">
            <a href="#features" className="transition-colors hover:text-white">
              Features
            </a>
            <a href="#how" className="transition-colors hover:text-white">
              How it works
            </a>
            <a href="#pricing" className="transition-colors hover:text-white">
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link 
              href="/login" 
              className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              Log In
            </Link>
            {/* Flat, solid button matching the classic chess aesthetic */}
            <Link 
              href="/signup" 
              className="rounded-lg bg-[#81b64c] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#8bc255]"
            >
              Sign Up
            </Link>
          </div>
        </header>

        {/* ============ HERO ============ */}
        <section className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-6 pb-24 pt-12 lg:grid-cols-2 lg:gap-10 lg:px-8 lg:pt-20">
          {/* Left: text */}
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300">
              <span className="h-2 w-2 rounded-full bg-[#81b64c]" />
              Your personal opening lab
            </span>

            <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Master your repertoire with a tool built{" "}
              <span className="text-[#81b64c]">
                just for you.
              </span>
            </h1>

            <p className="mt-6 text-pretty text-lg leading-relaxed text-zinc-400">
              Chess Library helps you build, study, and analyze your openings in
              one place. Save your best lines, let the engine check your ideas,
              and practice until they stick.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link 
                href="/signup" 
                className="inline-flex items-center justify-center rounded-xl bg-[#81b64c] px-8 py-3.5 text-base font-bold text-white transition-colors hover:bg-[#8bc255]"
              >
                Start Building Free
              </Link>
              <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 px-8 py-3.5 text-base font-semibold text-zinc-200 transition-colors hover:bg-white/10">
                <Play className="h-4 w-4 text-[#81b64c]" fill="currentColor" />
                See the board
              </button>
            </div>

            {/* Social proof */}
            <div className="mt-10 flex items-center gap-8">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-zinc-500" />
                <span className="text-sm text-zinc-400">
                  <span className="font-bold text-white">50k+</span> players
                </span>
              </div>
              <div className="h-6 w-px bg-white/10" />
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-[#81b64c]" fill="currentColor" />
                <span className="text-sm text-zinc-400">
                  <span className="font-bold text-white">4.9/5</span> rating
                </span>
              </div>
            </div>
          </div>

          {/* Right: visual */}
          <div className="relative">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#262421] p-2 shadow-2xl">
              <div className="relative overflow-hidden rounded-xl border border-white/5 bg-black">
                <Image
                  src="/chess-board-3d.png"
                  alt="A 3D chess board with pieces set up for analysis"
                  width={720}
                  height={720}
                  priority
                  className="h-auto w-full object-cover opacity-90"
                />
              </div>
            </div>

            {/* Floating status card - Flat design */}
            <div className="absolute -bottom-6 left-6 flex items-center gap-4 rounded-xl border border-white/10 bg-[#262421] px-5 py-4 shadow-xl sm:left-10">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#81b64c] opacity-40" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-[#81b64c]" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Analyzing
                </p>
                <p className="text-sm font-semibold text-white mt-0.5">
                  Sicilian Defense
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============ FEATURES ============ */}
        <section id="features" className="mx-auto max-w-7xl px-6 pb-28 pt-8 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
              A complete chess study studio
            </h2>
            <p className="mt-4 text-pretty text-zinc-400">
              Everything you need to turn scattered notes into a sharp,
              well-drilled repertoire.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-colors hover:bg-white/[0.04]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-[#81b64c]">
                  <feature.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ============ FOOTER ============ */}
        <footer className="border-t border-white/5 mt-10">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-zinc-500 sm:flex-row lg:px-8">
            <div className="flex items-center gap-2 text-zinc-400">
              <Crown className="h-4 w-4 text-zinc-500" />
              <span className="font-semibold text-zinc-300">Chess Library</span>
            </div>
            <p>© {new Date().getFullYear()} Chess Library. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  )
}