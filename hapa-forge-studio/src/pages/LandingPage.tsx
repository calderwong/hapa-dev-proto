import React from 'react';
import { Link } from 'react-router-dom';

const Card: React.FC<{ title: string; description: string; to: string }> = ({
  title,
  description,
  to,
}) => {
  return (
    <Link
      to={to}
      className="glass-panel holo-border block p-6 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
    >
      <div className="font-orbitron text-lg text-white mb-2">{title}</div>
      <div className="text-slate-300 text-sm leading-relaxed">{description}</div>
      <div className="mt-4 text-xs font-mono text-hapa-blue">OPEN →</div>
    </Link>
  );
};

export default function LandingPage() {
  return (
    <div className="h-full w-full">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-orbitron text-2xl text-white tracking-wide">
            Hapa Forge Studio
          </h1>
          <p className="text-slate-300 mt-2 max-w-2xl">
            One self-contained studio for generating character cards, spaceship designs, and
            media outputs. Built to port cleanly into Hapa later.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card
            title="Character Studio"
            to="/character"
            description="Step-based pipeline: analyze text → RPG stats → lore → portrait prompt → image/video → export bundle."
          />
          <Card
            title="Spaceship Studio"
            to="/ship"
            description="AstraForge modular 3D ship builder with AI analysis, concept art, hull visuals and flyby video."
          />
          <Card
            title="Media Studio"
            to="/media"
            description="Hapa Veo Terminal: upload image → generate video. Also supports pulling images from your library."
          />
          <Card
            title="Library"
            to="/library"
            description="Saved characters, ships, and videos. Export as Hapa Bundle JSON + assets."
          />
          <Card
            title="Port to Hapa"
            to="/port"
            description="Wizard: validate a Forge export and generate a Hapa-ready handoff zip with a node-graph manifest."
          />
        </div>

        <div className="mt-10 text-xs text-slate-400">
          Tip: set your Gemini API key in <Link className="text-hapa-blue hover:underline" to="/settings">Settings</Link>.
        </div>
      </div>
    </div>
  );
}
