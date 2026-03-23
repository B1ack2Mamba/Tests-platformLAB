import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/serverAuth';
import { isAdminEmail } from '@/lib/admin';

type SceneTemplateBody = {
  scene_widgets?: unknown;
  desk_template?: unknown;
  tray_guide_text?: unknown;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const auth = await requireUser(req, res, { requireEmail: true });
  if (!auth) return;
  const { user, supabaseAdmin } = auth;

  if (!isAdminEmail(user.email)) {
    return res.status(403).json({ ok: false, error: 'Forbidden' });
  }

  const body = (req.body || {}) as SceneTemplateBody;
  const sceneWidgets = Array.isArray(body.scene_widgets) ? body.scene_widgets : [];
  const deskTemplate = body.desk_template && typeof body.desk_template === 'object' ? body.desk_template : {};
  const trayGuideText = typeof body.tray_guide_text === 'string' && body.tray_guide_text.trim()
    ? body.tray_guide_text.trim()
    : 'Создать новую папку проектов';

  const payload = {
    template_key: 'global_default',
    owner_user_id: user.id,
    scene_widgets: sceneWidgets,
    desk_template: deskTemplate,
    tray_guide_text: trayGuideText,
  };

  const { data, error } = await supabaseAdmin
    .from('commercial_scene_templates')
    .upsert(payload, { onConflict: 'template_key' })
    .select('updated_at, scene_widgets, desk_template, tray_guide_text')
    .single();

  if (error) return res.status(500).json({ ok: false, error: error.message || 'Не удалось сохранить шаблон сцены' });

  return res.status(200).json({ ok: true, template: data });
}
