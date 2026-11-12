import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { DateSetter } from "@/components/app/DateSetter";
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
import { setGameDate } from "@/lib/clock";
import { formatGameDate } from "@/shared/clock";

/** "Set the date" like a wall clock: whatever the game shows now becomes the clock's date. */
export function SetDateDialog({
  colonyId,
  current,
  onSet,
  children,
}: {
  colonyId: string;
  current: { cycle: number; day: number } | undefined;
  onSet: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(current ?? { cycle: 1, day: 1 });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await setGameDate(colonyId, value.cycle, value.day);
    setSaving(false);
    if (error) return toast.error(`Couldn't set the date: ${error.message}`);
    toast.success(`Clock set to ${formatGameDate(value.cycle, value.day)}`);
    setOpen(false);
    onSet();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setValue(current ?? { cycle: 1, day: 1 });
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-bold tracking-tight">Set the date</DialogTitle>
          <DialogDescription>Enter the cycle and day the game's calendar shows right now. The clock counts on from here.</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <DateSetter cycle={value.cycle} day={value.day} onChange={setValue} />
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "Setting…" : "Set the date"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
