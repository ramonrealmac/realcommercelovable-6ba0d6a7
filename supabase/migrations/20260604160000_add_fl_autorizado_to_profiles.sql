-- Migration: Add fl_autorizado to profiles
-- Description: Adds authorization field to profiles and marks existing as authorized.

ALTER TABLE public.profiles ADD COLUMN fl_autorizado boolean DEFAULT false NOT NULL;

-- Mark all existing users as authorized
UPDATE public.profiles SET fl_autorizado = true;
