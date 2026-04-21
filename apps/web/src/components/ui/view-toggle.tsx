'use client';

import { LayoutGrid, Grid2x2, List } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type ViewMode = 'grid' | 'compact' | 'list';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  modes?: ViewMode[];
}

const icons: Record<ViewMode, typeof LayoutGrid> = {
  grid: LayoutGrid,
  compact: Grid2x2,
  list: List,
};

const labels: Record<ViewMode, string> = {
  grid: 'Grade',
  compact: 'Compacto',
  list: 'Lista',
};

export function ViewToggle({ value, onChange, modes = ['grid', 'compact', 'list'] }: ViewToggleProps) {
  return (
    <div className="flex items-center rounded-md border border-border">
      {modes.map((mode) => {
        const Icon = icons[mode];
        return (
          <Button
            key={mode}
            variant={value === mode ? 'default' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0 rounded-none first:rounded-l-md last:rounded-r-md"
            onClick={() => onChange(mode)}
            title={labels[mode]}
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}
