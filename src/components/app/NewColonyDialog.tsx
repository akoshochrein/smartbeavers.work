import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useColonies } from "@/lib/colonies";
import { supabase } from "@/lib/supabase";
import { FactionPicker } from "@/components/app/FactionPicker";
import type { FactionKey } from "@/shared/goods";

export function NewColonyDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [faction, setFaction] = useState<FactionKey>();
  const [saving, setSaving] = useState(false);
  const { reload } = useColonies();
  const navigate = useNavigate();

  async function create(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await supabase.from("colonies").insert({ name: name.trim(), faction }).select().single();
    setSaving(false);
    if (error) return toast.error(`Couldn't create the colony: ${error.message}`);
    await reload();
    setOpen(false);
    setName("");
    setFaction(undefined);
    toast.success(`${data.name} created`);
    navigate(`/colonies/${data.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={create} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-bold tracking-tight">New colony</DialogTitle>
            <DialogDescription>Use one colony per save. You'll get its links on the next screen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="colony-name">Colony name</Label>
            <Input
              id="colony-name"
              required
              autoFocus
              maxLength={80}
              placeholder="Folktails on the Plains"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Faction</div>
            <FactionPicker id="new-colony-faction" value={faction} onChange={setFaction} />
            <p className="text-sm text-ink-soft">Decides which goods you're offered to track. You can change it later.</p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || !name.trim() || !faction}>
              {saving ? "Creating…" : "Create colony"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
