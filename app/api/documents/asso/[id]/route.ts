import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { deleteFromStorage, getSignedUrl } from '@/lib/storage';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const signed = req.nextUrl.searchParams.get('signed') === 'true';

  const supabase = getSupabaseServer();
  const { data: doc, error } = await supabase
    .from('documents_association')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });

  if (signed && doc.storage_path) {
    try {
      const url = await getSignedUrl(doc.storage_path);
      return NextResponse.json({ url, document: doc });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur URL' }, { status: 500 });
    }
  }

  return NextResponse.json({ document: doc });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data: doc } = await supabase
    .from('documents_association')
    .select('storage_path')
    .eq('id', id)
    .single();

  if (doc?.storage_path) {
    try { await deleteFromStorage(doc.storage_path); } catch { /* continue */ }
  }

  const { error } = await supabase.from('documents_association').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
