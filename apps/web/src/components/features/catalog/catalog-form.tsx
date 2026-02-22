'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createCatalogEntrySchema, type CreateCatalogEntryInput } from '@comicstrunk/contracts';
import { useTranslations } from 'next-intl';
import { BookOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getCategories, getCharacters, getTags, type Category, type Character } from '@/lib/api/taxonomy';
import { getSeries, type Series } from '@/lib/api/series';
import type { CatalogEntry } from '@/lib/api/catalog';

interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface CatalogFormProps {
  entry?: CatalogEntry;
  onSubmit: (data: CreateCatalogEntryInput, coverFile?: File) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function CatalogForm({ entry, onSubmit, onCancel, loading }: CatalogFormProps) {
  const t = useTranslations('admin.catalog');
  const tCommon = useTranslations('common');

  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(entry?.coverImageUrl ?? null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateCatalogEntryInput>({
    resolver: zodResolver(createCatalogEntrySchema),
    defaultValues: {
      title: entry?.title ?? '',
      author: entry?.author ?? '',
      publisher: entry?.publisher ?? '',
      imprint: entry?.imprint ?? '',
      barcode: entry?.barcode ?? '',
      isbn: entry?.isbn ?? '',
      description: entry?.description ?? '',
      seriesId: entry?.series?.id ?? '',
      volumeNumber: entry?.volumeNumber ?? undefined,
      editionNumber: entry?.editionNumber ?? undefined,
      categoryIds: entry?.categories.map((c) => c.categoryId) ?? [],
      tagIds: entry?.tags.map((t) => t.tagId) ?? [],
      characterIds: entry?.characters.map((c) => c.characterId) ?? [],
    },
  });

  const selectedSeriesId = watch('seriesId');
  const selectedCategoryIds = watch('categoryIds') ?? [];
  const selectedTagIds = watch('tagIds') ?? [];
  const selectedCharacterIds = watch('characterIds') ?? [];

  useEffect(() => {
    Promise.all([getCategories(), getTags(), getCharacters(1, 200), getSeries({ limit: 200 })]).then(
      ([cats, tgs, chars, ser]) => {
        setCategories(cats);
        setTags(tgs);
        setCharacters(chars.data);
        setSeriesList(ser.data);
      },
    );
  }, []);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const toggleArrayItem = (
    field: 'categoryIds' | 'tagIds' | 'characterIds',
    id: string,
    checked: boolean,
  ) => {
    const current =
      field === 'categoryIds'
        ? selectedCategoryIds
        : field === 'tagIds'
          ? selectedTagIds
          : selectedCharacterIds;
    const next = checked ? [...current, id] : current.filter((x) => x !== id);
    setValue(field, next, { shouldValidate: true });
  };

  const onFormSubmit = (data: CreateCatalogEntryInput) => {
    onSubmit(data, coverFile ?? undefined);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Cover preview */}
        <div className="space-y-2">
          <Label>{t('coverImage')}</Label>
          <div className="w-48 aspect-[2/3] bg-muted rounded-lg overflow-hidden flex items-center justify-center mb-2">
            {coverPreview ? (
              <img src={coverPreview} alt="Cover" className="h-full w-full object-cover" />
            ) : (
              <BookOpen className="h-12 w-12 text-muted-foreground/40" />
            )}
          </div>
          <Input type="file" accept="image/*" onChange={handleCoverChange} />
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="title">{t('form.title')} *</Label>
            <Input id="title" {...register('title')} />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Author */}
          <div className="space-y-1">
            <Label htmlFor="author">{t('form.author')}</Label>
            <Input id="author" {...register('author')} />
          </div>

          {/* Publisher */}
          <div className="space-y-1">
            <Label htmlFor="publisher">{t('form.publisher')}</Label>
            <Input id="publisher" {...register('publisher')} />
          </div>

          {/* Imprint */}
          <div className="space-y-1">
            <Label htmlFor="imprint">{t('form.imprint')}</Label>
            <Input id="imprint" {...register('imprint')} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Barcode */}
        <div className="space-y-1">
          <Label htmlFor="barcode">{t('form.barcode')}</Label>
          <Input id="barcode" {...register('barcode')} />
        </div>

        {/* ISBN */}
        <div className="space-y-1">
          <Label htmlFor="isbn">{t('form.isbn')}</Label>
          <Input id="isbn" {...register('isbn')} />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <Label htmlFor="description">{t('form.description')}</Label>
        <Textarea id="description" rows={4} {...register('description')} />
      </div>

      {/* Series */}
      <div className="space-y-1">
        <Label>{t('form.series')}</Label>
        <Select
          value={selectedSeriesId || '_none'}
          onValueChange={(v) => setValue('seriesId', v === '_none' ? '' : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('form.noSeries')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">{t('form.noSeries')}</SelectItem>
            {seriesList.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Volume/Edition (shown when series selected) */}
      {selectedSeriesId && selectedSeriesId !== '_none' && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="volumeNumber">{t('form.volume')}</Label>
            <Input
              id="volumeNumber"
              type="number"
              {...register('volumeNumber', { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="editionNumber">{t('form.edition')}</Label>
            <Input
              id="editionNumber"
              type="number"
              {...register('editionNumber', { valueAsNumber: true })}
            />
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-2">
        <Label>{t('form.categories')}</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2">
              <Checkbox
                id={`form-cat-${cat.id}`}
                checked={selectedCategoryIds.includes(cat.id)}
                onCheckedChange={(checked) =>
                  toggleArrayItem('categoryIds', cat.id, checked === true)
                }
              />
              <Label htmlFor={`form-cat-${cat.id}`} className="text-sm cursor-pointer">
                {cat.name}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label>{t('form.tags')}</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-2">
              <Checkbox
                id={`form-tag-${tag.id}`}
                checked={selectedTagIds.includes(tag.id)}
                onCheckedChange={(checked) =>
                  toggleArrayItem('tagIds', tag.id, checked === true)
                }
              />
              <Label htmlFor={`form-tag-${tag.id}`} className="text-sm cursor-pointer">
                {tag.name}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Characters */}
      <div className="space-y-2">
        <Label>{t('form.characters')}</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
          {characters.map((char) => (
            <div key={char.id} className="flex items-center gap-2">
              <Checkbox
                id={`form-char-${char.id}`}
                checked={selectedCharacterIds.includes(char.id)}
                onCheckedChange={(checked) =>
                  toggleArrayItem('characterIds', char.id, checked === true)
                }
              />
              <Label htmlFor={`form-char-${char.id}`} className="text-sm cursor-pointer">
                {char.name}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={loading}>
          {entry ? tCommon('save') : t('form.create')}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {tCommon('cancel')}
        </Button>
      </div>
    </form>
  );
}
