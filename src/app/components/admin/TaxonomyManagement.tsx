"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import Layout from "./Layout";
import Loading from "../Loading";

interface Entry {
  id: number;
  name: string;
}
interface Props {
  endpoint: string;
  title: string;
  itemLabel: string;
}

// The four taxonomy pages share the same validated CRUD behavior.
export default function TaxonomyManagement({ endpoint, title, itemLabel }: Props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error("Unable to load entries");
      setEntries(await response.json());
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to load entries");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (status === "authenticated" && session.user.role === "ADMIN") void load();
    else if (
      status === "unauthenticated" ||
      (status === "authenticated" && session.user.role !== "ADMIN")
    )
      router.replace("/");
  }, [load, router, session, status]);

  const cancel = () => {
    setShowForm(false);
    setEditingId(null);
    setName("");
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: editingId === null ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, name: name.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? body.message ?? "Unable to save entry");
      cancel();
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save entry");
    } finally {
      setSaving(false);
    }
  };
  const remove = async (id: number) => {
    const result = await Swal.fire({
      title: "Delete this entry?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
    });
    if (!result.isConfirmed || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? body.message ?? "Unable to delete entry");
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to delete entry");
    } finally {
      setSaving(false);
    }
  };

  if (status !== "authenticated" || session.user.role !== "ADMIN" || loading) return <Loading />;
  const filtered = entries.filter((entry) =>
    entry.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <Layout>
      <main className="p-4 sm:p-8 max-w-7xl mx-auto">
        <div className="flex flex-wrap justify-between gap-4">
          <h1 className="text-2xl font-bold">{title}</h1>
          <button
            className="bg-black text-white px-4 py-2 rounded"
            disabled={saving}
            onClick={() => {
              cancel();
              setShowForm(true);
            }}
          >
            Add {itemLabel}
          </button>
        </div>
        <label className="block mt-6">
          Search
          <input
            className="border p-2 block w-full sm:w-1/2"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            list="taxonomy-suggestions"
          />
        </label>
        <datalist id="taxonomy-suggestions">
          {filtered.slice(0, 10).map((entry) => (
            <option key={entry.id} value={entry.name} />
          ))}
        </datalist>
        {error && (
          <p role="alert" className="text-red-600 my-4">
            {error}{" "}
            <button className="underline" onClick={load}>
              Retry
            </button>
          </p>
        )}
        {showForm && (
          <form onSubmit={save} className="flex flex-wrap gap-3 my-6">
            <label>
              {itemLabel} name
              <input
                required
                maxLength={100}
                className="border p-2 block"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <button className="bg-black text-white px-4 rounded" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" className="underline" disabled={saving} onClick={cancel}>
              Cancel
            </button>
          </form>
        )}
        <div className="overflow-x-auto mt-6">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="p-3">ID</th>
                <th>Name</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id} className="border-b">
                  <td className="p-3">{entry.id}</td>
                  <td>{entry.name}</td>
                  <td className="flex gap-4 py-3">
                    <button
                      className="underline"
                      disabled={saving}
                      onClick={() => {
                        setEditingId(entry.id);
                        setName(entry.name);
                        setShowForm(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="underline text-red-600"
                      disabled={saving}
                      onClick={() => remove(entry.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && <p className="py-6">No entries found.</p>}
      </main>
    </Layout>
  );
}
