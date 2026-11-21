import { ensureStorage, type StorageState } from '@/db/instance';

export const storageService = {
  ensurePersistent(): Promise<StorageState> {
    return ensureStorage();
  },
};
