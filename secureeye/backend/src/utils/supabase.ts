// ===================================================================
// SecureEye Backend — Supabase Admin Client
// ===================================================================

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn(
        'WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Database operations will fail.'
    );
}

export const supabase = createClient(
    supabaseUrl || 'http://localhost:54321',
    supabaseServiceRoleKey || 'dummy-key',
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

export default supabase;
