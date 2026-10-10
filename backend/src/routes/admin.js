import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireAdmin } from '../middleware/require-admin.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const createStudentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Se alcanzó el límite de creación de cuentas. Inténtalo más tarde.' }
});

function normalizeUsername(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function validPassword(value) {
  return typeof value === 'string' && value.length >= 8 && value.length <= 128;
}

function publicStudent(profile) {
  return {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
    role: profile.role,
    created_at: profile.created_at
  };
}

// GET /api/admin/students — list student profiles only.
router.get('/students', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, role, created_at')
      .eq('role', 'student')
      .order('created_at', { ascending: false });

    if (error) return next(error);
    return res.json({ students: (data ?? []).map(publicStudent) });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/students — create a student; there is deliberately no public signup.
router.post('/students', createStudentLimiter, async (req, res, next) => {
  let createdAuthUserId = null;

  try {
    const username = normalizeUsername(req.body?.username);
    const displayName = typeof req.body?.display_name === 'string'
      ? req.body.display_name.trim()
      : '';
    const password = req.body?.password;

    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({
        message: 'El usuario debe tener entre 3 y 30 caracteres: letras minúsculas, números o guion bajo.'
      });
    }
    if (displayName.length < 1 || displayName.length > 80) {
      return res.status(400).json({ message: 'El nombre debe tener entre 1 y 80 caracteres.' });
    }
    if (!validPassword(password)) {
      return res.status(400).json({ message: 'La contraseña inicial debe tener entre 8 y 128 caracteres.' });
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existingError) return next(existingError);
    if (existing) return res.status(409).json({ message: 'Ese nombre de usuario ya está en uso.' });

    // Students sign in with their username. Supabase Auth requires an email for
    // password authentication, so accounts without an email use a reserved
    // non-deliverable .invalid address. Never send email to this address.
    const internalEmail = `${username}@students.sqleducation.invalid`;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName }
    });

    if (authError || !authData?.user) {
      if (authError?.code === 'email_exists' || authError?.message?.toLowerCase().includes('already')) {
        return res.status(409).json({ message: 'No se pudo crear la cuenta porque el identificador ya existe.' });
      }
      if (authError) return next(authError);
      return res.status(500).json({ message: 'No se pudo crear la cuenta de autenticación.' });
    }

    createdAuthUserId = authData.user.id;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: createdAuthUserId,
        username,
        display_name: displayName,
        role: 'student'
      })
      .select('id, username, display_name, role, created_at')
      .single();

    if (profileError) {
      // Roll back the Auth account if profile creation fails, avoiding orphaned accounts.
      await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
      if (profileError.code === '23505') {
        return res.status(409).json({ message: 'Ese nombre de usuario ya está en uso.' });
      }
      return next(profileError);
    }

    return res.status(201).json({
      message: 'Cuenta de alumno creada.',
      student: publicStudent(profile)
    });
  } catch (error) {
    if (createdAuthUserId) {
      await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
    }
    next(error);
  }
});

// POST /api/admin/students/:id/reset-password — admin assigns a new password.
router.post('/students/:id/reset-password', async (req, res, next) => {
  try {
    const studentId = req.params.id;
    const password = req.body?.password;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(studentId)) {
      return res.status(400).json({ message: 'Identificador de alumno no válido.' });
    }
    if (!validPassword(password)) {
      return res.status(400).json({ message: 'La nueva contraseña debe tener entre 8 y 128 caracteres.' });
    }

    const { data: student, error: studentError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', studentId)
      .maybeSingle();

    if (studentError) return next(studentError);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'No se encontró ese alumno.' });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(studentId, { password });
    if (error) return next(error);

    return res.json({ message: 'Contraseña actualizada.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/students/:id/access — enable or suspend student login.
router.post('/students/:id/access', async (req, res, next) => {
  try {
    const studentId = req.params.id;
    const enabled = req.body?.enabled;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(studentId)) {
      return res.status(400).json({ message: 'Identificador de alumno no válido.' });
    }
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'Indica enabled como true o false.' });
    }

    const { data: student, error: studentError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', studentId)
      .maybeSingle();

    if (studentError) return next(studentError);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'No se encontró ese alumno.' });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(studentId, {
      ban_duration: enabled ? 'none' : '876000h'
    });
    if (error) return next(error);

    return res.json({ message: enabled ? 'Acceso del alumno habilitado.' : 'Acceso del alumno suspendido.' });
  } catch (error) {
    next(error);
  }
});

export default router;
