'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { getCharacters } from '@/lib/api/taxonomy';
import { createCharacter, updateCharacter, deleteCharacter } from '@/lib/api/admin-catalog';

interface CharacterItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  _count?: { catalogEntries: number };
}

export default function AdminCharactersPage() {
  const t = useTranslations('admin.content');
  const tCommon = useTranslations('common');

  const [items, setItems] = useState<CharacterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<CharacterItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCharacters(1, 100);
      setItems(res.data as CharacterItem[]);
    } catch {
      toast.error(tCommon('error'));
    } finally {
      setLoading(false);
    }
  }, [tCommon]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openCreate = () => { setEditItem(null); setName(''); setDescription(''); setDialogOpen(true); };
  const openEdit = (item: CharacterItem) => { setEditItem(item); setName(item.name); setDescription(item.description ?? ''); setDialogOpen(true); };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editItem) { await updateCharacter(editItem.id, { name, description: description || undefined }); }
      else { await createCharacter({ name, description: description || undefined }); }
      toast.success(editItem ? t('saveSuccess') : t('createSuccess'));
      setDialogOpen(false);
      fetchItems();
    } catch { toast.error(tCommon('error')); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteCharacter(deleteId);
      toast.success(t('deleteSuccess'));
      setDeleteId(null);
      fetchItems();
    } catch { toast.error(t('deleteError')); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t('characters')}</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />{t('create')}</Button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('name')}</TableHead>
              <TableHead>{t('slug')}</TableHead>
              <TableHead>{t('description')}</TableHead>
              <TableHead>{t('catalogEntries')}</TableHead>
              <TableHead className="text-right">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const count = item._count?.catalogEntries ?? 0;
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.slug}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{item.description ?? '—'}</TableCell>
                  <TableCell>{count}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>{tCommon('edit')}</Button>
                      <Button size="sm" variant="destructive" disabled={count > 0} onClick={() => setDeleteId(item.id)} title={count > 0 ? t('cannotDelete') : undefined}>{tCommon('delete')}</Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? t('editTitle') : t('createTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>{t('name')} *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1"><Label>{t('description')}</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{tCommon('cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>{editItem ? t('save') : t('create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('confirmDelete')}</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>{tCommon('cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete}>{tCommon('delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
