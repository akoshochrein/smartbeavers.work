import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Button, Card } from "../components/ui";
import { supabase, type Colony } from "../lib/supabase";

export function Dashboard() {
  const [colonies, setColonies] = useState<Colony[]>();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();

  async function load() {
    const { data, error } = await supabase.from("colonies").select("*").order("created_at");
    if (error) setError(error.message);
    else setColonies(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("colonies").insert({ name: name.trim() });
    if (error) return setError(error.message);
    setName("");
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Your colonies</h1>
      {error && <p className="text-sm text-ember-500">{error}</p>}

      <Card title="New colony">
        <form onSubmit={create} className="flex gap-2">
          <input
            required
            maxLength={80}
            placeholder="e.g. Folktails on Plains"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-bark-200 bg-white px-3 py-1.5"
          />
          <Button type="submit">Create</Button>
        </form>
      </Card>

      {colonies === undefined ? (
        <p className="text-bark-500">Loading…</p>
      ) : colonies.length === 0 ? (
        <p className="text-bark-500">No colonies yet. Create one to get your webhook URLs.</p>
      ) : (
        <ul className="divide-y divide-bark-200 rounded-xl border border-bark-200 bg-white/70">
          {colonies.map((c) => (
            <li key={c.id}>
              <Link to={`/colonies/${c.id}`} className="flex items-center px-4 py-3 hover:bg-bark-100">
                <span className="font-medium">{c.name}</span>
                <span className="ml-auto font-mono text-xs text-bark-500">{c.api_base_url}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
