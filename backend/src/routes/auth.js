import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { supabaseAdmin, supabaseAuth } from '../config/supabase.js';
import { requireAuth } from '../middleware/require-auth.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Demasiados intentos. Espera unos minutos e inténtalo otra vez.' }
});

function safeProfile(profile, authUser) {
  return {
    id: authUser.id,
    email: authUser.email ?? null,
    username: profile?.username ?? null,
    display_name: profile?.display_name ?? authUser.user_metadata?.display_name ?? null,
    role: profile?.role ?? 'student',
    avatar_url: profile?.avatar_url ?? null
  };
}

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const identifier = typeof req.body?.user === 'string'
      ? req.body.user.trim()
      : '';
    const password = typeof req.body?.pass === 'string'
      ? req.body.pass
      : '';

    if (!identifier || !password || identifier.length > 320 || password.length > 1024) {
      return res.status(400).json({ message: 'Introduce tu usuario/correo y contraseña.' });
    }

    let email = identifier;

    // Username sign-in is resolved only on the trusted server; the service-role key
    // must never be sent to the browser.
    if (!identifier.includes('@')) {
      const username = identifier.toLowerCase();
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('users')
        .select('id, username, display_name, role, avatar_url')
        .eq('username', username)
        .maybeSingle();

      if (profileError) return next(profileError);
      if (!profile) {
        return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
      }

      const { data: authData, error: authLookupError } =
        await supabaseAdmin.auth.admin.getUserById(profile.id);

      if (authLookupError || !authData?.user?.email) {
        return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
      }
      email = authData.user.email;
    }

    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data?.user || !data?.session) {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, role, avatar_url')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) return next(profileError);

    return res.json({
      ok: true,
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
      user: safeProfile(profile, data.user)
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, role, avatar_url, created_at')
      .eq('id', req.authUser.id)
      .maybeSingle();

    if (error) return next(error);

    return res.json({
      user: {
        ...safeProfile(profile, req.authUser),
        created_at: profile?.created_at ?? null
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
