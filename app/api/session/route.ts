
import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function POST() {
    try {
        // Insert a new row into 'sessions' table, letting Supabase handle ID generation
        // Assuming 'id' is a serial/identity column and 'created_at' is default now()
        const { data, error } = await supabase
            .from('sessions')
            .insert([{}]) // Empty object to trigger default values
            .select('id')
            .single();

        if (error) {
            throw error;
        }

        console.log("New Session Created:", data.id);

        return NextResponse.json({ id: data.id });
    } catch (error: any) {
        console.error("Session Creation Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
