import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/serverAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const auth = await requireUser(req, res);
  if (!auth) return;
  const { supabaseAdmin } = auth;

  const { data, error } = await supabaseAdmin
    .from('commercial_scene_templates')
    .select('updated_at, scene_widgets, desk_template, tray_guide_text')
    .eq('template_key', 'global_default')
    .maybeSingle();

  if (error) return res.status(500).json({ ok: false, error: error.message || 'Не удалось загрузить шаблон сцены' });

  return res.status(200).json({ ok: true, template: data || null });
}
