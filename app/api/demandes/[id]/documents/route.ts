import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { uploadToStorage } from '@/lib/storage';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('documents_demande')
    .select('*')
    .eq('demande_id', id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let formData: FormData;
  try { formData = await req.formData(); } catch {
    return NextResponse.json({ error: 'Formulaire invalide' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'Fichier trop volumineux (max 20 Mo)' }, { status: 413 });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `demandes/${id}/${Date.now()}_${safeName}`;

  try {
    await uploadToStorage(path, file);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur upload' }, { status: 500 });
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('documents_demande')
    .insert({
      demande_id: id,
      nom_fichier: file.name,
      storage_path: path,
      taille_octets: file.size,
      mime_type: file.type || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data }, { status: 201 });
}
