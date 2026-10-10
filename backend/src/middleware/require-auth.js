import { supabaseAuth } from '../config/supabase.js';

export async function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({ message: 'Debes iniciar sesión.' });
  }

  const { data, error } = await supabaseAuth.auth.getUser(match[1]);

  if (error || !data?.user) {
    return res.status(401).json({ message: 'La sesión no es válida o ha caducado.' });
  }

  req.authUser = data.user;
  next();
}
