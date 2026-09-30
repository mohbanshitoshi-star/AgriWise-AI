import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, BookOpen,
  Bug, Check, CheckCircle2, ChevronRight, Cloud, CloudRain, Droplets,
  Flower2, Gauge, Leaf, LoaderCircle, LogOut, MapPin, Menu, MessageCircle,
  Microscope, Plus, RefreshCw, Send, ShieldAlert, Sprout, Sun, Trash2,
  Upload, Wind, X,
} from 'lucide-react';
import {
  getGetAdvisoryQueryKey, getGetDashboardSummaryQueryKey, getGetDiagnosisQueryKey,
  getGetGeminiConversationQueryKey, getGetProfileQueryKey, getGetWeatherForecastQueryKey,
  getListAdvisoriesQueryKey, getListDiagnosesQueryKey, getListGeminiConversationsQueryKey,
  getListGeminiMessagesQueryKey, useAnalyzeDiagnosis, useCalculateSoil, useCreateGeminiConversation,
  useDeleteAdvisory, useDeleteDiagnosis, useDeleteGeminiConversation, useGenerateAdvisory,
  useGetAdvisory, useGetDashboardSummary, useGetDiagnosis, useGetGeminiConversation,
  useGetProfile, useGetWeatherForecast, useListAdvisories, useListDiagnoses,
  useListGeminiConversations, useListGeminiMessages, useUpsertProfile,
} from '@workspace/api-client-react';
import type {
  Advisory, AdvisoryInput, Diagnosis, GeminiConversation, GeminiMessage, GetWeatherForecastParams,
  ProfileInput, SoilCalculation, SoilCalculationInput, WeatherForecast,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 45_000, refetchOnWindowFocus: false } },
});
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#315d4b',
    colorForeground: '#253b33',
    colorMutedForeground: '#6f8177',
    colorDanger: '#a84035',
    colorBackground: '#fbf9f1',
    colorInput: '#f6f3e8',
    colorInputForeground: '#253b33',
    colorNeutral: '#d9d5c7',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.85rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbf9f1] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#253b33] font-semibold',
    headerSubtitle: 'text-[#6f8177]',
    socialButtonsBlockButtonText: 'text-[#253b33] font-medium',
    formFieldLabel: 'text-[#34483e] font-medium',
    footerActionLink: 'text-[#315d4b] font-semibold',
    footerActionText: 'text-[#6f8177]',
    dividerText: 'text-[#718078]',
    identityPreviewEditButton: 'text-[#315d4b]',
    formFieldSuccessText: 'text-[#315d4b]',
    alertText: 'text-[#8b392f]',
    logoBox: 'mb-1',
    logoImage: 'rounded-xl',
    socialButtonsBlockButton: 'rounded-xl border-[#dedacf] bg-[#fffdf7] hover:bg-[#f3f0e5]',
    formButtonPrimary: 'rounded-xl bg-[#315d4b] hover:bg-[#244638] shadow-none',
    formFieldInput: 'rounded-xl border-[#d9d5c7] bg-[#f6f3e8] text-[#253b33]',
    footerAction: 'text-[#6f8177]',
    dividerLine: 'bg-[#dedacf]',
    alert: 'rounded-xl',
    otpCodeFieldInput: 'rounded-lg border-[#d9d5c7]',
    formFieldRow: 'mb-4',
    main: 'gap-5',
  },
};

type IconComponent = typeof Sprout;

const navItems: { href: string; label: string; icon: IconComponent }[] = [
  { href: '/dashboard', label: 'Farm overview', icon: Gauge },
  { href: '/diagnosis', label: 'Crop diagnosis', icon: Microscope },
  { href: '/advisory/new', label: 'Field advice', icon: BookOpen },
  { href: '/chat', label: 'Ask an agronomist', icon: MessageCircle },
  { href: '/soil-calculator', label: 'Soil test', icon: Activity },
];

function cx(...values: (string | false | undefined | null)[]) {
  return values.filter(Boolean).join(' ');
}

function Button({
  children, onClick, type = 'button', variant = 'primary', disabled = false, className = '', testId,
}: {
  children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  disabled?: boolean; className?: string; testId?: string;
}) {
  const generatedId = useId().replace(/:/g, '');
  const looks = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
    secondary: 'border border-border bg-card text-foreground hover:bg-secondary',
    quiet: 'text-muted-foreground hover:bg-secondary hover:text-foreground',
    danger: 'border border-red-200 bg-red-50 text-red-800 hover:bg-red-100',
  }[variant];
  return <button data-testid={testId ?? `button-action-${generatedId}`} type={type} onClick={onClick} disabled={disabled} className={cx('inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-55 active:scale-[.98]', looks, className)}>{children}</button>;
}

function Field({
  label, value, onChange, type = 'text', placeholder, required, step, min, hint, id, inputMode,
}: {
  label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string;
  required?: boolean; step?: string; min?: string; hint?: string; id: string; inputMode?: 'decimal' | 'numeric';
}) {
  return <label className="grid gap-1.5 text-sm font-medium text-foreground" htmlFor={id}>
    <span>{label}{required && <span className="ml-1 text-[#a84035]" aria-hidden="true">*</span>}</span>
    <input id={id} data-testid={`input-${id}`} className="control min-h-12 w-full rounded-xl border border-input bg-card px-3.5 text-[15px] font-normal text-foreground placeholder:text-muted-foreground/70" type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} step={step} min={min} inputMode={inputMode} />
    {hint && <span className="text-xs font-normal leading-relaxed text-muted-foreground">{hint}</span>}
  </label>;
}

function SelectField({
  label, value, onChange, options, id, hint,
}: {
  label: string; value: string; onChange: (value: string) => void; options: [string, string][]; id: string; hint?: string;
}) {
  return <label className="grid gap-1.5 text-sm font-medium text-foreground" htmlFor={id}>
    <span>{label}</span>
    <select id={id} data-testid={`select-${id}`} className="control min-h-12 w-full rounded-xl border border-input bg-card px-3.5 text-[15px] font-normal text-foreground" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
    </select>
    {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
  </label>;
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:mb-9 sm:flex-row sm:items-end">
    <div className="animate-rise">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.17em] text-[#607c68]"><span className="h-px w-5 bg-[#90a06d]" />{eyebrow}</div>
      <h1 className="display-font text-3xl font-semibold tracking-[-.045em] text-[#253b33] sm:text-[2.55rem]">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-[15px] leading-6 text-muted-foreground">{description}</p>}
    </div>
    {action && <div className="animate-rise delay-1">{action}</div>}
  </div>;
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-2xl border border-border/90 bg-card shadow-[0_4px_14px_rgba(42,61,47,.035)]', className)}>{children}</section>;
}

function EmptyState({ icon: Icon, title, copy, action }: { icon: IconComponent; title: string; copy: string; action?: ReactNode }) {
  return <div className="flex min-h-52 flex-col items-center justify-center px-6 py-9 text-center">
    <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#e7ead5] text-[#315d4b]"><Icon size={22} strokeWidth={1.8} /></span>
    <h3 className="display-font text-lg font-semibold text-[#2b4339]">{title}</h3>
    <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">{copy}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>;
}

function QueryError({ message, retry }: { message?: unknown; retry: () => void }) {
  return <div role="alert" className="flex flex-col items-start gap-4 rounded-2xl border border-[#e4bcb3] bg-[#fbf0ec] p-5 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex gap-3"><ShieldAlert size={21} className="mt-0.5 shrink-0 text-[#a84035]" /><div><p className="font-semibold text-[#713e34]">We couldn't load this right now.</p><p className="mt-1 text-sm text-[#805c54]">{errorMessage(message)}</p></div></div>
    <Button variant="secondary" onClick={retry}><RefreshCw size={15} /> Try again</Button>
  </div>;
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'error' in error) return String((error as { error: unknown }).error);
  return 'Check your connection and try once more.';
}

function LoadingRows({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-3" aria-label="Loading">
    {Array.from({ length: rows }, (_, index) => <div key={index} className="flex animate-pulse items-center gap-4 rounded-xl border border-border/80 bg-card p-4">
      <div className="h-10 w-10 shrink-0 rounded-xl bg-secondary" />
      <div className="flex-1 space-y-2"><div className="h-3 w-1/3 rounded bg-secondary" /><div className="h-2.5 w-2/3 rounded bg-secondary/80" /></div>
    </div>)}
  </div>;
}

function useConnection() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    return () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  }, []);
  return online;
}

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const profileQuery = useGetProfile();
  const profile = profileQuery.data;
  const online = useConnection();
  const name = profile?.fullName || user?.firstName || 'Farmer';
  const activeItem = navItems.find((item) => location === item.href || (item.href === '/advisory/new' && location.startsWith('/advisory/'))) ?? navItems[0];
  return <div className="min-h-[100dvh] bg-[#f3f1e7] text-foreground">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-[#213f35] px-4 pb-5 pt-6 text-[#f0f0df] md:flex">
      <Link href="/dashboard" className="mb-9 flex items-center gap-3 px-2" data-testid="link-brand-dashboard">
        <img className="h-10 w-10 rounded-[13px]" src={`${basePath}/logo.svg`} alt="" />
        <span><span className="display-font block text-[18px] font-bold tracking-[-.045em]">AgriWise</span><span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[.2em] text-[#b9c79d]">Field intelligence</span></span>
      </Link>
      <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-[#a9b9a3]">Your farm</div>
      <nav className="space-y-1" aria-label="Main navigation">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = activeItem.href === href;
          return <Link key={href} href={href} data-testid={`link-nav-${href.slice(1).replaceAll('/', '-')}`} className={cx('group flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition duration-200', active ? 'bg-[#d1da7c] text-[#213f35] shadow-[0_3px_12px_rgba(0,0,0,.12)]' : 'text-[#e0e5d6] hover:bg-white/8 hover:text-white')}>
            <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#315d4b]" />}
          </Link>;
        })}
      </nav>
      <div className="mt-auto">
        <div className="field-contour mb-4 rounded-2xl border border-white/10 bg-[#294b3f] p-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-[#e0e8c6]"><span className={cx('h-2 w-2 rounded-full', online ? 'bg-[#cdd77e]' : 'bg-[#e59e7b]')} />{online ? 'Ready for the field' : 'Offline mode'}</div>
          <p className="text-xs leading-[1.65] text-[#c2d0bf]">{online ? 'Your saved field advice stays with you when the signal drops.' : 'Saved field advice remains available on this device.'}</p>
        </div>
        <div className={cx('flex min-h-[58px] items-center gap-1 rounded-xl px-1 transition hover:bg-white/8', location === '/profile' && 'bg-white/10')}>
          <Link href="/profile" data-testid="link-nav-profile" className="flex min-h-[58px] min-w-0 flex-1 items-center gap-3 rounded-xl px-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#d9dba1] text-sm font-bold text-[#28473b]">{name.slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{name}</span><span className="block text-[11px] text-[#bac8b6]">Farm profile</span></span>
          </Link>
          <button aria-label="Sign out" data-testid="button-sign-out" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void signOut({ redirectUrl: basePath || '/' }); }} className="grid h-9 w-9 place-items-center rounded-lg text-[#c9d4c2] transition hover:bg-white/10 hover:text-white"><LogOut size={16} /></button>
        </div>
      </div>
    </aside>
    <div className="min-h-[100dvh] md:pl-[248px]">
      <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#e1dfd4] bg-[#f7f5ed]/90 px-4 backdrop-blur-md sm:px-7 lg:px-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="md:hidden" data-testid="link-mobile-brand"><img src={`${basePath}/logo.svg`} alt="AgriWise home" className="h-9 w-9 rounded-xl" /></Link>
          <span className="hidden text-xs font-bold uppercase tracking-[.16em] text-[#657a69] sm:block">Field desk</span>
          <span className="hidden h-4 w-px bg-border sm:block" />
          <span className="text-sm font-semibold text-[#2c4539]">{activeItem.label}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className={cx('flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold', online ? 'bg-[#e6ead8] text-[#466343]' : 'bg-[#f7e6dc] text-[#915a3e')}>
            <span className={cx('h-1.5 w-1.5 rounded-full', online ? 'bg-[#6b8a57]' : 'bg-[#bc704e]')} />{online ? 'Connected' : 'Saved on device'}
          </span>
          <Link href="/profile" aria-label="Open farm profile" data-testid="link-header-profile" className="grid h-9 w-9 place-items-center rounded-full border border-[#d7d8bf] bg-[#e9ebd8] text-xs font-bold text-[#315d4b] transition hover:border-[#a9b491] hover:bg-[#e1e5cc]">{name.slice(0, 1).toUpperCase()}</Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1450px] px-4 pb-28 pt-6 sm:px-7 sm:pt-8 lg:px-10 lg:pb-10">
        {children}
      </main>
      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#dbd9cc] bg-[#f8f6ee]/95 px-1 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-md md:hidden">
        {navItems.map(({ href, label, icon: Icon }) => {
          const selected = activeItem.href === href;
          return <Link href={href} key={href} aria-label={label} data-testid={`mobile-nav-${href.slice(1).replaceAll('/', '-')}`} className={cx('flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-semibold leading-none transition', selected ? 'text-[#315d4b]' : 'text-[#718078]')}>
            <span className={cx('grid h-7 w-10 place-items-center rounded-full transition', selected && 'bg-[#e4e8ce]')}><Icon size={18} strokeWidth={selected ? 2.2 : 1.7} /></span>
            <span className="max-w-[68px] truncate">{label === 'Ask an agronomist' ? 'Ask' : label === 'Farm overview' ? 'Farm' : label === 'Crop diagnosis' ? 'Diagnose' : label === 'Field advice' ? 'Advice' : 'Soil'}</span>
          </Link>;
        })}
      </nav>
    </div>
  </div>;
}

function Protected({ children }: { children: ReactNode }) {
  return <><Show when="signed-in">{children}</Show><Show when="signed-out"><Redirect to="/sign-in" /></Show></>;
}

function Landing() {
  return <div className="min-h-[100dvh] overflow-hidden bg-[#f2f0e5] text-[#243e34]">
    <header className="relative z-10 mx-auto flex max-w-[1320px] items-center justify-between px-5 py-5 sm:px-9 lg:px-12">
      <Link href="/" data-testid="landing-logo" className="flex items-center gap-3"><img src={`${basePath}/logo.svg`} alt="" className="h-11 w-11 rounded-[14px]" /><span className="display-font text-[20px] font-bold tracking-[-.06em]">AgriWise<span className="ml-1.5 align-top font-sans text-[10px] font-bold uppercase tracking-[.15em] text-[#829160]">AI</span></span></Link>
      <nav className="flex items-center gap-2 sm:gap-4">
        <Link href="/sign-in" data-testid="link-sign-in" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-[#456153] transition hover:bg-white/60 sm:px-4">Sign in</Link>
        <Link href="/sign-up" data-testid="link-sign-up" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#264b3d] px-4 text-sm font-semibold text-[#f4f1df] transition hover:bg-[#1c3e32] sm:px-5">Create your farm <ArrowRight size={15} /></Link>
      </nav>
    </header>
    <main>
      <section className="relative mx-auto grid max-w-[1320px] items-center gap-8 px-5 pb-16 pt-8 sm:px-9 sm:pb-20 md:grid-cols-[1.05fr_.95fr] md:gap-4 md:pt-16 lg:px-12 lg:pb-28 lg:pt-20">
        <div className="relative z-10 animate-rise">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d4d8b9] bg-[#f7f5e8] px-3.5 py-2 text-[11px] font-bold uppercase tracking-[.15em] text-[#60754b]"><span className="h-1.5 w-1.5 rounded-full bg-[#8b9b5b]" />Field-ready crop care</div>
          <h1 className="display-font max-w-[700px] text-[clamp(3.15rem,7vw,6.5rem)] font-semibold leading-[.99] tracking-[-.075em] text-[#233e34]">Good advice.<br /><span className="relative inline-block text-[#70844b]">Better seasons.</span></h1>
          <p className="mt-6 max-w-[510px] text-base leading-7 text-[#596c60] sm:text-lg sm:leading-8">A steady hand for the decisions that shape your crop. Check a plant, make a field plan, and understand your soil — in plain language.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/sign-up" data-testid="link-start-field" className="inline-flex min-h-[54px] items-center justify-center gap-3 rounded-xl bg-[#284f40] px-6 text-[15px] font-semibold text-[#f6f3e6] shadow-[0_10px_25px_rgba(38,75,61,.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#1d4234]">Start with your farm <ArrowRight size={17} /></Link>
            <Link href="/sign-in" data-testid="link-returning-farmer" className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-xl border border-[#cfd3bd] bg-[#f7f5eb] px-5 text-sm font-semibold text-[#345445] transition hover:bg-white">Returning farmer</Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-[#6b7a66]"><span className="inline-flex items-center gap-2"><Check size={14} className="text-[#71864d]" />Clear next steps</span><span className="inline-flex items-center gap-2"><Check size={14} className="text-[#71864d]" />Your advice, saved</span><span className="inline-flex items-center gap-2"><Check size={14} className="text-[#71864d]" />Made for the field</span></div>
        </div>
        <div className="relative animate-rise delay-2">
          <div className="absolute -right-24 top-3 h-[420px] w-[420px] rounded-full bg-[#dfe4c4]/55 blur-3xl" />
          <div className="relative mx-auto max-w-[570px] overflow-hidden rounded-[34px] border border-[#d5d8bf] bg-[#dde3c8] shadow-[0_28px_75px_rgba(50,68,44,.16)]">
            <div className="field-contour absolute inset-0 opacity-70" />
            <div className="relative flex items-start justify-between p-6 sm:p-8">
              <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#60764e]">Field note / 01</p><p className="display-font mt-2 text-xl font-semibold tracking-[-.04em] text-[#2b493a] sm:text-2xl">Look closer, then act.</p></div>
              <span className="grid h-10 w-10 place-items-center rounded-full border border-[#b5c59f] bg-[#eef0d9] text-[#507248]"><Sprout size={19} /></span>
            </div>
            <div className="relative px-4 pb-3 sm:px-8">
              <svg viewBox="0 0 520 340" role="img" aria-label="Illustration of a healthy plant growing from layered field soil" className="h-auto w-full">
                <defs>
                  <linearGradient id="leafA" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#6e8e5c" /><stop offset="1" stopColor="#315d4b" /></linearGradient>
                  <linearGradient id="soil" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#927c56" /><stop offset="1" stopColor="#675741" /></linearGradient>
                  <filter id="plantShadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="7" stdDeviation="8" floodColor="#37503c" floodOpacity=".17" /></filter>
                </defs>
                <path d="M0 261c67-26 118-13 188-1 86 15 153-29 242-13 37 7 65 19 90 17v76H0v-79Z" fill="url(#soil)" />
                <path d="M0 274c69-20 127 8 196 7 80-1 149-24 237-9 38 6 63 15 87 10" fill="none" stroke="#c4a579" strokeOpacity=".65" strokeWidth="3" />
                <path d="M0 303c77-13 121 11 205 8 93-3 162-30 237-14 33 7 56 12 78 9" fill="none" stroke="#b39a71" strokeOpacity=".5" strokeWidth="2" />
                <path d="M260 274c-7-46-1-91 4-139 3-29 2-51-7-80" fill="none" stroke="#49684b" strokeLinecap="round" strokeWidth="9" filter="url(#plantShadow)" />
                <path d="M255 165c-36-35-85-45-119-18 18 40 62 62 115 38" fill="url(#leafA)" filter="url(#plantShadow)" />
                <path d="M264 133c18-43 57-72 101-63-3 44-37 80-100 86" fill="#718b59" filter="url(#plantShadow)" />
                <path d="M264 202c27-31 68-43 99-26-15 35-47 55-96 43" fill="#9aa56b" filter="url(#plantShadow)" />
                <path d="M252 221c-31-27-69-32-97-12 17 31 51 43 95 28" fill="#78936a" filter="url(#plantShadow)" />
                <path d="M261 76c-30-24-42-50-36-76 30 3 53 24 54 62" fill="#82975a" filter="url(#plantShadow)" />
                <path d="M146 152c36 8 70 28 107 47M366 77c-37 17-71 43-103 72M350 181c-29 12-56 32-85 48M161 207c29 4 63 18 92 31" fill="none" stroke="#d0d6a1" strokeLinecap="round" strokeOpacity=".72" strokeWidth="2.5" />
                <circle cx="177" cy="100" r="4" fill="#f2edce" /><circle cx="384" cy="130" r="3" fill="#f2edce" /><circle cx="118" cy="234" r="3" fill="#d2c49b" />
                <path d="M93 280v-34m0 17-15-13m15 9 14-14M416 287v-43m0 18-15-14m15 10 17-15" stroke="#d1bd91" strokeLinecap="round" strokeWidth="3" />
              </svg>
            </div>
            <div className="relative flex items-center justify-between border-t border-[#c7ceb0] bg-[#e9ebd9]/85 px-6 py-4 sm:px-8">
              <span className="text-xs font-medium text-[#617361]">Photo in. Practical plan out.</span><span className="mono-font text-[10px] text-[#60744e]">GROW / 01</span>
            </div>
          </div>
        </div>
      </section>
      <section className="bg-[#294b3f] text-[#f1f0df]">
        <div className="mx-auto grid max-w-[1320px] gap-6 px-5 py-9 sm:px-9 sm:py-10 md:grid-cols-[.7fr_1fr] md:items-center lg:px-12">
          <p className="display-font text-xl leading-snug tracking-[-.035em] sm:text-2xl">A useful answer starts with your field, not a textbook.</p>
          <div className="grid grid-cols-3 gap-3 text-[11px] leading-5 text-[#c4d0bc] sm:gap-6 sm:text-sm">
            <div><span className="mb-2 block h-1 w-7 rounded-full bg-[#d1da7c]" />Your crop<br />and growth stage</div>
            <div><span className="mb-2 block h-1 w-7 rounded-full bg-[#d1da7c]" />Your soil<br />and field size</div>
            <div><span className="mb-2 block h-1 w-7 rounded-full bg-[#d1da7c]" />Your language<br />and local conditions</div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1320px] px-5 py-16 sm:px-9 sm:py-24 lg:px-12">
        <div className="mb-10 max-w-2xl sm:mb-14">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[.18em] text-[#7a8b5e]">A season, one decision at a time</div>
          <h2 className="display-font text-3xl font-semibold leading-tight tracking-[-.055em] text-[#284439] sm:text-5xl">Know what to do next.<br />And why it matters.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-12">
          <article className="relative overflow-hidden rounded-[26px] bg-[#e0e5cc] p-6 sm:p-8 md:col-span-7">
            <div className="absolute -right-4 -top-9 text-[#9aaa71]/25"><Microscope size={150} strokeWidth={.7} /></div>
            <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-[#f1f1df] text-[#496e52]"><Microscope size={21} /></span>
            <h3 className="display-font relative mt-8 max-w-sm text-2xl font-semibold tracking-[-.04em] text-[#2c493b] sm:text-3xl">A closer look at a sick plant.</h3>
            <p className="relative mt-3 max-w-md text-sm leading-6 text-[#5e715e]">Share a clear photo. Get a likely finding, a sense of severity, and treatment options you can discuss and act on.</p>
            <Link href="/sign-up" data-testid="link-feature-diagnosis" className="relative mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#365944]">Inspect a crop <ArrowRight size={15} /></Link>
          </article>
          <article className="rounded-[26px] border border-[#d9d8c8] bg-[#fbf9f1] p-6 sm:p-8 md:col-span-5">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e9ebd8] text-[#496e52]"><BookOpen size={21} /></span>
            <h3 className="display-font mt-8 text-2xl font-semibold tracking-[-.04em] text-[#2c493b]">A plan shaped around your field.</h3>
            <p className="mt-3 text-sm leading-6 text-[#6a786d]">Build a staged fertilizer and water schedule from crop, soil, and field details. Keep the finished advice saved for later.</p>
            <Link href="/sign-up" data-testid="link-feature-advice" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#365944]">Plan field care <ArrowRight size={15} /></Link>
          </article>
          <article className="rounded-[26px] bg-[#d8e3dc] p-6 sm:p-8 md:col-span-5">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f0f2e6] text-[#496e52]"><Activity size={21} /></span>
            <h3 className="display-font mt-8 text-2xl font-semibold tracking-[-.04em] text-[#2c493b]">Make a soil report useful.</h3>
            <p className="mt-3 text-sm leading-6 text-[#5f7369]">Turn measured NPK levels into product quantities by acre and for the whole field, with assumptions shown clearly.</p>
            <Link href="/sign-up" data-testid="link-feature-soil" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#365944]">Read a soil test <ArrowRight size={15} /></Link>
          </article>
          <article className="relative overflow-hidden rounded-[26px] bg-[#344f42] p-6 text-[#f3f1e4] sm:p-8 md:col-span-7">
            <div className="field-contour absolute inset-0 opacity-70" />
            <div className="relative grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
              <div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-[#d1da7c]"><Cloud size={21} /></span><h3 className="display-font mt-8 text-2xl font-semibold tracking-[-.04em] sm:text-3xl">Your advice should travel with you.</h3><p className="mt-3 max-w-md text-sm leading-6 text-[#d2ddcc]">Saved field plans stay on this device, so the steps are still there when your connection is not.</p></div>
              <span className="relative hidden h-[112px] w-[112px] items-center justify-center rounded-full border border-white/15 bg-white/5 sm:flex"><BookOpen size={36} className="text-[#d1da7c]" /><span className="absolute bottom-2 right-3 h-3 w-3 rounded-full bg-[#d1da7c]" /></span>
            </div>
          </article>
        </div>
      </section>
      <section className="border-t border-[#dedccd] bg-[#e9e8d9]">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-8 px-5 py-12 sm:px-9 sm:py-16 md:flex-row md:items-center md:justify-between lg:px-12">
          <div><div className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#78875e]">Start with what you know</div><h2 className="display-font text-3xl font-semibold tracking-[-.055em] text-[#284439] sm:text-4xl">Your field has a story.<br className="hidden sm:block" /> Let’s read it together.</h2></div>
          <Link href="/sign-up" data-testid="link-final-signup" className="inline-flex min-h-[54px] items-center justify-center gap-3 self-start rounded-xl bg-[#284f40] px-6 text-sm font-semibold text-[#f6f3e6] shadow-sm transition hover:bg-[#1d4234] md:self-center">Set up your farm <ArrowRight size={16} /></Link>
        </div>
      </section>
    </main>
    <footer className="bg-[#213f35] px-5 py-6 text-[#d5ddce] sm:px-9 lg:px-12">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between"><span className="font-semibold">AgriWise AI <span className="ml-2 font-normal text-[#aebda9]">Practical crop care, built around your farm.</span></span><span className="text-[#aebda9]">Advice supports your decisions; it does not replace local agronomic judgment.</span></div>
    </footer>
  </div>;
}

function HomeRoute() {
  return <><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><Landing /></Show></>;
}

function DashboardPage() {
  const summaryQuery = useGetDashboardSummary();
  const profileQuery = useGetProfile();
  const summary = summaryQuery.data;
  const profile = profileQuery.data;
  const coords: GetWeatherForecastParams = useMemo(() => ({ latitude: profile?.latitude ?? 0, longitude: profile?.longitude ?? 0 }), [profile?.latitude, profile?.longitude]);
  const weatherQuery = useGetWeatherForecast(coords, { query: { enabled: profile?.latitude !== null && profile?.latitude !== undefined && profile?.longitude !== null && profile?.longitude !== undefined, queryKey: getGetWeatherForecastQueryKey(coords) } });
  const weather = weatherQuery.data;
  if (summaryQuery.isLoading || profileQuery.isLoading) return <><PageTitle eyebrow="Your growing season" title="Farm overview" /><LoadingRows rows={4} /></>;
  if (summaryQuery.isError) return <><PageTitle eyebrow="Your growing season" title="Farm overview" /><QueryError message={summaryQuery.error} retry={() => { void summaryQuery.refetch(); void profileQuery.refetch(); }} /></>;
  const items = summary?.recentActivity ?? [];
  const first = profile?.fullName?.trim().split(/\s+/)[0] || 'there';
  return <>
    <div className="relative mb-7 overflow-hidden rounded-[25px] bg-[#294c3f] p-5 text-[#f2f0df] sm:mb-9 sm:p-7 lg:p-8">
      <div className="field-contour absolute inset-0 opacity-75" />
      <div className="absolute -right-10 -top-28 h-64 w-64 rounded-full border border-white/10" /><div className="absolute -right-2 -top-20 h-48 w-48 rounded-full border border-white/10" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="animate-rise"><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#d8e2bc]"><Sun size={13} /> Your field desk</div><h1 className="display-font text-3xl font-semibold tracking-[-.055em] sm:text-[2.6rem]">Good morning, {first}.</h1><p className="mt-2 text-sm text-[#d0ddcf]">Here’s what’s happening on your farm today.</p></div>
        <div className="flex flex-wrap gap-2.5 animate-rise delay-1">
          <Link href="/diagnosis" data-testid="link-dashboard-diagnose" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#d4dd91] px-4 text-sm font-bold text-[#284539] transition hover:bg-[#e2e8ae]"><Microscope size={16} /> Check a plant</Link>
          <Link href="/advisory/new" data-testid="link-dashboard-plan" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 text-sm font-semibold text-[#f0f0df] transition hover:bg-white/10"><Plus size={16} /> Plan field care</Link>
        </div>
      </div>
    </div>
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      <Metric icon={Microscope} label="Crop checks" value={summary?.diagnosesCount ?? 0} foot="diagnoses saved" tint="olive" />
      <Metric icon={BookOpen} label="Field plans" value={summary?.advisoriesCount ?? 0} foot="advisories ready" tint="sage" />
      <Metric icon={ShieldAlert} label="Needs a closer look" value={summary?.highRiskCount ?? 0} foot="higher-risk findings" tint="clay" />
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <Card className="animate-rise delay-1 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-4 sm:px-6"><div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#74835f]">Local conditions</p><h2 className="display-font mt-1 text-xl font-semibold tracking-[-.03em] text-[#2a4539]">Weather for your field</h2></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8ead7] text-[#5d7959]"><Cloud size={20} /></span></div>
        {profile?.latitude == null || profile.longitude == null ? <EmptyState icon={MapPin} title="Add your farm location" copy="A location helps bring a local forecast and crop-risk flags into your field overview." action={<Link href="/profile" className="text-sm font-bold text-[#315d4b] underline underline-offset-4" data-testid="link-add-location">Set farm location</Link>} /> : weatherQuery.isLoading ? <div className="p-5"><LoadingRows rows={2} /></div> : weatherQuery.isError ? <div className="p-5"><QueryError message={weatherQuery.error} retry={() => { void weatherQuery.refetch(); }} /></div> : weather ? <WeatherPanel weather={weather} location={profile.locationName} /> : null}
      </Card>
      <Card className="animate-rise delay-2">
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-4 sm:px-6"><div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#74835f]">Field notebook</p><h2 className="display-font mt-1 text-xl font-semibold tracking-[-.03em] text-[#2a4539]">Recent activity</h2></div><Activity size={19} className="text-[#71875d]" /></div>
        {summaryQuery.isLoading ? <div className="p-5"><LoadingRows rows={3} /></div> : items.length === 0 ? <EmptyState icon={Sprout} title="A clean page" copy="Your crop checks and field plans will appear here as you use AgriWise." action={<Link href="/diagnosis" data-testid="link-empty-diagnosis" className="text-sm font-bold text-[#315d4b] underline underline-offset-4">Check your first plant</Link>} /> : <div className="divide-y divide-border/75">
          {items.map((item) => <div key={`${item.kind}-${item.id}`} data-testid={`activity-${item.kind}-${item.id}`} className="flex items-start gap-3 px-5 py-4 sm:px-6">
            <span className={cx('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl', item.kind === 'diagnosis' ? 'bg-[#f1e9d4] text-[#8a713e]' : 'bg-[#e6ead8] text-[#56764f]')}>{item.kind === 'diagnosis' ? <Microscope size={16} /> : <BookOpen size={16} />}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#30483b]">{item.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description}</p><p className="mono-font mt-2 text-[9px] uppercase tracking-[.11em] text-[#879080]">{formatDate(item.createdAt)}</p></div>
            {item.kind === 'advisory' && <Link href={`/advisory/${item.id}`} aria-label={`Open ${item.title}`} data-testid={`open-advisory-${item.id}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"><ChevronRight size={17} /></Link>}
          </div>)}
        </div>}
      </Card>
    </div>
    <div className="mt-5 rounded-2xl border border-[#d9deca] bg-[#e8ebdb] px-4 py-4 text-xs leading-5 text-[#5d705f] sm:flex sm:items-center sm:justify-between sm:px-5"><span className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#59794f]" />Your advice is saved on this device for when the signal is weak.</span><span className="mt-2 block sm:mt-0">Farm: {summary?.locationName || profile?.locationName || 'Location not set'}{summary?.farmSizeAcres || profile?.farmSizeAcres ? ` · ${summary?.farmSizeAcres ?? profile?.farmSizeAcres} acres` : ''}</span></div>
  </>;
}

function Metric({ icon: Icon, label, value, foot, tint }: { icon: IconComponent; label: string; value: number; foot: string; tint: 'olive' | 'sage' | 'clay' }) {
  const shade = { olive: 'bg-[#e8ead7] text-[#617849]', sage: 'bg-[#deebe2] text-[#4f795d]', clay: 'bg-[#f2e5d8] text-[#9a6e4b]' }[tint];
  return <Card className="animate-rise flex items-center gap-4 p-4 sm:gap-4 sm:p-5"><span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-[14px]', shade)}><Icon size={19} strokeWidth={1.9} /></span><div className="min-w-0"><p className="text-xs font-semibold text-muted-foreground">{label}</p><div className="mt-0.5 flex items-baseline gap-2"><span data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`} className="display-font text-2xl font-bold tracking-[-.05em] text-[#2b4438]">{value}</span><span className="truncate text-[10px] font-medium text-[#839080]">{foot}</span></div></div></Card>;
}

function WeatherPanel({ weather, location }: { weather: WeatherForecast; location?: string | null }) {
  return <div className="p-5 sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-semibold text-[#536a5d]">{location || 'Your saved farm location'}</p><div className="mt-1 flex items-center gap-3"><span className="display-font text-[3.2rem] font-semibold leading-none tracking-[-.07em] text-[#28483b]">{Math.round(weather.currentTemperatureC)}°</span><div className="text-xs leading-5 text-[#748177]">Current<br />conditions</div></div></div>
      <div className="flex gap-4 pb-1 text-xs text-[#718075]"><span className="flex items-center gap-1.5"><Droplets size={15} className="text-[#5c8d83]" />{weather.currentPrecipitationMm} mm</span><span className="flex items-center gap-1.5"><Wind size={15} className="text-[#718b68]" />{weather.windSpeedKmh} km/h</span></div>
    </div>
    <div className="mt-5 grid grid-cols-5 divide-x divide-border/80 rounded-xl border border-border/80 bg-[#f5f3e9] py-3">
      {weather.forecast.slice(0, 5).map((day) => <div key={day.date} className="flex flex-col items-center gap-2 px-1 text-center">
        <span className="text-[10px] font-semibold text-[#728075]">{weekday(day.date)}</span>
        <WeatherGlyph code={day.weatherCode} />
        <span className="text-[11px] font-semibold text-[#3f5849]">{Math.round(day.highC)}° <span className="font-normal text-[#8a9387]">{Math.round(day.lowC)}°</span></span>
        <span className="mono-font text-[8px] text-[#859085]">{day.precipitationProbability}%</span>
      </div>)}
    </div>
    {weather.riskFlags.length > 0 && <div className="mt-4 rounded-xl border border-[#e5d4af] bg-[#f8f1df] p-3.5"><div className="mb-2 flex items-center gap-2 text-xs font-bold text-[#755d34]"><ShieldAlert size={15} />Conditions to watch</div><ul className="space-y-1.5">{weather.riskFlags.map((flag, index) => <li key={`${flag}-${index}`} className="flex gap-2 text-xs leading-5 text-[#756951]"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#b79855]" />{flag}</li>)}</ul></div>}
  </div>;
}

function WeatherGlyph({ code }: { code: number }) {
  const Icon = code >= 61 ? CloudRain : code >= 2 ? Cloud : Sun;
  return <Icon size={17} strokeWidth={1.7} className={code >= 61 ? 'text-[#658b83]' : code >= 2 ? 'text-[#788d84]' : 'text-[#c08d43]'} />;
}

function DiagnosisPage() {
  const profileQuery = useGetProfile();
  const diagnosisQuery = useListDiagnoses();
  const analyze = useAnalyzeDiagnosis();
  const removeDiagnosis = useDeleteDiagnosis();
  const queryClient = useQueryClient();
  const [photo, setPhoto] = useState<File | null>(null);
  const [cropName, setCropName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localError, setLocalError] = useState('');
  const previewUrl = useMemo(() => photo ? URL.createObjectURL(photo) : '', [photo]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const detailQuery = useGetDiagnosis(selectedId || '', { query: { enabled: Boolean(selectedId), queryKey: getGetDiagnosisQueryKey(selectedId || '') } });
  const details = detailQuery.data;
  const diagnoses = diagnosisQuery.data ?? [];
  const language = profileQuery.data?.preferredLanguage || 'en';
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setLocalError('');
    if (!photo) { setLocalError('Choose a clear photo of one affected leaf or plant.'); return; }
    if (cropName.trim().length > 80) { setLocalError('Crop name must be 80 characters or fewer.'); return; }
    analyze.mutate({ data: { image: photo, cropName: cropName.trim() || undefined, language } }, {
      onSuccess: (result) => {
        setSelectedId(result.id);
        setPhoto(null);
        setCropName('');
        void queryClient.invalidateQueries({ queryKey: getListDiagnosesQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
      onError: (error) => setLocalError(errorMessage(error)),
    });
  };
  const deleteItem = (id: string) => {
    if (!window.confirm('Remove this saved crop diagnosis?')) return;
    removeDiagnosis.mutate({ id }, {
      onSuccess: () => {
        if (selectedId === id) setSelectedId(null);
        void queryClient.invalidateQueries({ queryKey: getListDiagnosesQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetDiagnosisQueryKey(id) });
        void queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
    });
  };
  return <>
    <PageTitle eyebrow="Look closely" title="Crop diagnosis" description="Take a clear photo of the affected plant. We’ll look for likely causes and give you practical next steps." />
    {removeDiagnosis.isError && <p role="alert" className="mb-4 rounded-xl bg-[#fbefeb] px-4 py-3 text-sm text-[#8b392f]">{errorMessage(removeDiagnosis.error)}</p>}
    <div className="grid items-start gap-5 xl:grid-cols-[.9fr_1.1fr]">
      <div className="space-y-5">
        <Card className="overflow-hidden">
          <div className="border-b border-border/80 bg-[#e9ecd9] px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f7f6eb] text-[#56734e]"><Upload size={18} /></span><div><h2 className="display-font text-lg font-semibold text-[#2b4539]">Inspect a plant</h2><p className="text-xs text-[#718075]">A single clear photo works best.</p></div></div></div>
          <form onSubmit={submit} className="space-y-5 p-5 sm:p-6">
            <label htmlFor="diagnosis-photo" className={cx('flex min-h-[190px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed transition', photo ? 'border-[#92a478] bg-[#f2f3e8]' : 'border-[#c9cebb] bg-[#f7f6ed] hover:border-[#84956d] hover:bg-[#f1f2e5]')}>
              {photo && previewUrl ? <><img src={previewUrl} alt="Selected crop for diagnosis" className="h-[190px] w-full object-cover" /><span className="mt-2 px-3 text-xs font-semibold text-[#536e50]">Photo selected · choose another</span></> : <><span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[#e7ebd8] text-[#5c7955]"><Upload size={20} /></span><span className="text-sm font-semibold text-[#3b5344]">Add a plant photo</span><span className="mt-1.5 text-xs text-[#839083]">JPG, PNG or WEBP · close, well-lit image</span></>}
              <input id="diagnosis-photo" data-testid="input-diagnosis-photo" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; setPhoto(file ?? null); setLocalError(''); }} />
            </label>
            <Field id="diagnosis-crop" label="Crop name (optional)" value={cropName} onChange={setCropName} placeholder="For example, tomato" hint="Naming the crop helps focus the assessment." />
            <div className="rounded-xl bg-[#f1f0e7] px-3.5 py-3 text-xs leading-5 text-[#6f7b6d]"><span className="font-semibold text-[#52634f]">A useful photo:</span> include the affected area and a healthy part of the plant for comparison.</div>
            {localError && <p role="alert" data-testid="status-diagnosis-error" className="rounded-xl bg-[#fbefeb] px-3.5 py-3 text-sm text-[#8b392f]">{localError}</p>}
            {analyze.isError && !localError && <p role="alert" className="rounded-xl bg-[#fbefeb] px-3.5 py-3 text-sm text-[#8b392f]">{errorMessage(analyze.error)}</p>}
            <Button type="submit" disabled={analyze.isPending || !photo} className="w-full" testId="button-analyze-photo">{analyze.isPending ? <><LoaderCircle size={17} className="animate-spin" /> Looking at your plant…</> : <><Microscope size={17} /> Analyze photo</>}</Button>
            {analyze.isPending && <div aria-live="polite" className="space-y-2"><div className="h-2 animate-pulse rounded bg-secondary" /><div className="h-2 w-3/4 animate-pulse rounded bg-secondary" /><p className="text-center text-xs text-muted-foreground">This can take a little while on a slow connection.</p></div>}
          </form>
        </Card>
        {selectedId && (detailQuery.isLoading ? <Card className="p-5"><LoadingRows rows={2} /></Card> : detailQuery.isError ? <QueryError message={detailQuery.error} retry={() => { void detailQuery.refetch(); }} /> : details ? <DiagnosisResult diagnosis={details} onDelete={() => deleteItem(details.id)} deleting={removeDiagnosis.isPending} /> : null)}
      </div>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-4 sm:px-6"><div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#74835f]">Your field notebook</p><h2 className="display-font mt-1 text-xl font-semibold text-[#2a4539]">Recent crop checks</h2></div><span className="mono-font rounded-lg bg-[#eff0e4] px-2 py-1 text-[10px] text-[#728067]">{diagnoses.length} saved</span></div>
        {diagnosisQuery.isLoading ? <div className="p-5"><LoadingRows rows={4} /></div> : diagnosisQuery.isError ? <div className="p-5"><QueryError message={diagnosisQuery.error} retry={() => { void diagnosisQuery.refetch(); }} /></div> : diagnoses.length === 0 ? <EmptyState icon={Leaf} title="No crop checks yet" copy="Your diagnosis history will build here. Start with a photo of one affected plant." /> : <div className="divide-y divide-border/75">
          {diagnoses.map((diagnosis) => <button key={diagnosis.id} type="button" data-testid={`diagnosis-row-${diagnosis.id}`} onClick={() => setSelectedId(diagnosis.id)} className={cx('group flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-[#f4f3e9] sm:px-5', selectedId === diagnosis.id && 'bg-[#eef0e1]')}>
            <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl', diagnosis.isHealthy ? 'bg-[#e4ecd9] text-[#5d7c4f]' : diagnosis.severityLevel === 'Critical' || diagnosis.severityLevel === 'High' ? 'bg-[#f2e2d9] text-[#a35e45]' : 'bg-[#f1ead8] text-[#8b7142]')}>{diagnosis.isHealthy ? <CheckCircle2 size={18} /> : <Bug size={18} />}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#30483b]">{diagnosis.cropName || 'Crop'} · {diagnosis.diseaseDetected}</span><span className="mt-1 block text-xs text-muted-foreground">{formatDate(diagnosis.createdAt)} <span className="mx-1">·</span>{diagnosis.isHealthy ? 'Healthy' : `${diagnosis.severityLevel} concern`}</span></span>
            <ChevronRight size={16} className="shrink-0 text-[#8a9484] transition group-hover:translate-x-0.5" />
          </button>)}
        </div>}
      </Card>
    </div>
  </>;
}

function DiagnosisResult({ diagnosis, onDelete, deleting }: { diagnosis: Diagnosis; onDelete: () => void; deleting: boolean }) {
  const serious = !diagnosis.isHealthy && (diagnosis.severityLevel === 'High' || diagnosis.severityLevel === 'Critical');
  return <Card className="animate-rise overflow-hidden">
    <div className={cx('flex items-start justify-between gap-3 px-5 py-4 sm:px-6', diagnosis.isHealthy ? 'bg-[#e6eddd]' : serious ? 'bg-[#f3e4dd]' : 'bg-[#f3eddc')}>
      <div><div className="mb-1 text-[10px] font-bold uppercase tracking-[.16em] text-[#77816a]">Plant assessment</div><h2 className="display-font text-xl font-semibold tracking-[-.035em] text-[#2a4338]">{diagnosis.diseaseDetected}</h2><p className="mt-1 text-xs text-[#647469]">{diagnosis.cropName} · {diagnosis.severityLevel} · {Math.round(diagnosis.confidenceScore)}% confidence</p></div>
      <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl', diagnosis.isHealthy ? 'bg-white/65 text-[#58794e]' : 'bg-white/65 text-[#9a6148]')}>{diagnosis.isHealthy ? <BadgeCheck size={20} /> : <Bug size={19} />}</span>
    </div>
    <div className="space-y-5 p-5 sm:p-6">
      <InfoList title="What we noticed" values={diagnosis.symptoms} />
      <div className="grid gap-4 sm:grid-cols-2"><InfoList title="Chemical treatment" values={diagnosis.treatmentChemical} /><InfoList title="Organic options" values={diagnosis.treatmentOrganic} /></div>
      <InfoList title="Prevention" values={diagnosis.preventionSteps} />
      <div className="flex items-center justify-between border-t border-border/80 pt-4 text-xs text-muted-foreground"><span>Assessment · {formatDate(diagnosis.createdAt)}</span><button type="button" data-testid={`button-delete-diagnosis-${diagnosis.id}`} disabled={deleting} onClick={onDelete} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-[#8c5449] transition hover:bg-[#fbefeb] disabled:opacity-50"><Trash2 size={14} /> Remove</button></div>
    </div>
  </Card>;
}

function InfoList({ title, values }: { title: string; values: string[] }) {
  return <div><h3 className="mb-2 text-xs font-bold uppercase tracking-[.1em] text-[#657762]">{title}</h3>{values.length ? <ul className="space-y-2">{values.map((value, index) => <li key={`${value}-${index}`} className="flex gap-2.5 text-sm leading-6 text-[#4a5d50]"><span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#91a06c]" />{value}</li>)}</ul> : <p className="text-sm text-muted-foreground">No details provided.</p>}</div>;
}

const stageOptions: [string, string][] = [['Sowing/Germination', 'Sowing / germination'], ['Vegetative', 'Vegetative'], ['Flowering', 'Flowering'], ['Fruiting/Grain Filling', 'Fruiting / grain filling'], ['Harvesting', 'Harvesting']];
const soilOptions: [string, string][] = [['Clay', 'Clay'], ['Loamy', 'Loamy'], ['Sandy', 'Sandy'], ['Alluvial', 'Alluvial'], ['Black', 'Black'], ['Red/Laterite', 'Red / laterite']];
const irrigationOptions: [string, string][] = [['Rainfed', 'Rainfed'], ['Drip Irrigation', 'Drip irrigation'], ['Sprinkler', 'Sprinkler'], ['Flood/Furrow', 'Flood / furrow']];
const languageOptions: [string, string][] = [['en', 'English'], ['hi', 'Hindi'], ['es', 'Spanish'], ['fr', 'French'], ['bn', 'Bengali'], ['pa', 'Punjabi'], ['mr', 'Marathi'], ['ta', 'Tamil'], ['te', 'Telugu']];

function AdvisoryNewPage() {
  const profileQuery = useGetProfile();
  const { user } = useUser();
  const listQuery = useListAdvisories();
  const createAdvisory = useGenerateAdvisory();
  const removeAdvisory = useDeleteAdvisory();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [cropName, setCropName] = useState('');
  const [growthStage, setGrowthStage] = useState(stageOptions[1][0]);
  const [soilType, setSoilType] = useState('Loamy');
  const [area, setArea] = useState('');
  const [nitrogen, setNitrogen] = useState('');
  const [phosphorus, setPhosphorus] = useState('');
  const [potassium, setPotassium] = useState('');
  const [ph, setPh] = useState('');
  const [irrigation, setIrrigation] = useState(irrigationOptions[0][0]);
  const [formError, setFormError] = useState('');
  const cacheKey = `agriwise:${user?.id ?? 'anonymous'}:advisories`;
  const [cached, setCached] = useState<Advisory[]>(() => readCache<Advisory[]>(cacheKey) ?? []);
  const advisories = listQuery.data ?? cached;
  useEffect(() => { setCached(readCache<Advisory[]>(cacheKey) ?? []); }, [cacheKey]);
  useEffect(() => { if (listQuery.data) { setCached(listQuery.data); writeCache(cacheKey, listQuery.data); } }, [listQuery.data, cacheKey]);
  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile) return;
    setSoilType(profile.defaultSoilType || 'Loamy');
    if (!area && profile.farmSizeAcres) setArea(String(profile.farmSizeAcres));
    if (!cropName && profile.primaryCrops[0]) setCropName(profile.primaryCrops[0]);
  }, [profileQuery.data, area, cropName]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    const parsedArea = Number(area);
    if (cropName.trim().length < 2 || cropName.trim().length > 80) { setFormError('Enter a crop name between 2 and 80 characters.'); return; }
    if (!Number.isFinite(parsedArea) || parsedArea <= 0 || parsedArea > 100000) { setFormError('Enter a field area greater than 0 acres.'); return; }
    const toOptionalNumber = (value: string) => value.trim() ? Number(value) : null;
    const input: AdvisoryInput = {
      cropName: cropName.trim(),
      growthStage: growthStage as AdvisoryInput['growthStage'],
      soilType: soilType as AdvisoryInput['soilType'],
      fieldAreaAcres: parsedArea,
      nitrogenLevel: toOptionalNumber(nitrogen),
      phosphorusLevel: toOptionalNumber(phosphorus),
      potassiumLevel: toOptionalNumber(potassium),
      phLevel: toOptionalNumber(ph),
      irrigationMethod: irrigation as AdvisoryInput['irrigationMethod'],
      language: profileQuery.data?.preferredLanguage as AdvisoryInput['language'] || 'en',
    };
    createAdvisory.mutate({ data: input }, {
      onSuccess: (saved) => {
        const next = [saved, ...advisories.filter((item) => item.id !== saved.id)];
        setCached(next);
        writeCache(cacheKey, next);
        void queryClient.invalidateQueries({ queryKey: getListAdvisoriesQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setLocation(`/advisory/${saved.id}`);
      },
      onError: (error) => setFormError(errorMessage(error)),
    });
  };
  const remove = (id: string) => {
    if (!window.confirm('Delete this saved field advisory?')) return;
    removeAdvisory.mutate({ id }, { onSuccess: () => {
      const next = advisories.filter((item) => item.id !== id);
      setCached(next);
      writeCache(cacheKey, next);
      try { localStorage.removeItem(`agriwise:${user?.id ?? 'anonymous'}:advisory:${id}`); } catch { /* Storage can be disabled. */ }
      void queryClient.invalidateQueries({ queryKey: getListAdvisoriesQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetAdvisoryQueryKey(id) });
      void queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    } });
  };
  return <>
    <PageTitle eyebrow="Make a field plan" title="Field advice" description="Share your crop, stage, and field conditions. Keep the resulting schedule close at hand." />
    {removeAdvisory.isError && <p role="alert" className="mb-4 rounded-xl bg-[#fbefeb] px-4 py-3 text-sm text-[#8b392f]">{errorMessage(removeAdvisory.error)}</p>}
    <div className="grid items-start gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border/80 bg-[#e8ebd8] px-5 py-4 sm:px-6"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/70 text-[#52734c]"><BookOpen size={18} /></span><div><h2 className="display-font text-lg font-semibold text-[#2b4539]">Plan for this field</h2><p className="text-xs text-[#728073]">More detail helps tailor the schedule.</p></div></div>
        <form onSubmit={submit} className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2"><Field id="advisory-crop" label="Crop" value={cropName} onChange={setCropName} placeholder="For example, maize" required /><SelectField id="advisory-stage" label="Growth stage" value={growthStage} onChange={setGrowthStage} options={stageOptions} /></div>
          <div className="grid gap-4 sm:grid-cols-2"><SelectField id="advisory-soil" label="Soil type" value={soilType} onChange={setSoilType} options={soilOptions} /><Field id="advisory-area" label="Field area (acres)" value={area} onChange={setArea} type="number" min="0.01" step="0.01" placeholder="e.g. 2.5" inputMode="decimal" required /></div>
          <div className="rounded-2xl border border-[#dedfd2] bg-[#f7f6ef] p-4"><div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold text-[#405747]">Soil test results</p><p className="text-xs text-[#869084]">Optional · leave blank if not measured</p></div><span className="mono-font text-[9px] uppercase tracking-[.12em] text-[#859079]">mg/kg</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Field id="advisory-n" label="Nitrogen" value={nitrogen} onChange={setNitrogen} type="number" min="0" step="0.1" placeholder="—" /><Field id="advisory-p" label="Phosphorus" value={phosphorus} onChange={setPhosphorus} type="number" min="0" step="0.1" placeholder="—" /><Field id="advisory-k" label="Potassium" value={potassium} onChange={setPotassium} type="number" min="0" step="0.1" placeholder="—" /><Field id="advisory-ph" label="pH" value={ph} onChange={setPh} type="number" min="1" max="14" step="0.1" placeholder="—" /></div></div>
          <SelectField id="advisory-irrigation" label="How do you irrigate?" value={irrigation} onChange={setIrrigation} options={irrigationOptions} />
          {formError && <p role="alert" data-testid="status-advisory-error" className="rounded-xl bg-[#fbefeb] px-3.5 py-3 text-sm text-[#8b392f]">{formError}</p>}
          <Button type="submit" disabled={createAdvisory.isPending} className="w-full" testId="button-generate-advisory">{createAdvisory.isPending ? <><LoaderCircle size={17} className="animate-spin" /> Building your field plan…</> : <><Sprout size={17} /> Create field advice</>}</Button>
          {createAdvisory.isPending && <div aria-live="polite" className="space-y-2"><div className="h-2 animate-pulse rounded bg-secondary" /><div className="h-2 w-4/5 animate-pulse rounded bg-secondary" /><div className="h-2 w-2/3 animate-pulse rounded bg-secondary" /></div>}
        </form>
      </Card>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-4 sm:px-6"><div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#74835f]">Kept close by</p><h2 className="display-font mt-1 text-xl font-semibold text-[#2a4539]">Saved field advice</h2></div><BookOpen size={19} className="text-[#70845d]" /></div>
        {listQuery.isLoading && !cached.length ? <div className="p-5"><LoadingRows rows={3} /></div> : listQuery.isError && !cached.length ? <div className="p-5"><QueryError message={listQuery.error} retry={() => { void listQuery.refetch(); }} /></div> : advisories.length === 0 ? <EmptyState icon={Flower2} title="No field plans yet" copy="Once created, your fertilizer, irrigation, and crop-care schedule will be saved here." /> : <><div className="flex items-center gap-2 bg-[#f3f3e8] px-5 py-2.5 text-[11px] text-[#6d7a6a]">{!navigator.onLine && <Cloud size={14} />}<span>{listQuery.isError ? 'Showing advice saved on this device.' : 'Available on this device, including when you are offline.'}</span></div><div className="divide-y divide-border/75">{advisories.map((item) => <AdvisoryRow key={item.id} advisory={item} onDelete={() => remove(item.id)} deleting={removeAdvisory.isPending} />)}</div></>}
      </Card>
    </div>
  </>;
}

function AdvisoryRow({ advisory, onDelete, deleting }: { advisory: Advisory; onDelete: () => void; deleting: boolean }) {
  return <div className="flex items-center gap-2 px-4 py-3.5 sm:px-5">
    <Link href={`/advisory/${advisory.id}`} data-testid={`link-advisory-${advisory.id}`} className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 text-left">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e6ead8] text-[#58764f]"><Leaf size={18} /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#30483b]">{advisory.cropName} <span className="font-normal text-[#8b9387]">· {advisory.growthStage}</span></span><span className="mt-1 block text-xs text-muted-foreground">{advisory.fieldAreaAcres} acres · {formatDate(advisory.createdAt)}</span></span>
      <ChevronRight size={16} className="shrink-0 text-[#899385] transition group-hover:translate-x-0.5" />
    </Link>
    <button type="button" data-testid={`button-delete-advisory-${advisory.id}`} aria-label={`Delete ${advisory.cropName} field advice`} disabled={deleting} onClick={onDelete} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[#8c6558] transition hover:bg-[#f5e9e4] disabled:opacity-50"><Trash2 size={15} /></button>
  </div>;
}

function AdvisoryDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useUser();
  const id = params.id || '';
  const detailQuery = useGetAdvisory(id);
  const removeAdvisory = useDeleteAdvisory();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const cacheKey = `agriwise:${user?.id ?? 'anonymous'}:advisory:${id}`;
  const listCacheKey = `agriwise:${user?.id ?? 'anonymous'}:advisories`;
  const [cached, setCached] = useState<Advisory | null>(() => readCache<Advisory>(cacheKey));
  const advisory = detailQuery.data ?? cached;
  useEffect(() => { setCached(readCache<Advisory>(cacheKey)); }, [cacheKey]);
  useEffect(() => {
    if (!detailQuery.data) return;
    setCached(detailQuery.data);
    writeCache(cacheKey, detailQuery.data);
    const cachedList = readCache<Advisory[]>(listCacheKey) ?? [];
    writeCache(listCacheKey, [detailQuery.data, ...cachedList.filter((item) => item.id !== id)]);
  }, [detailQuery.data, id, cacheKey, listCacheKey]);
  const deleteSaved = () => {
    if (!advisory || !window.confirm('Delete this saved field advisory?')) return;
    removeAdvisory.mutate({ id }, { onSuccess: () => {
      const cachedList = readCache<Advisory[]>(listCacheKey) ?? [];
      writeCache(listCacheKey, cachedList.filter((item) => item.id !== id));
      try { localStorage.removeItem(cacheKey); } catch { /* Storage can be disabled. */ }
      void queryClient.invalidateQueries({ queryKey: getListAdvisoriesQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetAdvisoryQueryKey(id) });
      void queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      setLocation('/advisory/new');
    } });
  };
  if (detailQuery.isLoading && !cached) return <><PageTitle eyebrow="Saved field advice" title="Your field plan" /><LoadingRows rows={4} /></>;
  if (!advisory) return <><PageTitle eyebrow="Saved field advice" title="Your field plan" /><QueryError message={detailQuery.error} retry={() => { void detailQuery.refetch(); }} /></>;
  return <>
    <PageTitle eyebrow="Saved field advice" title={advisory.cropName} description={`${advisory.growthStage} · ${advisory.soilType} soil · ${advisory.fieldAreaAcres} acres`} action={<div className="flex gap-2"><Link href="/advisory/new" data-testid="link-back-advisories" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-secondary"><ArrowLeft size={15} /> All advice</Link><Button variant="danger" disabled={removeAdvisory.isPending} onClick={deleteSaved} testId="button-delete-current-advisory"><Trash2 size={15} /> Delete</Button></div>} />
    {removeAdvisory.isError && <p role="alert" className="mb-4 rounded-xl bg-[#fbefeb] px-4 py-3 text-sm text-[#8b392f]">{errorMessage(removeAdvisory.error)}</p>}
    {detailQuery.isError && <div className="mb-5 flex items-center gap-2 rounded-xl border border-[#e1d5b8] bg-[#f5efdf] px-4 py-3 text-xs text-[#76694c]"><Cloud size={15} />You’re viewing the copy saved on this device. It will refresh when you reconnect.</div>}
    <div className="grid gap-5 xl:grid-cols-[1fr_.92fr]">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-border/80 bg-[#e8ebd8] px-5 py-4 sm:px-6"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#71805e]">Fertilizer schedule</p><h2 className="display-font mt-1 text-xl font-semibold text-[#2a4539]">What to apply, and when</h2></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f6f5e9] text-[#597650]"><Sprout size={18} /></span></div>
        {advisory.fertilizerSchedule.length ? <div className="divide-y divide-border/75">{advisory.fertilizerSchedule.map((step, index) => <div key={`${step.fertilizerName}-${index}`} className="relative px-5 py-5 sm:px-6"><div className="flex gap-3"><span className="mono-font mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e9edda] text-[10px] font-bold text-[#56724d]">{String(index + 1).padStart(2, '0')}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-[#324b3d]">{step.fertilizerName}</h3><span className="rounded-full bg-[#f0f0e6] px-2 py-1 text-[10px] font-semibold text-[#74806d]">{step.growthStage}</span></div><p className="mt-2 text-sm font-semibold text-[#5b704c]">{step.dosagePerAcre}</p><p className="mt-2 text-sm leading-6 text-[#657367]">{step.applicationMethod}</p><p className="mt-2 text-xs leading-5 text-[#80887d]">{step.timingNotes}</p></div></div></div>)}</div> : <EmptyState icon={Sprout} title="No fertilizer steps" copy="No fertilizer schedule was included in this advice." />}
      </Card>
      <div className="space-y-5">
        <Card className="overflow-hidden">
          <div className="border-b border-border/80 px-5 py-4 sm:px-6"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#71805e]">Water plan</p><h2 className="display-font mt-1 text-xl font-semibold text-[#2a4539]">Irrigation by stage</h2></div>
          {advisory.irrigationSchedule.length ? <div className="divide-y divide-border/75">{advisory.irrigationSchedule.map((step, index) => <div key={`${step.stage}-${index}`} className="px-5 py-4 sm:px-6"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-[#354e3e]">{step.stage}</h3><span className="rounded-full bg-[#e5ece9] px-2.5 py-1 text-[10px] font-semibold text-[#4e7771]">Every {step.waterFrequencyDays}</span></div><p className="mt-2 text-xs leading-5 text-[#737f75]">{step.criticalWarnings}</p></div>)}</div> : <div className="p-5 text-sm text-muted-foreground">No irrigation steps included.</div>}
        </Card>
        <Card className="p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#71805e]">Field watch</p><h2 className="display-font mt-1 text-lg font-semibold text-[#2a4539]">Risk level</h2></div><RiskBadge level={advisory.pestWarningLevel} /></div><div className="mt-5"><InfoList title="Recommended actions" values={advisory.recommendedActions} /></div></Card>
        <Card className="p-5 sm:p-6"><InfoList title="Ways to protect yield" values={advisory.yieldOptimizations} /><div className="mt-5 border-t border-border/80 pt-4 text-xs text-muted-foreground">Created {formatDate(advisory.createdAt)} · {advisory.irrigationMethod} irrigation</div></Card>
      </div>
    </div>
    <div className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-[#d7dcc5] bg-[#e9ecdc] p-4 text-xs text-[#637260]"><span className="font-bold">Soil test:</span><span>N {advisory.nitrogenLevel ?? 'not measured'}</span><span>· P {advisory.phosphorusLevel ?? 'not measured'}</span><span>· K {advisory.potassiumLevel ?? 'not measured'}</span><span>· pH {advisory.phLevel ?? 'not measured'}</span></div>
  </>;
}

function RiskBadge({ level }: { level: string }) {
  const color = level === 'Critical' || level === 'High' ? 'bg-[#f4e3dc] text-[#984f3b]' : level === 'Moderate' ? 'bg-[#f3ecd8] text-[#856c37]' : 'bg-[#e5ecdc] text-[#57744e]';
  return <span className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold', color)}><span className="h-1.5 w-1.5 rounded-full bg-current" />{level}</span>;
}

function SoilCalculatorPage() {
  const profileQuery = useGetProfile();
  const calculate = useCalculateSoil();
  const [cropName, setCropName] = useState('');
  const [area, setArea] = useState('');
  const [nitrogen, setNitrogen] = useState('');
  const [phosphorus, setPhosphorus] = useState('');
  const [potassium, setPotassium] = useState('');
  const [result, setResult] = useState<SoilCalculation | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile) return;
    if (!cropName && profile.primaryCrops[0]) setCropName(profile.primaryCrops[0]);
    if (!area && profile.farmSizeAcres) setArea(String(profile.farmSizeAcres));
  }, [profileQuery.data, cropName, area]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const values = [Number(nitrogen), Number(phosphorus), Number(potassium)];
    const parsedArea = Number(area);
    if (cropName.trim().length < 2 || cropName.trim().length > 80) { setError('Enter a crop name between 2 and 80 characters.'); return; }
    if (!Number.isFinite(parsedArea) || parsedArea <= 0) { setError('Enter a field area greater than 0 acres.'); return; }
    if ([nitrogen, phosphorus, potassium].some((value) => value === '') || values.some((value) => !Number.isFinite(value) || value < 0)) { setError('Enter all three measured soil values. Use 0 if a nutrient was not detected.'); return; }
    const input: SoilCalculationInput = { cropName: cropName.trim(), areaAcres: parsedArea, nitrogenLevel: values[0], phosphorusLevel: values[1], potassiumLevel: values[2], language: (profileQuery.data?.preferredLanguage || 'en') as SoilCalculationInput['language'] };
    calculate.mutate({ data: input }, { onSuccess: setResult, onError: (problem) => setError(errorMessage(problem)) });
  };
  return <>
    <PageTitle eyebrow="Read your soil test" title="Soil calculator" description="Enter the NPK values from your report to estimate fertilizer product quantities for one acre and your whole field." />
    <div className="grid items-start gap-5 xl:grid-cols-[.83fr_1.17fr]">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border/80 bg-[#e8ebd8] px-5 py-4 sm:px-6"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/70 text-[#52734c]"><Activity size={18} /></span><div><h2 className="display-font text-lg font-semibold text-[#2b4539]">Your soil report</h2><p className="text-xs text-[#728073]">Use the measured values as printed.</p></div></div>
        <form onSubmit={submit} className="space-y-5 p-5 sm:p-6">
          <Field id="soil-crop" label="Crop" value={cropName} onChange={setCropName} placeholder="For example, rice" required />
          <Field id="soil-area" label="Field area (acres)" value={area} onChange={setArea} type="number" min="0.01" step="0.01" placeholder="e.g. 2.5" inputMode="decimal" required />
          <div className="rounded-2xl border border-[#dedfd2] bg-[#f7f6ef] p-4"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-[#405747]">Measured NPK</p><span className="mono-font text-[9px] uppercase tracking-[.12em] text-[#859079]">mg/kg</span></div><div className="grid grid-cols-3 gap-3"><Field id="soil-n" label="Nitrogen" value={nitrogen} onChange={setNitrogen} type="number" min="0" step="0.1" placeholder="e.g. 120" required /><Field id="soil-p" label="Phosphorus" value={phosphorus} onChange={setPhosphorus} type="number" min="0" step="0.1" placeholder="e.g. 18" required /><Field id="soil-k" label="Potassium" value={potassium} onChange={setPotassium} type="number" min="0" step="0.1" placeholder="e.g. 95" required /></div></div>
          <div className="flex gap-2 rounded-xl bg-[#f0f0e6] p-3 text-xs leading-5 text-[#717d6d]"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#71875c]" />This is an estimate based on the crop and soil values you provide. Follow local recommendations and the product label.</div>
          {error && <p role="alert" data-testid="status-soil-error" className="rounded-xl bg-[#fbefeb] px-3.5 py-3 text-sm text-[#8b392f]">{error}</p>}
          <Button type="submit" className="w-full" disabled={calculate.isPending} testId="button-calculate-soil">{calculate.isPending ? <><LoaderCircle size={17} className="animate-spin" /> Working through the numbers…</> : <><Activity size={17} /> Estimate nutrient doses</>}</Button>
          {calculate.isPending && <div className="space-y-2" aria-label="Calculating"><div className="h-3 animate-pulse rounded bg-secondary" /><div className="h-3 w-3/4 animate-pulse rounded bg-secondary" /></div>}
        </form>
      </Card>
      <Card className="min-h-[390px] overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-4 sm:px-6"><div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#74835f]">The numbers, in practice</p><h2 className="display-font mt-1 text-xl font-semibold text-[#2a4539]">Estimated nutrient doses</h2></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e9ecd9] text-[#617b53]"><Sprout size={18} /></span></div>
        {calculate.isError && !error ? <div className="p-5"><QueryError message={calculate.error} retry={() => { setError('Review the values and submit again.'); }} /></div> : result ? <SoilResult result={result} /> : <EmptyState icon={Activity} title="Your results will grow here" copy="Add the crop, field area, and lab-measured NPK values to see product quantities per acre and for your whole field." />}
      </Card>
    </div>
  </>;
}

function SoilResult({ result }: { result: SoilCalculation }) {
  return <div className="p-5 sm:p-6">
    <div className="mb-5 rounded-2xl bg-[#e8ecd9] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#73805e]">For this field</span><h3 className="display-font mt-1 text-xl font-semibold text-[#2c4739]">{result.cropName}</h3></div><span className="rounded-full border border-[#cdd4bb] bg-[#f5f5e9] px-3 py-1.5 text-xs font-bold text-[#526b4c]">{result.areaAcres} acres</span></div></div>
    <div className="overflow-hidden rounded-2xl border border-border/80">
      <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-[#f0f0e6] px-4 py-3 text-[9px] font-bold uppercase tracking-[.12em] text-[#778174] sm:grid-cols-[1.1fr_1.25fr_.85fr_.85fr]"><span>Nutrient / test</span><span className="text-right">Need per acre</span><span className="hidden text-right sm:block">Product / acre</span><span className="text-right">Whole field</span></div>
      <div className="divide-y divide-border/75">{result.doses.map((dose, index) => <div key={`${dose.nutrient}-${index}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-4 sm:grid-cols-[1.1fr_1.25fr_.85fr_.85fr]">
        <div><p className="text-sm font-bold text-[#324b3c]">{dose.nutrient}</p><p className="mt-1 text-[10px] text-[#829084]">Soil: {dose.soilLevel}</p></div>
        <div className="text-right"><p className="text-sm font-semibold text-[#526c4d]">{dose.deficitKgPerAcre} kg/acre</p><p className="mt-1 text-[10px] text-[#829084]">target {dose.targetKgPerAcre}</p></div>
        <div className="hidden text-right sm:block"><p className="text-sm font-semibold text-[#425a4a]">{dose.productKgPerAcre} kg</p><p className="mt-1 max-w-[125px] truncate text-[10px] text-[#829084]">{dose.productName}</p></div>
        <div className="text-right"><p className="text-base font-bold text-[#2d493b]">{dose.productKgTotal} kg</p><p className="mt-1 text-[10px] text-[#829084] sm:hidden">{dose.productName}</p><p className="mt-1 hidden text-[10px] text-[#829084] sm:block">total product</p></div>
      </div>)}</div>
    </div>
    {result.assumptions.length > 0 && <div className="mt-5 rounded-xl border border-[#ded9c8] bg-[#f7f5eb] p-4"><h3 className="text-xs font-bold text-[#52624e]">How to read this estimate</h3><ul className="mt-2 space-y-1.5">{result.assumptions.map((assumption, index) => <li key={`${assumption}-${index}`} className="flex gap-2 text-xs leading-5 text-[#747d6e]"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#91a06c]" />{assumption}</li>)}</ul></div>}
  </div>;
}

function ProfilePage() {
  const profileQuery = useGetProfile();
  const saveProfile = useUpsertProfile();
  const queryClient = useQueryClient();
  const profile = profileQuery.data;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState('en');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [farmSize, setFarmSize] = useState('');
  const [soilType, setSoilType] = useState('Loamy');
  const [crops, setCrops] = useState('');
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');
  useEffect(() => {
    if (!profile) return;
    setName(profile.fullName);
    setPhone(profile.phoneNumber || '');
    setLanguage(profile.preferredLanguage);
    setLocation(profile.locationName || '');
    setLatitude(profile.latitude === null ? '' : String(profile.latitude));
    setLongitude(profile.longitude === null ? '' : String(profile.longitude));
    setFarmSize(profile.farmSizeAcres === null ? '' : String(profile.farmSizeAcres));
    setSoilType(profile.defaultSoilType || 'Loamy');
    setCrops(profile.primaryCrops.join(', '));
  }, [profile]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    setFormError('');
    if (name.trim().length < 2 || name.trim().length > 120) { setFormError('Name must be between 2 and 120 characters.'); return; }
    const nullableNumber = (value: string) => value.trim() ? Number(value) : null;
    const lat = nullableNumber(latitude);
    const lon = nullableNumber(longitude);
    const size = nullableNumber(farmSize);
    if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) { setFormError('Latitude must be between -90 and 90.'); return; }
    if (lon !== null && (!Number.isFinite(lon) || lon < -180 || lon > 180)) { setFormError('Longitude must be between -180 and 180.'); return; }
    if (size !== null && (!Number.isFinite(size) || size < 0)) { setFormError('Farm size cannot be negative.'); return; }
    const cropList = crops.split(',').map((crop) => crop.trim()).filter(Boolean);
    if (cropList.some((crop) => crop.length < 2 || crop.length > 80)) { setFormError('Each crop name must be between 2 and 80 characters.'); return; }
    const input: ProfileInput = {
      fullName: name.trim(),
      phoneNumber: phone.trim() || null,
      preferredLanguage: language as ProfileInput['preferredLanguage'],
      locationName: location.trim() || null,
      latitude: lat,
      longitude: lon,
      farmSizeAcres: size,
      defaultSoilType: soilType as ProfileInput['defaultSoilType'],
      primaryCrops: cropList,
      role: (profile?.role || 'farmer') as ProfileInput['role'],
    };
    saveProfile.mutate({ data: input }, { onSuccess: () => {
      setNotice('Your farm details are saved.');
      void queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    }, onError: (error) => setFormError(errorMessage(error)) });
  };
  if (profileQuery.isLoading) return <><PageTitle eyebrow="Your farm, your language" title="Farm profile" /><LoadingRows rows={4} /></>;
  if (profileQuery.isError && !profile) return <><PageTitle eyebrow="Your farm, your language" title="Farm profile" /><QueryError message={profileQuery.error} retry={() => { void profileQuery.refetch(); }} /></>;
  return <>
    <PageTitle eyebrow="Your farm, your language" title="Farm profile" description="Keep these details current to make field advice and local weather more useful." />
    <div className="mx-auto grid max-w-[1040px] gap-5 lg:grid-cols-[.65fr_1.35fr]">
      <Card className="h-fit overflow-hidden">
        <div className="field-contour bg-[#294b3f] p-5 text-[#eef0dc] sm:p-6"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#d6dd99] text-[#2b4a3a]"><Sprout size={23} /></div><h2 className="display-font mt-5 text-xl font-semibold">{name || 'Your farm'}</h2><p className="mt-1 text-sm text-[#c6d3c2]">{location || 'Add a location to bring your farm to life.'}</p></div>
        <div className="space-y-4 p-5 sm:p-6"><ProfileFact label="Farm size" value={farmSize ? `${farmSize} acres` : 'Not set'} /><ProfileFact label="Main soil" value={soilType || 'Not set'} /><ProfileFact label="Crops" value={crops || 'Not set'} /></div>
      </Card>
      <Card className="overflow-hidden">
        <div className="border-b border-border/80 px-5 py-4 sm:px-6"><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#74835f]">Farm details</p><h2 className="display-font mt-1 text-xl font-semibold text-[#2a4539]">Settings for better advice</h2></div>
        <form onSubmit={submit} className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2"><Field id="profile-name" label="Your name" value={name} onChange={setName} placeholder="Full name" required /><Field id="profile-phone" label="Phone number (optional)" value={phone} onChange={setPhone} placeholder="Phone number" /></div>
          <div className="grid gap-4 sm:grid-cols-2"><SelectField id="profile-language" label="Preferred language" value={language} onChange={setLanguage} options={languageOptions} /><Field id="profile-farm-size" label="Farm size (acres)" value={farmSize} onChange={setFarmSize} type="number" min="0" step="0.1" placeholder="e.g. 4.5" /></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field id="profile-location" label="Farm location" value={location} onChange={setLocation} placeholder="Village, district" /><SelectField id="profile-soil" label="Main soil type" value={soilType} onChange={setSoilType} options={soilOptions} /></div>
          <Field id="profile-crops" label="Main crops" value={crops} onChange={setCrops} placeholder="Rice, tomato, lentil" hint="Separate crop names with commas." />
          <div className="rounded-2xl border border-[#dedfd2] bg-[#f7f6ef] p-4"><div className="mb-3 flex items-start gap-2"><MapPin size={16} className="mt-0.5 text-[#68815b]" /><div><p className="text-sm font-semibold text-[#405747]">Coordinates for local weather</p><p className="text-xs leading-5 text-[#869084]">Optional · find these in your map app, or leave blank.</p></div></div><div className="grid gap-3 sm:grid-cols-2"><Field id="profile-latitude" label="Latitude" value={latitude} onChange={setLatitude} type="number" min="-90" max="90" step="any" placeholder="e.g. 17.385" /><Field id="profile-longitude" label="Longitude" value={longitude} onChange={setLongitude} type="number" min="-180" max="180" step="any" placeholder="e.g. 78.487" /></div></div>
          {notice && <p role="status" data-testid="status-profile-saved" className="flex items-center gap-2 rounded-xl bg-[#e6eddc] px-3.5 py-3 text-sm text-[#4d7049]"><CheckCircle2 size={16} />{notice}</p>}
          {formError && <p role="alert" data-testid="status-profile-error" className="rounded-xl bg-[#fbefeb] px-3.5 py-3 text-sm text-[#8b392f]">{formError}</p>}
          <Button type="submit" disabled={saveProfile.isPending} className="w-full sm:w-auto" testId="button-save-profile">{saveProfile.isPending ? <><LoaderCircle size={16} className="animate-spin" /> Saving…</> : <><Check size={16} /> Save farm details</>}</Button>
        </form>
      </Card>
    </div>
  </>;
}

function ProfileFact({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 border-b border-border/70 pb-3 last:border-0 last:pb-0"><span className="text-xs text-muted-foreground">{label}</span><span className="max-w-[65%] text-right text-sm font-semibold text-[#425a4a]">{value}</span></div>;
}

function ChatPage() {
  const conversationQuery = useListGeminiConversations();
  const createConversation = useCreateGeminiConversation();
  const deleteConversation = useDeleteGeminiConversation();
  const profileQuery = useGetProfile();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [localMessages, setLocalMessages] = useState<GeminiMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamError, setStreamError] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const conversations = conversationQuery.data ?? [];
  const messagesQuery = useListGeminiMessages(activeId || '', { query: { enabled: Boolean(activeId), queryKey: getListGeminiMessagesQueryKey(activeId || '') } });
  const conversationDetail = useGetGeminiConversation(activeId || '', { query: { enabled: Boolean(activeId), queryKey: getGetGeminiConversationQueryKey(activeId || '') } });
  const serverMessages = messagesQuery.data ?? conversationDetail.data?.messages ?? [];
  const messages = [...serverMessages, ...localMessages.filter((local) => !serverMessages.some((server) => server.content === local.content && server.role === local.role))];
  const selected = conversations.find((conversation) => conversation.id === activeId) ?? null;
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages.length, streamingText, streaming]);
  const createNew = () => {
    if (streaming || createConversation.isPending) return;
    createConversation.mutate({ data: { title: `Field question · ${new Date().toLocaleDateString()}`, language: profileQuery.data?.preferredLanguage || 'en' } }, {
      onSuccess: (conversation) => {
        setActiveId(conversation.id);
        setDraft('');
        setLocalMessages([]);
        void queryClient.invalidateQueries({ queryKey: getListGeminiConversationsQueryKey() });
      },
    });
  };
  const parseEvent = (payload: string, onText: (token: string) => void) => {
    if (!payload || payload === '[DONE]') return;
    try {
      const parsed: unknown = JSON.parse(payload);
      if (typeof parsed === 'string') { onText(parsed); return; }
      if (parsed && typeof parsed === 'object') {
        const value = parsed as Record<string, unknown>;
        const nested = value.message && typeof value.message === 'object' ? value.message as Record<string, unknown> : null;
        const token = value.delta ?? value.text ?? value.content ?? value.token ?? nested?.content;
        if (typeof token === 'string') onText(token);
      }
    } catch { onText(payload); }
  };
  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !activeId || streaming) return;
    setDraft('');
    setStreamError('');
    setStreamingText('');
    const conversationId = activeId;
    const userMessage: GeminiMessage = { id: `local-user-${Date.now()}`, conversationId, role: 'user', content, createdAt: new Date().toISOString() };
    const assistantId = `local-assistant-${Date.now()}`;
    setLocalMessages((previous) => [...previous, userMessage]);
    setStreaming(true);
    let assembled = '';
    const append = (token: string) => { assembled += token; setStreamingText(assembled); };
    try {
      const response = await fetch(`/api/gemini/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error(response.status === 401 ? 'Sign in again to continue this conversation.' : `The reply could not be loaded (${response.status}).`);
      if (!response.body) throw new Error('This connection cannot stream the reply. Please try again on a steadier connection.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? '';
        for (const block of blocks) {
          const data = block.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
          if (data) parseEvent(data, append);
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) {
        const data = buffer.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
        if (data) parseEvent(data, append);
      }
      if (assembled.trim()) {
        const assistantMessage: GeminiMessage = { id: assistantId, conversationId, role: 'assistant', content: assembled, createdAt: new Date().toISOString() };
        setLocalMessages((previous) => [...previous, assistantMessage]);
      }
      void queryClient.invalidateQueries({ queryKey: getListGeminiMessagesQueryKey(conversationId) });
      void queryClient.invalidateQueries({ queryKey: getGetGeminiConversationQueryKey(conversationId) });
      void queryClient.invalidateQueries({ queryKey: getListGeminiConversationsQueryKey() });
    } catch (error) {
      setStreamError(errorMessage(error));
    } finally {
      setStreaming(false);
    }
  };
  const selectConversation = (conversation: GeminiConversation) => {
    setActiveId(conversation.id);
    setLocalMessages([]);
    setStreamError('');
    setHistoryOpen(false);
  };
  const removeConversation = (conversation: GeminiConversation) => {
    if (!window.confirm(`Delete “${conversation.title}” and its messages?`)) return;
    deleteConversation.mutate({ id: conversation.id }, { onSuccess: () => {
      if (activeId === conversation.id) { setActiveId(null); setLocalMessages([]); }
      void queryClient.invalidateQueries({ queryKey: getListGeminiConversationsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetGeminiConversationQueryKey(conversation.id) });
      void queryClient.invalidateQueries({ queryKey: getListGeminiMessagesQueryKey(conversation.id) });
    } });
  };
  const suggested = ['What should I check on my crop this week?', 'How can I tell if my plants need more water?', 'What can I do about yellowing leaves?'];
  return <>
    <PageTitle eyebrow="A second opinion, in plain language" title="Ask an agronomist" description="Ask about crop care, soil, water, or a symptom. Keep each conversation in your field notebook." action={<Button variant="secondary" onClick={createNew} disabled={createConversation.isPending || streaming} testId="button-new-conversation"><Plus size={16} /> New conversation</Button>} />
    {createConversation.isError && <div className="mb-4"><QueryError message={createConversation.error} retry={createNew} /></div>}
    {deleteConversation.isError && <p role="alert" className="mb-4 rounded-xl bg-[#fbefeb] px-4 py-3 text-sm text-[#8b392f]">{errorMessage(deleteConversation.error)}</p>}
    <div className="grid min-h-[calc(100dvh-250px)] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_24px_rgba(42,61,47,.055)] lg:grid-cols-[300px_1fr]">
      <aside className={cx('border-r border-border bg-[#f6f4eb] lg:block', historyOpen ? 'block' : 'hidden')}>
        <div className="flex items-center justify-between border-b border-border/80 px-4 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#788466]">Saved chats</p><h2 className="display-font mt-1 text-lg font-semibold text-[#2a4539]">Your history</h2></div><button type="button" data-testid="button-close-chat-history" onClick={() => setHistoryOpen(false)} aria-label="Close history" className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary lg:hidden"><X size={17} /></button></div>
        {conversationQuery.isLoading ? <div className="p-4"><LoadingRows rows={4} /></div> : conversationQuery.isError ? <div className="p-4"><QueryError message={conversationQuery.error} retry={() => { void conversationQuery.refetch(); }} /></div> : conversations.length === 0 ? <EmptyState icon={MessageCircle} title="No conversations yet" copy="Start a new chat and your questions will stay here." /> : <div className="max-h-[65dvh] overflow-y-auto p-2.5">{conversations.map((conversation) => <div key={conversation.id} className={cx('group flex items-center gap-1 rounded-xl px-1 transition', activeId === conversation.id ? 'bg-[#e8ebd9]' : 'hover:bg-[#efeee4]')}>
          <button type="button" data-testid={`conversation-${conversation.id}`} onClick={() => selectConversation(conversation)} className="min-h-[62px] min-w-0 flex-1 px-3 py-2.5 text-left"><span className="block truncate text-sm font-semibold text-[#354b3e]">{conversation.title}</span><span className="mt-1 block text-[10px] text-[#818a7e]">{formatDate(conversation.updatedAt)}</span></button>
          <button type="button" aria-label={`Delete ${conversation.title}`} data-testid={`button-delete-conversation-${conversation.id}`} onClick={() => removeConversation(conversation)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#917769] opacity-70 transition hover:bg-[#f4e8df] hover:text-[#8c4f40] sm:opacity-0 sm:group-hover:opacity-100"><Trash2 size={14} /></button>
        </div>)}</div>}
        <div className="border-t border-border/80 p-3"><Button variant="secondary" className="w-full" onClick={createNew} disabled={createConversation.isPending || streaming}><Plus size={15} /> Start a new chat</Button></div>
      </aside>
      <section className={cx('relative flex min-h-[62dvh] flex-col lg:min-h-[670px]', historyOpen && 'hidden lg:flex')}>
        <div className="flex items-center justify-between border-b border-border/80 px-4 py-3.5 sm:px-5"><div className="flex items-center gap-3"><button type="button" data-testid="button-open-chat-history" aria-label="Open conversation history" onClick={() => setHistoryOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg text-[#71806f] transition hover:bg-secondary lg:hidden"><Menu size={18} /></button><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e7ecd9] text-[#57754d]"><MessageCircle size={17} /></span><div><p className="text-sm font-semibold text-[#354b3e]">{selected?.title || (activeId ? conversationDetail.data?.title : null) || 'A fresh field question'}</p><p className="text-[10px] text-[#818a7e]">Agronomy chat · {profileQuery.data?.preferredLanguage || 'English'}</p></div></div><span className="hidden items-center gap-1.5 rounded-full bg-[#edf0e2] px-2.5 py-1.5 text-[10px] font-semibold text-[#637855] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#79945e]" />Replies stream live</span></div>
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          {!activeId ? <div className="mx-auto flex min-h-[42vh] max-w-lg flex-col items-center justify-center text-center">
            <span className="grid h-14 w-14 place-items-center rounded-[19px] bg-[#e6ead8] text-[#56764f]"><Sprout size={25} /></span><h3 className="display-font mt-5 text-2xl font-semibold tracking-[-.04em] text-[#2c4739]">A question from the field?</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[#7a8579]">Start a conversation and get a clear answer you can bring back to your crop.</p><Button onClick={createNew} disabled={createConversation.isPending} className="mt-5"><Plus size={16} /> Start a conversation</Button>
            <div className="mt-8 grid w-full gap-2 sm:grid-cols-3">{suggested.map((prompt, index) => <button key={prompt} type="button" data-testid={`button-suggest-question-${index}`} onClick={() => { if (createConversation.isPending) return; createConversation.mutate({ data: { title: prompt.slice(0, 72), language: profileQuery.data?.preferredLanguage || 'en' } }, { onSuccess: (conversation) => { setActiveId(conversation.id); setDraft(prompt); } }); }} className="min-h-[68px] rounded-xl border border-border bg-[#fbfaf4] px-3 py-3 text-left text-xs leading-5 text-[#657366] transition hover:border-[#bac6a4] hover:bg-[#f2f3e8]">{prompt}<ArrowUpRight size={13} className="mt-1 text-[#71875e]" /></button>)}</div>
          </div> : messagesQuery.isLoading && !messages.length ? <div className="mx-auto max-w-2xl space-y-4"><div className="h-16 animate-pulse rounded-2xl bg-secondary" /><div className="ml-auto h-16 w-3/4 animate-pulse rounded-2xl bg-secondary" /><div className="h-16 w-4/5 animate-pulse rounded-2xl bg-secondary" /></div> : messagesQuery.isError && !messages.length ? <div className="mx-auto max-w-lg pt-10"><QueryError message={messagesQuery.error} retry={() => { void messagesQuery.refetch(); }} /></div> : messages.length === 0 ? <div className="mx-auto max-w-xl py-12 text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e9ecd9] text-[#617b53] mx-auto"><Leaf size={20} /></span><h3 className="display-font mt-4 text-xl font-semibold text-[#2c4739]">What’s happening in your field?</h3><p className="mt-2 text-sm text-[#7a8579]">Share the crop, its stage, and what you’re seeing.</p></div> : <div className="mx-auto max-w-3xl space-y-5">{messages.map((message) => <ChatBubble key={message.id} message={message} />)}{streaming && <div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#e8ecd9] text-[#5b7851]"><Sprout size={16} /></span><div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[#f0f1e7] px-4 py-3.5 text-sm leading-6 text-[#526456]">{streamingText || <span className="inline-flex items-center gap-2 text-xs text-[#738171]"><span className="flex gap-1"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8a9b6c]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8a9b6c] [animation-delay:150ms]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8a9b6c] [animation-delay:300ms]" /></span>Thinking through your question</span>}</div></div>}{streamError && <p role="alert" data-testid="status-chat-error" className="ml-11 rounded-xl bg-[#fbefeb] px-3.5 py-3 text-sm text-[#8b392f]">{streamError}</p>}</div>}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={sendMessage} className="border-t border-border/80 bg-[#faf9f2] p-3 sm:p-4">
          {!activeId && <div className="mb-2 text-center text-[10px] text-[#90978a]">Choose a suggestion or start a conversation to write a message.</div>}
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-[#d9dccd] bg-card p-2 shadow-[0_3px_12px_rgba(42,61,47,.04)] focus-within:border-[#99a985]">
            <textarea data-testid="input-chat-message" aria-label="Your message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (activeId) void sendMessage(event as unknown as FormEvent); } }} disabled={!activeId || streaming} placeholder={activeId ? 'Ask about your crop, soil, or next step…' : 'Start a conversation to ask a question'} rows={1} className="max-h-32 min-h-[42px] flex-1 resize-y border-0 bg-transparent px-2 py-2 text-sm leading-6 outline-none placeholder:text-[#969d91] focus:ring-0 disabled:opacity-50" />
            <button type="submit" aria-label="Send message" data-testid="button-send-message" disabled={!activeId || !draft.trim() || streaming} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#315d4b] text-white transition hover:bg-[#254a3a] disabled:cursor-not-allowed disabled:bg-[#c7cdbd]"><Send size={17} /></button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] leading-4 text-[#92998d]">Advice is a starting point. Check important decisions with a local agronomist.</p>
        </form>
      </section>
    </div>
  </>;
}

function ChatBubble({ message }: { message: GeminiMessage }) {
  const user = message.role === 'user';
  return <div data-testid={`chat-message-${message.id}`} className={cx('flex gap-3', user && 'justify-end')}>
    {!user && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#e8ecd9] text-[#5b7851]"><Sprout size={16} /></span>}
    <div className={cx('max-w-[86%] rounded-2xl px-4 py-3.5 text-sm leading-6 sm:max-w-[78%]', user ? 'rounded-tr-sm bg-[#315d4b] text-[#f2f0df]' : 'rounded-tl-sm bg-[#f0f1e7] text-[#526456]')}><p className="whitespace-pre-wrap">{message.content}</p><p className={cx('mt-2 text-[9px]', user ? 'text-[#c4d4bd]' : 'text-[#8c9687]')}>{user ? 'You' : 'Field guide'} · {formatDate(message.createdAt)}</p></div>
    {user && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e8ead9] text-[10px] font-bold text-[#4b6950]">You</span>}
  </div>;
}

function SignInPage() {
  return <div className="paper-texture flex min-h-[100dvh] items-center justify-center bg-[#eef0e3] px-4 py-10"><div className="w-full max-w-[440px]"><div className="mb-5 text-center"><p className="display-font text-xl font-semibold tracking-[-.04em] text-[#2c493b]">Come back to your field desk.</p><p className="mt-1 text-sm text-[#748174]">Your farm notes will be here.</p></div><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div></div>;
}

function SignUpPage() {
  return <div className="paper-texture flex min-h-[100dvh] items-center justify-center bg-[#eef0e3] px-4 py-10"><div className="w-full max-w-[440px]"><div className="mb-5 text-center"><p className="display-font text-xl font-semibold tracking-[-.04em] text-[#2c493b]">Let’s start with your farm.</p><p className="mt-1 text-sm text-[#748174]">A few details make every answer more useful.</p></div><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div></div>;
}

function ClerkCacheInvalidator() {
  const { addListener } = useClerk();
  const cache = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) cache.clear();
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, cache]);
  return null;
}

function AuthRouter() {
  const [, setLocation] = useLocation();
  const stripBase = (path: string) => basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to return to your farm' } }, signUp: { start: { title: 'Set up your farm', subtitle: 'A better field plan starts here' } } }} routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace: true })}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ClerkCacheInvalidator />
        <RoutedErrorBoundary><Switch>
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/" component={HomeRoute} />
          <Route path="/dashboard">{() => <Protected><Shell><DashboardPage /></Shell></Protected>}</Route>
          <Route path="/diagnosis">{() => <Protected><Shell><DiagnosisPage /></Shell></Protected>}</Route>
          <Route path="/advisory/new">{() => <Protected><Shell><AdvisoryNewPage /></Shell></Protected>}</Route>
          <Route path="/advisory/:id">{() => <Protected><Shell><AdvisoryDetailPage /></Shell></Protected>}</Route>
          <Route path="/chat">{() => <Protected><Shell><ChatPage /></Shell></Protected>}</Route>
          <Route path="/soil-calculator">{() => <Protected><Shell><SoilCalculatorPage /></Shell></Protected>}</Route>
          <Route path="/profile">{() => <Protected><Shell><ProfilePage /></Shell></Protected>}</Route>
          <Route component={NotFoundPage} />
        </Switch></RoutedErrorBoundary>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  </ClerkProvider>;
}

function NotFoundPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-[#f3f1e7] px-5"><div className="max-w-md text-center"><span className="mono-font text-xs font-bold uppercase tracking-[.18em] text-[#83906a]">Field note 404</span><h1 className="display-font mt-3 text-4xl font-semibold tracking-[-.05em] text-[#284439]">This path has gone quiet.</h1><p className="mt-3 text-sm leading-6 text-[#738075]">The page may have moved. Your saved farm advice is still in your notebook.</p><Link href="/dashboard" data-testid="link-not-found-home" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#315d4b] px-5 text-sm font-semibold text-white">Back to your farm <ArrowRight size={15} /></Link></div></div>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function weekday(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
}

function readCache<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch { return null; }
}

function writeCache(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage can be disabled or full. */ }
}

function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return <div className="paper-texture"><WouterRouter base={basePath}><AuthRouter /></WouterRouter></div>;
}

export default App;
