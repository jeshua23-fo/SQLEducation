import { supabaseAdmin } from '../config/supabase.js';

export async function requireAdmin(req, res, next) {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', req.authUser.id)
      .maybeSingle();

    if (error) return next(error);
    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ message: 'No tienes permisos de administrador.' });
    }

    req.adminProfile = profile;
    next();
  } catch (error) {
    next(error);
  }
}
