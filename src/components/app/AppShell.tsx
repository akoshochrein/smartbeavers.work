import { ChevronsUpDown, LogOut, Plus } from "lucide-react";
import { NavLink, Outlet, useParams } from "react-router";
import { Logo } from "@/components/brand/Logo";
import { NewColonyDialog } from "@/components/app/NewColonyDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { ColoniesProvider, useColonies } from "@/lib/colonies";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function AppShell() {
  return (
    <ColoniesProvider>
      <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
        <Sidebar />
        <MobileBar />
        <main className="min-w-0">
          <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
            <Outlet />
          </div>
        </main>
      </div>
    </ColoniesProvider>
  );
}

function Sidebar() {
  const { colonies } = useColonies();
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col bg-pine text-mist lg:flex">
      <div className="px-6 pt-6 pb-8">
        <Logo to="/dashboard" />
      </div>
      <div className="flex items-center px-6 pb-2">
        <span className="text-sm text-sage">Colonies</span>
        <NewColonyDialog>
          <Button size="icon-sm" variant="ghost" className="ml-auto text-sage hover:bg-pine-soft hover:text-mist" aria-label="New colony">
            <Plus />
          </Button>
        </NewColonyDialog>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {colonies === undefined
          ? [0, 1].map((i) => <Skeleton key={i} className="mx-3 my-2 h-5 bg-pine-soft" />)
          : colonies.map((c) => (
              <NavLink
                key={c.id}
                to={`/colonies/${c.id}`}
                className={({ isActive }) =>
                  cn(
                    "relative block truncate rounded-lg px-3 py-2 text-[15px] text-sage transition-colors hover:bg-pine-soft hover:text-mist",
                    isActive && "bg-pine-soft font-medium text-mist before:absolute before:top-2 before:bottom-2 before:-left-3 before:w-1 before:rounded-r-full before:bg-resin",
                  )
                }
              >
                {c.name}
              </NavLink>
            ))}
        {colonies?.length === 0 && <p className="px-3 py-2 text-sm text-sage">No colonies yet.</p>}
      </nav>
      <AccountMenu />
    </aside>
  );
}

function AccountMenu() {
  const { session } = useAuth();
  const email = session?.user.email ?? "";
  return (
    <div className="border-t border-sidebar-border p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-sage hover:bg-pine-soft hover:text-mist">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-heartwood font-display text-base font-bold text-mist uppercase">
              {email.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1 truncate">{email}</span>
            <ChevronsUpDown className="size-4 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-60">
          <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => supabase.auth.signOut()}>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function MobileBar() {
  const { colonies } = useColonies();
  const { id } = useParams();
  const current = colonies?.find((c) => c.id === id);
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 bg-pine px-4 py-3 text-mist lg:hidden">
      <Logo to="/dashboard" className="[&_span]:text-xl" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="ml-auto max-w-[45vw] text-sage hover:bg-pine-soft hover:text-mist">
            <span className="truncate">{current?.name ?? "Colonies"}</span>
            <ChevronsUpDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {colonies?.map((c) => (
            <DropdownMenuItem key={c.id} asChild>
              <NavLink to={`/colonies/${c.id}`}>{c.name}</NavLink>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <NavLink to="/dashboard">All colonies</NavLink>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => supabase.auth.signOut()}>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
