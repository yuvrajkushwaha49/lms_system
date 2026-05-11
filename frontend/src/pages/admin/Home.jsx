import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-primary-600 rounded-full blur-[150px] opacity-20 pointer-events-none animate-pulse-glow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30vw] h-[30vw] bg-purple-600 rounded-full blur-[150px] opacity-20 pointer-events-none animate-pulse-glow" style={{ animationDelay: '1.5s' }}></div>

      <div className="z-10 max-w-5xl mx-auto text-center space-y-8 glass-panel p-12 rounded-3xl animate-float">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
          Master Real Estate with <br />
          <span className="text-gradient">Workians LMS</span>
        </h1>
        
        <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
          The elite, multi-tenant learning platform engineered to scale your real estate organization. Train better, track efficiently, and convert learning into revenue.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-6">
          <Link 
            to="/login" 
            className="px-8 py-4 rounded-full bg-primary-600 text-white font-semibold text-lg hover:bg-primary-500 transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] card-hover-fx"
          >
            Access Platform
          </Link>
          <button className="px-8 py-4 rounded-full bg-white/10 text-white font-semibold text-lg hover:bg-white/20 transition-all border border-white/10 card-hover-fx">
            Request Demo
          </button>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 border-t border-white/10 text-left">
          <div className="p-6 rounded-2xl bg-white/5 border border-white/5 card-hover-fx">
            <h3 className="text-xl text-white font-semibold mb-2">Multi-Tenant Setup</h3>
            <p className="text-sm text-gray-400">Scale across multiple organizations effortlessly from one unified database architecture.</p>
          </div>
          <div className="p-6 rounded-2xl bg-white/5 border border-white/5 card-hover-fx">
            <h3 className="text-xl text-white font-semibold mb-2">Role Based Hubs</h3>
            <p className="text-sm text-gray-400">Distinct, dynamic dashboards for CEOs, Admins, Instructors, and Students.</p>
          </div>
          <div className="p-6 rounded-2xl bg-white/5 border border-white/5 card-hover-fx">
            <h3 className="text-xl text-white font-semibold mb-2">Advanced Analytics</h3>
            <p className="text-sm text-gray-400">Track progress, generate certificates, and manage automated commission payouts.</p>
          </div>
        </div>
      </div>
    </main>
  );
}

