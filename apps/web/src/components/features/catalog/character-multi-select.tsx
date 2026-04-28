'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { getCharacters, getCharactersByIds, type Character } from '@/lib/api/taxonomy';

interface Props {
  /** Ids selecionados (controlado). */
  value: string[];
  /** Callback ao mudar selecao. */
  onChange: (ids: string[]) => void;
  /** Placeholder do input de busca. */
  placeholder?: string;
  /** Quantos resultados exibir por busca. */
  limit?: number;
}

/**
 * Picker multi-selecao de personagens com busca server-side.
 *
 * Carrega os personagens ja selecionados na montagem (resolve nome/slug
 * pra renderizar como chips). Conforme o usuario digita no input, faz
 * requests ao /characters?search=... com debounce de 250ms e mostra
 * dropdown de resultados. Click adiciona ao value, X no chip remove.
 *
 * Usado em catalog-form.tsx (admin) — substitui a lista de checkboxes que
 * tentava carregar 12k personagens e quebrava.
 */
export function CharacterMultiSelect({
  value,
  onChange,
  placeholder = 'Buscar personagens...',
  limit = 12,
}: Props) {
  const [selected, setSelected] = useState<Character[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Character[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hidratar selecionados ao montar (e quando value muda externamente)
  useEffect(() => {
    let cancelled = false;
    const knownIds = new Set(selected.map((c) => c.id));
    const newIds = value.filter((id) => !knownIds.has(id));
    if (newIds.length === 0) {
      // Remover selecionados que sairam de value
      setSelected((prev) => prev.filter((c) => value.includes(c.id)));
      return;
    }
    getCharactersByIds(newIds).then((fetched) => {
      if (cancelled) return;
      setSelected((prev) => {
        const merged = [...prev, ...fetched];
        // Mantem a ordem de value
        const map = new Map(merged.map((c) => [c.id, c]));
        return value.map((id) => map.get(id)).filter((c): c is Character => !!c);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  // Buscar conforme digita (debounce)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length === 0) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await getCharacters(1, limit, query);
        setResults(r.data);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, limit]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function add(c: Character) {
    if (value.includes(c.id)) return;
    onChange([...value, c.id]);
    setQuery('');
    setResults([]);
  }

  function remove(id: string) {
    onChange(value.filter((x) => x !== id));
  }

  const visibleResults = results.filter((c) => !value.includes(c.id));

  return (
    <div ref={wrapperRef} className="space-y-2">
      {/* Selecionados */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs"
            >
              {c.name}
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="rounded-full p-0.5 hover:bg-primary/20"
                aria-label={`Remover ${c.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input de busca + dropdown */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="pl-8"
          />
        </div>

        {open && query.trim().length > 0 && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
            {loading && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Buscando...</div>
            )}
            {!loading && visibleResults.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Nenhum personagem encontrado para &quot;{query}&quot;
              </div>
            )}
            {!loading && visibleResults.length > 0 && (
              <ul className="max-h-64 overflow-y-auto">
                {visibleResults.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => add(c)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span>{c.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
