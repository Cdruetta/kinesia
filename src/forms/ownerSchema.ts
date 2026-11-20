import { z } from 'zod';

export const ownerSchema = z.object({
  name: z
    .string()
    .min(2, 'El nombre y apellido son obligatorios.')
    .max(100, 'Máximo 100 caracteres.'),
  phone: z.string().min(1, 'El teléfono es obligatorio.'),
  address: z.string().max(200, 'Máximo 200 caracteres.').optional().or(z.literal('')),
  notes: z.string().max(500, 'Máximo 500 caracteres.').optional().or(z.literal('')),
});

export type OwnerFormValues = z.infer<typeof ownerSchema>;

export const ownerDefaultValues: OwnerFormValues = {
  name: '',
  phone: '',
  address: '',
  notes: '',
};
