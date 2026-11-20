import { z } from 'zod';

export const patientSchema = z.object({
  name: z.string().min(2, 'El nombre es obligatorio.').max(100, 'Máximo 100 caracteres.'),
  species: z.string().min(2, 'La especie es obligatoria.').max(50, 'Máximo 50 caracteres.'),
  breed: z.string().max(50, 'Máximo 50 caracteres.').optional().or(z.literal('')),
  sex: z.enum(['macho', 'hembra', 'otro']).optional().nullable(),
  birthDate: z.string().optional().or(z.literal('')),
  birthDateApproximate: z.boolean().default(false),
  ownerId: z.string().min(1, 'Debe seleccionar un propietario.'),
  notes: z.string().max(500, 'Máximo 500 caracteres.').optional().or(z.literal('')),
});

export type PatientFormValues = z.infer<typeof patientSchema>;

export const patientDefaultValues: PatientFormValues = {
  name: '',
  species: '',
  breed: '',
  sex: null,
  birthDate: '',
  birthDateApproximate: false,
  ownerId: '',
  notes: '',
};
