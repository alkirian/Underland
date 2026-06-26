-- 1. Crear tabla public.beatmarket
CREATE TABLE IF NOT EXISTS public.beatmarket (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beat_title TEXT NOT NULL,
    producer_name TEXT NOT NULL,
    genre TEXT,
    bpm INTEGER NOT NULL,
    intro_duration NUMERIC DEFAULT 0,
    audio_url TEXT NOT NULL,
    instagram_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Activar seguridad RLS
ALTER TABLE public.beatmarket ENABLE ROW LEVEL SECURITY;

-- 3. Crear política de lectura pública
CREATE POLICY "Permitir lectura publica de beats" ON public.beatmarket
    FOR SELECT TO public USING (true);

-- 4. Insertar los 9 beats reales/fallbacks
INSERT INTO public.beatmarket (id, beat_title, producer_name, genre, bpm, intro_duration, audio_url, instagram_url) VALUES
('3dd75e76-c8ec-43b6-9603-fd278779e1ec', 'Boom Bap Clásico', 'Prod. Local', 'Boom Bap', 90, 0, '/beats/boom_bap.mp3', null),
('f3f7c50a-b6af-4553-b770-76c75ddf096e', 'Trap del Puerto', 'Prod. El Plaza', 'Trap', 130, 0, '/beats/trap.mp3', null),
('472be04b-ccca-43c5-81fc-f3366b0f92d1', 'Underground 88', 'Prod. La Unión', 'Underground', 88, 5.5, '/beats/underground.mp3', null),
('9abd4c0e-823e-45b6-a2a2-6f36774db636', 'Rambla Lo-Fi', 'Prod. Rambla Beats', 'Lo-Fi', 80, 0, '/beats/lofi.mp3', null),
('8e567f6b-d588-472c-ac11-35f653efe3a7', 'Boom Bap Clásico 90s', 'Soma', 'BoomBap', 90, 0, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', null),
('6d029c87-aa74-48a6-b3d0-c6125ca40c68', 'Drill Pesado Oscuro', 'Subsuelo Records', 'Drill', 140, 0, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', null),
('7f43830b-f3a6-46de-b422-d50b0a719f54', 'Boom Bap Old School Funk', 'Sebastián Lorca', 'Boom Bap', 90, 0, 'https://inoremwazicuzbsehzax.supabase.co/storage/v1/object/public/beats/boom_bap_old_school.mp3', null),
('08c5af20-9cbc-4c51-94aa-09574eadb19d', 'Trance Trap Free', 'BasesRap', 'Trap', 120, 0, 'https://inoremwazicuzbsehzax.supabase.co/storage/v1/object/public/beats/trance_trap_free.mp3', null),
('b55e6320-ee65-428d-b8b1-997e8ea10d1a', 'Base de Rap Para Improvisar', 'BasesRap', 'Boom Bap', 95, 5.5, 'https://inoremwazicuzbsehzax.supabase.co/storage/v1/object/public/beats/base_improvisar_rap.mp3', null)
ON CONFLICT (id) DO NOTHING;
