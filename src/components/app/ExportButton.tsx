import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Runs an export and shows progress; `run` should throw if anything couldn't be read. */
export function ExportButton({ run, className }: { run: () => Promise<void>; className?: string }) {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await run();
      toast.success("Export downloaded");
    } catch {
      toast.error("Couldn't finish the export, so no file was made. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="outline" onClick={go} disabled={busy} className={className}>
      <Download /> {busy ? "Collecting…" : "Download export"}
    </Button>
  );
}
