import Link from "next/link";
import { Crown, Library, GitBranch, CloudUpload, Cpu, Target, LineChart } from "lucide-react";
import { RepertoirePreview } from "@/components/repertoire-preview";

const features = [
  { icon: Library, title: "Build repertoires", description: "Organize your openings into branching repertoires you can study line by line." },
  { icon: GitBranch, title: "Variation trees", description: "Keep main lines and sidelines together, with a clear path back to each position." },
  { icon: CloudUpload, title: "Cloud sync", description: "Save your openings and variations to your account and return to your library across devices." },
];
const planned = [
  { icon: Cpu, title: "Engine analysis", description: "Position evaluations and best-move suggestions." },
  { icon: Target, title: "Spaced practice", description: "Repetition focused on the moves you keep forgetting." },
  { icon: LineChart, title: "Progress stats", description: "Accuracy, weak spots, and study time." },
];

export default function Page() {
  return (
    <div className="site-container">
      <header className="site-nav">
        <Link href="/" className="wordmark"><Crown size={24} />Chess Library</Link>
        <nav aria-label="Main navigation"><a href="#features">Features</a><a href="#how">How it works</a><a href="#pricing">Getting started</a></nav>
        <div className="site-actions"><Link href="/login">Log in</Link><Link href="/signup" className="primary-action">Sign up</Link></div>
      </header>
      <main id="main-content">
        <section className="home-hero">
          <div><h1>Your openings.<br />Every line, together.</h1><p>Build, study, and save your chess opening repertoire in one place.</p><div className="hero-actions"><Link className="primary-action" href="/signup">Start building</Link><a className="quiet-action" href="#board-preview">See the board</a></div></div>
          <RepertoirePreview />
        </section>
        <section className="home-section" id="features"><h2>A library built around your board.</h2><div className="feature-grid">{features.map(({icon: Icon, title, description}) => <article className="feature-item" key={title}><Icon size={26} strokeWidth={1.5} /><h3>{title}</h3><p>{description}</p></article>)}</div></section>
        <section className="home-section" id="how"><h2>From first move to saved repertoire.</h2><div className="workflow"><article><h3>Create an opening</h3><p>Name an opening and give your repertoire a place to begin.</p></article><article><h3>Explore the line</h3><p>Play moves, revisit positions, and branch into conditional lines.</p></article><article><h3>Save your variations</h3><p>Name each variation and find it again in your library tree.</p></article></div></section>
        <section className="home-section"><h2>More study tools, still to come.</h2><div className="feature-grid">{planned.map(({icon: Icon, title, description}) => <article className="feature-item" key={title}><Icon size={26} strokeWidth={1.5} /><h3>{title}</h3><p>{description}</p><p className="availability">Not available yet</p></article>)}</div></section>
        <section className="home-section start-section" id="pricing"><div><h2>Give your openings a home.</h2><p>Create an account to start building your repertoire.</p></div><Link href="/signup" className="primary-action">Create your library</Link></section>
      </main>
      <footer className="site-footer"><Link className="wordmark" href="/"><Crown size={20} />Chess Library</Link><p>© {new Date().getFullYear()} Chess Library. All rights reserved.</p></footer>
    </div>
  );
}
