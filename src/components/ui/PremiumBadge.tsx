import { Lock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export function PremiumBadge() {
  return (
    <Badge variant="warning" className="ml-2">
      <Lock className="w-3 h-3 mr-1" />
      Premium
    </Badge>
  );
}
