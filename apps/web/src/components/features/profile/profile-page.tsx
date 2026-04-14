'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { User, Globe, Twitter, Instagram, Calendar } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  getProfile,
  updateProfile,
  type UserProfile,
  type UpdateProfileInput,
} from '@/lib/api/users';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function ProfilePage() {
  const t = useTranslations('profile');

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');

  const fetchProfile = useCallback(async () => {
    try {
      const data = await getProfile();
      setProfile(data);
      setName(data.name);
      setBio(data.bio ?? '');
      setWebsiteUrl(data.websiteUrl ?? '');
      setTwitterHandle(data.twitterHandle ?? '');
      setInstagramHandle(data.instagramHandle ?? '');
    } catch {
      toast.error(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const input: UpdateProfileInput = {
        name: name.trim(),
        bio: bio.trim(),
        websiteUrl: websiteUrl.trim(),
        twitterHandle: twitterHandle.trim(),
        instagramHandle: instagramHandle.trim(),
      };
      const updated = await updateProfile(input);
      setProfile(updated);
      toast.success(t('saved'));
    } catch {
      toast.error(t('error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Avatar + Info Card */}
        <Card>
          <CardContent className="flex flex-col items-center pt-6 space-y-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile.avatarUrl ?? undefined} alt={profile.name} />
              <AvatarFallback className="text-2xl">
                {getInitials(profile.name)}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <p className="text-lg font-semibold">{profile.name}</p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {t('memberSince')} {formatDate(profile.createdAt)}
            </div>
          </CardContent>
        </Card>

        {/* Edit Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t('personalInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('name')}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <Input id="email" value={profile.email} disabled className="opacity-60" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">{t('bio')}</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t('bioPlaceholder')}
                  maxLength={500}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground text-right">{bio.length}/500</p>
              </div>
            </CardContent>
          </Card>

          {/* Social Links */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                {t('socialLinks')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="website">{t('website')}</Label>
                <Input
                  id="website"
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder={t('websitePlaceholder')}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="twitter" className="flex items-center gap-1">
                    <Twitter className="h-4 w-4" />
                    {t('twitter')}
                  </Label>
                  <Input
                    id="twitter"
                    value={twitterHandle}
                    onChange={(e) => setTwitterHandle(e.target.value)}
                    placeholder={t('twitterPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagram" className="flex items-center gap-1">
                    <Instagram className="h-4 w-4" />
                    {t('instagram')}
                  </Label>
                  <Input
                    id="instagram"
                    value={instagramHandle}
                    onChange={(e) => setInstagramHandle(e.target.value)}
                    placeholder={t('instagramPlaceholder')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? t('saving') : t('save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
